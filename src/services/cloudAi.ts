import type { AppSettings, CloudHealthInfo } from '../types';

export interface CloudMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface CloudStreamCallbacks {
  onChunk: (deltaText: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export async function fetchCloudHealth(): Promise<CloudHealthInfo> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error('Unable to reach AGM Studio backend server.');
  }
  return (await response.json()) as CloudHealthInfo;
}

export async function streamCloudResponse(params: {
  messages: CloudMessageInput[];
  systemInstruction: string;
  settings: AppSettings;
  signal: AbortSignal;
  callbacks: CloudStreamCallbacks;
}): Promise<void> {
  const { messages, systemInstruction, settings, signal, callbacks } = params;

  if (settings.cloudProvider === 'openai-compatible') {
    await streamOpenAiCompatible({
      endpointUrl: settings.customEndpointUrl,
      modelName: settings.customModelName,
      messages,
      systemInstruction,
      signal,
      callbacks,
    });
    return;
  }

  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: settings.cloudModel,
      thinkingLevel: settings.thinkingDepth,
      systemInstruction,
      messages,
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message =
      typeof errBody?.error === 'string'
        ? errBody.error
        : `Cloud AI returned HTTP ${response.status}.`;
    callbacks.onError(message);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('Streaming response body is unavailable.');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';

      for (const block of lines) {
        const line = block
          .split('\n')
          .find((l) => l.startsWith('data: '));
        if (!line) continue;

        const jsonStr = line.slice('data: '.length).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr) as {
            type: 'chunk' | 'done' | 'error';
            text?: string;
            message?: string;
          };
          if (event.type === 'chunk' && typeof event.text === 'string') {
            callbacks.onChunk(event.text);
          } else if (event.type === 'error') {
            callbacks.onError(event.message || 'Cloud AI streaming failed.');
            return;
          } else if (event.type === 'done') {
            callbacks.onDone();
            return;
          }
        } catch {
          // Ignore malformed partial SSE line
        }
      }
    }

    callbacks.onDone();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      callbacks.onDone();
      return;
    }
    callbacks.onError(error instanceof Error ? error.message : 'Stream interrupted.');
  }
}

async function streamOpenAiCompatible(params: {
  endpointUrl: string;
  modelName: string;
  messages: CloudMessageInput[];
  systemInstruction: string;
  signal: AbortSignal;
  callbacks: CloudStreamCallbacks;
}): Promise<void> {
  const { endpointUrl, modelName, messages, systemInstruction, signal, callbacks } = params;
  const trimmedUrl = endpointUrl.trim();
  if (!trimmedUrl) {
    callbacks.onError('Please configure an OpenAI-compatible endpoint URL in Settings.');
    return;
  }

  const payloadMessages = systemInstruction
    ? [{ role: 'system', content: systemInstruction }, ...messages]
    : messages;

  try {
    const response = await fetch(trimmedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: modelName || 'llama3.2',
        messages: payloadMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      callbacks.onError(`Custom provider returned HTTP ${response.status}. Ensure the endpoint is reachable and CORS-enabled.`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('Custom provider did not return a readable stream.');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          callbacks.onDone();
          return;
        }
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            callbacks.onChunk(delta);
          }
        } catch {
          // Ignore non-JSON lines
        }
      }
    }

    callbacks.onDone();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      callbacks.onDone();
      return;
    }
    callbacks.onError(
      error instanceof Error
        ? `Unable to reach custom endpoint (${error.message}).`
        : 'Unable to reach custom provider endpoint.'
    );
  }
}
