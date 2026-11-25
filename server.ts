import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns/promises';
import net from 'net';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import * as cheerio from 'cheerio';

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const ALLOWED_CLOUD_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
]);

const ALLOWED_THINKING_LEVELS = new Set(['LOW', 'MEDIUM', 'HIGH']);

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
    if (a >= 224) return true; // multicast & reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('ff')
    ) {
      return true;
    }
    if (normalized.startsWith('::ffff:')) {
      const ipv4Part = normalized.slice('::ffff:'.length);
      if (net.isIPv4(ipv4Part)) return isPrivateOrReservedIp(ipv4Part);
    }
    return false;
  }

  return true;
}

async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Please enter a valid URL starting with http:// or https://.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are supported.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs containing embedded credentials are not allowed.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Local or private network addresses cannot be fetched.');
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error('Private or reserved IP addresses cannot be fetched.');
    }
    return parsed;
  }

  const records = await dns.lookup(hostname, { all: true });
  if (!records || records.length === 0) {
    throw new Error('Unable to resolve website hostname.');
  }
  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      throw new Error('This website resolves to a restricted network address.');
    }
  }

  return parsed;
}

async function fetchPublicWebpage(rawUrl: string, maxRedirects = 3): Promise<{ finalUrl: string; contentType: string; body: string }> {
  let currentUrl = await assertSafePublicUrl(rawUrl);

  for (let i = 0; i <= maxRedirects; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(currentUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AGM-Studio-Reader/1.0 (+https://agm.studio)',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new Error(`Received redirect (${response.status}) without a destination URL.`);
        }
        const nextUrl = new URL(location, currentUrl);
        currentUrl = await assertSafePublicUrl(nextUrl.toString());
        continue;
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Access restricted (${response.status}). This website blocks automated reading or requires authentication.`);
        }
        if (response.status === 404) {
          throw new Error('Page not found (404). Please verify the URL.');
        }
        if (response.status === 429) {
          throw new Error('Rate limited by target website (429). Please try again later.');
        }
        throw new Error(`Website returned HTTP ${response.status}.`);
      }

      const contentType = (response.headers.get('content-type') || 'text/plain').toLowerCase();
      const isSupported =
        contentType.includes('text/html') ||
        contentType.includes('application/xhtml+xml') ||
        contentType.includes('text/plain') ||
        contentType.includes('text/markdown') ||
        contentType.includes('application/json');

      if (!isSupported) {
        throw new Error(`Unsupported content type (${contentType.split(';')[0]}). Website Reader supports HTML and plain text pages.`);
      }

      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader && Number(contentLengthHeader) > 2 * 1024 * 1024) {
        throw new Error('Webpage exceeds the 2 MB size limit for reader extraction.');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const text = await response.text();
        return { finalUrl: currentUrl.toString(), contentType, body: text.slice(0, 2 * 1024 * 1024) };
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      const maxBytes = 2 * 1024 * 1024;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            reader.cancel().catch(() => {});
            throw new Error('Webpage exceeds the 2 MB size limit for reader extraction.');
          }
          chunks.push(value);
        }
      }

      const decoder = new TextDecoder('utf-8', { fatal: false });
      const body = decoder.decode(Buffer.concat(chunks));
      return { finalUrl: currentUrl.toString(), contentType, body };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out after 10 seconds while fetching the website.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error('Too many redirects while trying to load the website.');
}

function extractReadableWebsiteContent(htmlOrText: string, contentType: string, url: string) {
  if (!contentType.includes('html') && !contentType.includes('xhtml')) {
    const cleanText = htmlOrText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const parsedUrl = new URL(url);
    return {
      title: parsedUrl.hostname + parsedUrl.pathname,
      description: '',
      content: cleanText,
      wordCount: cleanText ? cleanText.split(/\s+/).length : 0,
    };
  }

  const $ = cheerio.load(htmlOrText);

  const rawTitle =
    $('meta[property="og:title"]').attr('content') ||
    $('title').first().text() ||
    $('h1').first().text() ||
    new URL(url).hostname;
  const title = rawTitle.replace(/\s+/g, ' ').trim();

  const description = (
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim();

  // Remove non-content / noisy elements
  $(
    'script, style, noscript, iframe, svg, canvas, video, audio, form, button, input, select, textarea, nav, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"], .cookie-banner, .advertisement, .ads'
  ).remove();

  // Prefer semantic main/article container if substantial
  const mainCandidate = $('main, article, [role="main"]').first();
  const rootEl = mainCandidate.length > 0 && mainCandidate.text().trim().length > 200 ? mainCandidate : $('body');

  const blocks: string[] = [];
  rootEl.find('h1, h2, h3, h4, p, li, pre, blockquote, td, th').each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      blocks.push(`\n## ${text}`);
    } else if (tag === 'li') {
      blocks.push(`- ${text}`);
    } else if (tag === 'blockquote') {
      blocks.push(`> ${text}`);
    } else {
      blocks.push(text);
    }
  });

  let content = blocks.join('\n\n');
  if (content.trim().length < 100) {
    // Fallback to full body text extraction
    content = rootEl
      .text()
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();
  }

  // Deduplicate consecutive identical lines and cap cleanly
  const deduped = content
    .split('\n')
    .filter((line, idx, arr) => idx === 0 || line !== arr[idx - 1])
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const maxChars = 60000;
  const truncated = deduped.length > maxChars ? `${deduped.slice(0, maxChars)}\n\n[Content truncated at 60,000 characters]` : deduped;
  const wordCount = truncated ? truncated.split(/\s+/).length : 0;

  return {
    title: title || new URL(url).hostname,
    description,
    content: truncated,
    wordCount,
  };
}

function extractNestedErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const inner = parsed?.error?.message ?? parsed?.message;
    if (typeof inner === 'string') {
      try {
        const innerParsed = JSON.parse(inner);
        if (typeof innerParsed?.error?.message === 'string') {
          return innerParsed.error.message;
        }
      } catch {
        return inner;
      }
      return inner;
    }
  } catch {
    // Not JSON
  }
  return raw;
}

function mapGeminiError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const cleanMessage = extractNestedErrorMessage(raw);
  const lower = raw.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      message: 'Cloud AI service is currently unavailable. Switch to Local AI mode to run directly in your browser with no setup.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'Cloud AI rate or quota limit reached. Try again shortly or switch to Local AI mode.',
    };
  }
  if (lower.includes('unavailable') || lower.includes('503') || lower.includes('high demand')) {
    return {
      status: 503,
      message: 'Cloud AI model is temporarily experiencing high demand. Please retry in a moment, switch to Gemini 3.1 Flash Lite in Settings, or use Local AI mode.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: 'Selected Cloud AI model was not found. Please select gemini-4-hydrogen or gemini-3.1-flash-lite in Settings.',
    };
  }
  if (lower.includes('400') || lower.includes('invalid_argument')) {
    return {
      status: 400,
      message: `Invalid request parameters: ${cleanMessage}`,
    };
  }
  return {
    status: 500,
    message: cleanMessage || 'Cloud AI encountered an unexpected error.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    const cloudAvailable = Boolean(process.env.GEMINI_API_KEY?.trim());
    res.json({
      status: 'ok',
      cloudAvailable,
      models: [
        {
          id: 'gemini-4-hydrogen',
          label: 'Gemini 4 Hydrogen',
          description: 'Balanced speed and reasoning for everyday chat, coding, and synthesis',
        },
        {
          id: 'gemini-3.1-flash-lite',
          label: 'Gemini 3.1 Flash Lite',
          description: 'Ultra-low latency responses for quick Q&A and lightweight summaries',
        },
      ],
    });
  });

  app.post('/api/reader/fetch', async (req, res) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!rawUrl) {
      res.status(400).json({ error: 'Please provide a URL to read.' });
      return;
    }

    const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

    try {
      const { finalUrl, contentType, body } = await fetchPublicWebpage(normalizedUrl);
      const extracted = extractReadableWebsiteContent(body, contentType, finalUrl);

      if (!extracted.content) {
        res.status(422).json({
          error: 'No readable text content could be extracted from this page (it may require client-side JavaScript rendering or authentication).',
        });
        return;
      }

      res.json({
        url: finalUrl,
        title: extracted.title,
        description: extracted.description,
        content: extracted.content,
        wordCount: extracted.wordCount,
        fetchedAt: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch website content.';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/chat/stream', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Cloud AI is unavailable in this environment. Switch to Local AI mode to run models directly in your browser.',
      });
      return;
    }

    const body = req.body ?? {};
    const requestedModel = typeof body.model === 'string' ? body.model : 'gemini-4-hydrogen';
    const model = ALLOWED_CLOUD_MODELS.has(requestedModel) ? requestedModel : 'gemini-4-hydrogen';

    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    if (rawMessages.length === 0) {
      res.status(400).json({ error: 'At least one message is required.' });
      return;
    }

    const systemInstruction = typeof body.systemInstruction === 'string' ? body.systemInstruction.trim() : '';
    const requestedThinking = typeof body.thinkingLevel === 'string' ? body.thinkingLevel.toUpperCase() : 'MEDIUM';
    const thinkingLevelKey = ALLOWED_THINKING_LEVELS.has(requestedThinking) ? requestedThinking : 'MEDIUM';

    const contents = rawMessages
      .filter(
        (m: unknown): m is { role: string; content: string } =>
          Boolean(m) &&
          typeof m === 'object' &&
          typeof (m as { role?: unknown }).role === 'string' &&
          typeof (m as { content?: unknown }).content === 'string' &&
          (m as { content: string }).content.trim().length > 0
      )
      .slice(-30)
      .map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    if (contents.length === 0) {
      res.status(400).json({ error: 'Conversation messages cannot be empty.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const abortController = new AbortController();
    let clientClosed = false;

    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
        abortController.abort();
      }
    });

    const writeEvent = (payload: Record<string, unknown>) => {
      if (!clientClosed && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    try {
      const thinkingMap: Record<string, ThinkingLevel> = {
        LOW: ThinkingLevel.LOW,
        MEDIUM: ThinkingLevel.MEDIUM,
        HIGH: ThinkingLevel.HIGH,
      };

      const config: {
        systemInstruction?: string;
        thinkingConfig?: { thinkingLevel: ThinkingLevel };
        abortSignal?: AbortSignal;
      } = {
        abortSignal: abortController.signal,
      };

      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      if (model === 'gemini-4-hydrogen') {
        config.thinkingConfig = {
          thinkingLevel: thinkingMap[thinkingLevelKey] ?? ThinkingLevel.MEDIUM,
        };
      }

      let stream: Awaited<ReturnType<typeof ai.models.generateContentStream>> | null = null;
      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          stream = await ai.models.generateContentStream({
            model,
            contents,
            config,
          });
          break;
        } catch (attemptErr) {
          const msg = attemptErr instanceof Error ? attemptErr.message.toLowerCase() : '';
          const isTransient = msg.includes('503') || msg.includes('unavailable') || msg.includes('high demand');
          if (attempt < maxAttempts && isTransient && !clientClosed) {
            await new Promise((r) => setTimeout(r, 600 * attempt));
            continue;
          }
          throw attemptErr;
        }
      }

      if (stream) {
        for await (const chunk of stream) {
          if (clientClosed) break;
          const text = chunk.text;
          if (text) {
            writeEvent({ type: 'chunk', text });
          }
        }
      }

      if (!clientClosed) {
        writeEvent({ type: 'done' });
        res.end();
      }
    } catch (error) {
      if (clientClosed || (error instanceof Error && error.name === 'AbortError')) {
        if (!res.writableEnded) res.end();
        return;
      }
      const mapped = mapGeminiError(error);
      writeEvent({ type: 'error', status: mapped.status, message: mapped.message });
      res.end();
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Application build not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AGM Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AGM Studio server:', err);
  process.exit(1);
});
