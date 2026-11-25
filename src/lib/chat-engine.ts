import type { AppSettings, AttachmentItem, ChatMessage } from '../types';
import { localAiManager } from './local-ai';

export function buildContextSystemPrompt(
  baseSystemPrompt: string,
  attachments: AttachmentItem[]
): string {
  const parts: string[] = [];
  if (baseSystemPrompt.trim()) {
    parts.push(baseSystemPrompt.trim());
  }

  if (attachments.length > 0) {
    // Budget context cleanly for compact local model memory & latency
    const maxTotalContext = 3200;
    const perItemLimit = Math.floor(maxTotalContext / attachments.length);

    parts.push(
      'Reference materials provided by the user. Answer based accurately on these excerpts and mention if information is not present in the provided text:'
    );

    attachments.forEach((item, index) => {
      const snippet =
        item.content.length > perItemLimit
          ? `${item.content.slice(0, perItemLimit)}\n[...truncated for local context window]`
          : item.content;

      const meta =
        item.kind === 'website'
          ? `Website: ${item.url ?? item.name}`
          : `${item.kind.toUpperCase()} File${item.pageCount ? ` (${item.pageCount} pages)` : ''}`;

      parts.push(`[Source ${index + 1}: ${item.name} | ${meta}]\n${snippet}`);
    });
  }

  return parts.join('\n\n');
}

export interface GenerateReplyParams {
  messages: ChatMessage[];
  attachments: AttachmentItem[];
  settings: AppSettings;
  onChunk: (delta: string) => void;
  onDone: (interrupted: boolean) => void;
  onError: (message: string) => void;
}

export function generateAssistantReply(params: GenerateReplyParams): () => void {
  const { messages, attachments, settings, onChunk, onDone, onError } = params;

  const systemInstruction = buildContextSystemPrompt(settings.systemPrompt, attachments);

  // Keep recent turns compact so SmolLM2-360M-Instruct remains fast & coherent
  const compactHistory = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim().length > 0)
    .slice(-8)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const localMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemInstruction },
    ...compactHistory,
  ];

  localAiManager.generate({
    modelId: settings.localModelId,
    messages: localMessages,
    maxNewTokens: settings.localMaxTokens,
    temperature: settings.temperature,
    devicePreference: settings.localDevicePreference,
    onChunk,
    onDone,
    onError,
  });

  return () => {
    localAiManager.stop();
  };
}

export function deriveConversationTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New Chat';
  return cleaned.length > 44 ? `${cleaned.slice(0, 44).trim()}...` : cleaned;
}
