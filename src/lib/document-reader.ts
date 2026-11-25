import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { AttachmentItem } from '../types';

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
} catch {
  // Fallback handled safely if PDF.js worker registration fails on unsupported runtimes
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_EXTRACTED_CHARS = 120000;

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function detectFileKind(file: File): 'pdf' | 'txt' | 'html' | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (name.endsWith('.pdf') || type === 'application/pdf') return 'pdf';
  if (name.endsWith('.html') || name.endsWith('.htm') || type === 'text/html') return 'html';
  if (name.endsWith('.txt') || type === 'text/plain') return 'txt';
  return null;
}

async function extractPdfText(file: File): Promise<{
  content: string;
  pages: string[];
  pageCount: number;
  description: string;
}> {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const pageCount = pdf.numPages;
  if (pageCount === 0) {
    throw new Error('This PDF file contains 0 pages.');
  }

  let metadataTitle = '';
  try {
    const meta = await pdf.getMetadata();
    const info = meta?.info as Record<string, unknown> | undefined;
    if (info && typeof info.Title === 'string' && info.Title.trim()) {
      metadataTitle = info.Title.trim();
    }
  } catch {
    // Metadata is optional
  }

  const pages: string[] = [];
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const strings: string[] = [];
    let lastY: number | null = null;

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const str = item.str;
      const transform = Array.isArray(item.transform) ? item.transform : null;
      const currentY = transform && typeof transform[5] === 'number' ? transform[5] : null;

      if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
        strings.push('\n');
      } else if (
        strings.length > 0 &&
        !strings[strings.length - 1].endsWith('\n') &&
        !str.startsWith(' ')
      ) {
        strings.push(' ');
      }

      strings.push(str);
      if (currentY !== null) lastY = currentY;
    }

    const pageText = strings
      .join('')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    pages.push(pageText || `[Page ${pageNum}: No selectable text found]`);
  }

  const combined = pages
    .map((p, idx) => `--- Page ${idx + 1} ---\n${p}`)
    .join('\n\n')
    .slice(0, MAX_EXTRACTED_CHARS);

  const nonEmptyPages = pages.filter(
    (p) => !p.startsWith('[Page ') || !p.endsWith('No selectable text found]')
  );
  if (nonEmptyPages.length === 0) {
    throw new Error(
      'No selectable text was found in this PDF. Scanned image-only PDFs require OCR.'
    );
  }

  return {
    content: combined,
    pages,
    pageCount,
    description: metadataTitle ? `${pageCount} pages · ${metadataTitle}` : `${pageCount} pages`,
  };
}

export function extractReadableHtmlText(rawHtml: string, fallbackName: string): {
  title: string;
  content: string;
  description: string;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');
  const title =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
    doc.querySelector('title')?.textContent?.trim() ||
    doc.querySelector('h1')?.textContent?.trim() ||
    fallbackName;

  const description =
    doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ||
    doc.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() ||
    `HTML document · ${title}`;

  const noiseSelectors =
    'script, style, noscript, iframe, svg, canvas, video, audio, form, button, input, select, textarea, nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"]';
  doc.querySelectorAll(noiseSelectors).forEach((el) => el.remove());

  const main = doc.querySelector('main, article, [role="main"]') ?? doc.body;
  const blocks: string[] = [];

  main?.querySelectorAll('h1, h2, h3, h4, p, li, pre, blockquote, td, th').forEach((el) => {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const tag = el.tagName.toLowerCase();
    if (tag.startsWith('h')) {
      blocks.push(`## ${text}`);
    } else if (tag === 'li') {
      blocks.push(`- ${text}`);
    } else if (tag === 'blockquote') {
      blocks.push(`> ${text}`);
    } else {
      blocks.push(text);
    }
  });

  let content = blocks.join('\n\n');
  if (content.trim().length < 40) {
    content = (main?.textContent ?? '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  const deduped = content
    .split('\n')
    .filter((line, idx, arr) => idx === 0 || line !== arr[idx - 1])
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!deduped) {
    throw new Error('No readable text content found in this HTML.');
  }

  return {
    title,
    content: deduped.slice(0, MAX_EXTRACTED_CHARS),
    description,
  };
}

export async function processUploadedDocument(file: File): Promise<AttachmentItem> {
  if (!file) {
    throw new Error('No file selected.');
  }

  if (file.size === 0) {
    throw new Error(`"${file.name}" is empty (0 bytes).`);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`"${file.name}" exceeds the 15 MB file size limit.`);
  }

  const kind = detectFileKind(file);
  if (!kind) {
    throw new Error(
      `Unsupported file type for "${file.name}". Please upload a PDF, TXT, or HTML file.`
    );
  }

  if (kind === 'pdf') {
    try {
      const pdfData = await extractPdfText(file);
      return {
        id: crypto.randomUUID(),
        kind: 'pdf',
        name: file.name,
        content: pdfData.content,
        pages: pdfData.pages,
        pageCount: pdfData.pageCount,
        sizeBytes: file.size,
        wordCount: countWords(pdfData.content),
        charCount: pdfData.content.length,
        description: pdfData.description,
        addedAt: Date.now(),
      };
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? `PDF parsing failed: ${err.message}`
          : 'Unable to parse this PDF file in the browser.'
      );
    }
  }

  const rawText = await file.text();
  if (!rawText.trim()) {
    throw new Error(`"${file.name}" contains no readable text.`);
  }

  if (kind === 'html') {
    const htmlData = extractReadableHtmlText(rawText, file.name);
    return {
      id: crypto.randomUUID(),
      kind: 'html',
      name: file.name,
      content: htmlData.content,
      sizeBytes: file.size,
      wordCount: countWords(htmlData.content),
      charCount: htmlData.content.length,
      description: htmlData.description,
      addedAt: Date.now(),
    };
  }

  const normalizedTxt = rawText.replace(/\r\n/g, '\n').trim().slice(0, MAX_EXTRACTED_CHARS);
  return {
    id: crypto.randomUUID(),
    kind: 'txt',
    name: file.name,
    content: normalizedTxt,
    sizeBytes: file.size,
    wordCount: countWords(normalizedTxt),
    charCount: normalizedTxt.length,
    description: 'Plain text file',
    addedAt: Date.now(),
  };
}
