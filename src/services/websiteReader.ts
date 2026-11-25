import type { AttachmentItem } from '../types';

export interface WebsiteFetchResult {
  url: string;
  title: string;
  description: string;
  content: string;
  wordCount: number;
  fetchedAt: number;
}

export async function fetchWebsiteContent(rawUrl: string): Promise<WebsiteFetchResult> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('Please enter a website URL.');
  }

  const response = await fetch('/api/reader/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: trimmed }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : `Failed to read website (HTTP ${response.status}).`
    );
  }

  return data as WebsiteFetchResult;
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
