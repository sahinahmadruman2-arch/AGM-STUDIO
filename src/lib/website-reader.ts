import type { AttachmentItem } from '../types';
import { extractReadableHtmlText } from './document-reader';

export interface WebsiteFetchResult {
  url: string;
  title: string;
  description: string;
  content: string;
  wordCount: number;
  fetchedAt: number;
}

function normalizeAndValidateUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('Please enter a public website URL.');
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error('Please enter a valid URL starting with http:// or https://.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are supported.');
  }

  return parsed;
}

export async function fetchWebsiteInBrowser(rawUrl: string): Promise<WebsiteFetchResult> {
  const parsedUrl = normalizeAndValidateUrl(rawUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.1',
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Access denied by remote server (HTTP ${response.status}). This page requires authentication or restricts automated browser access.`
        );
      }
      if (response.status === 404) {
        throw new Error('Page not found (HTTP 404). Please verify the URL.');
      }
      throw new Error(`Website responded with HTTP ${response.status}.`);
    }

    const contentType = (response.headers.get('content-type') || 'text/plain').toLowerCase();
    const rawBody = await response.text();
    if (!rawBody.trim()) {
      throw new Error('The page returned an empty response body.');
    }

    if (contentType.includes('html') || contentType.includes('xhtml') || /<html|<body/i.test(rawBody)) {
      const extracted = extractReadableHtmlText(rawBody, parsedUrl.hostname);
      const wordCount = extracted.content ? extracted.content.split(/\s+/).length : 0;
      return {
        url: response.url || parsedUrl.toString(),
        title: extracted.title,
        description: extracted.description,
        content: extracted.content,
        wordCount,
        fetchedAt: Date.now(),
      };
    }

    const cleanText = rawBody.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 80000);
    const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
    return {
      url: response.url || parsedUrl.toString(),
      title: parsedUrl.hostname + parsedUrl.pathname,
      description: contentType.split(';')[0],
      content: cleanText,
      wordCount,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out after 12 seconds while reading the website.');
    }
    if (err instanceof TypeError) {
      throw new Error(
        'Blocked by browser CORS policy or network restriction. Because AGM Studio runs 100% inside your browser without a proxy server, websites that omit Cross-Origin-Resource-Sharing (CORS) headers cannot be fetched directly. You can copy-paste the article text or HTML into the "Paste Content" tab instead.'
      );
    }
    throw err instanceof Error ? err : new Error('Failed to fetch website content.');
  } finally {
    clearTimeout(timeoutId);
  }
}

export function extractPastedWebsiteContent(
  rawInput: string,
  titleHint?: string
): WebsiteFetchResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Please paste webpage text or HTML source.');
  }

  const looksLikeHtml = /<(html|body|article|main|p|h1|h2|div)\b/i.test(trimmed);
  if (looksLikeHtml) {
    const extracted = extractReadableHtmlText(trimmed, titleHint?.trim() || 'Pasted Webpage');
    const wordCount = extracted.content ? extracted.content.split(/\s+/).length : 0;
    return {
      url: 'pasted-content://local',
      title: titleHint?.trim() || extracted.title,
      description: extracted.description,
      content: extracted.content,
      wordCount,
      fetchedAt: Date.now(),
    };
  }

  const cleanText = trimmed.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, 80000);
  const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
  return {
    url: 'pasted-content://local',
    title: titleHint?.trim() || 'Pasted Webpage Excerpt',
    description: 'Pasted readable text',
    content: cleanText,
    wordCount,
    fetchedAt: Date.now(),
  };
}

export function websiteResultToAttachment(result: WebsiteFetchResult): AttachmentItem {
  return {
    id: crypto.randomUUID(),
    kind: 'website',
    name: result.title || result.url,
    url: result.url,
    description: result.description || result.url,
    content: result.content,
    wordCount: result.wordCount,
    charCount: result.content.length,
    addedAt: Date.now(),
  };
}
