import type { AppSettings, AttachmentItem, ChatMessage } from '../types';
import { streamCloudResponse } from './cloudAi';
import { localAiManager } from './localAi';

export function buildContextSystemPrompt(
  baseSystemPrompt: string,
  attachments: AttachmentItem[],
  isLocalMode: boolean
): string {
  const parts: string[] = [];
  if (baseSystemPrompt.trim()) {
    parts.push(baseSystemPrompt.trim());
  }

  if (attachments.length > 0) {
    // Keep context concise for SmolLM2-360M local model while giving Cloud AI full context
    const maxTotalContext = isLocalMode ? 3200 : 48000;
    const perItemLimit = Math.floor(maxTotalContext / attachments.length);

    parts.push(
      'The user has provided the following reference materials for this conversation. Ground your answers accurately in these sources and cite the source name when relevant:'
    );

    attachments.forEach((item, index) => {
      const snippet =
        item.content.length > perItemLimit
          ? `${item.content.slice(0, perItemLimit)}\n[...excerpt truncated for context budget]`
          : item.content;

      const meta =
        item.kind === 'website'
          ? `Website URL: ${item.url ?? item.name}`
          : `${item.kind.toUpperCase()} File${item.pageCount ? ` (${item.pageCount} pages)` : ''}`;

      parts.push(`\n[Source ${index + 1}: ${item.name} | ${meta}]\n${snippet}`);
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
  const isLocal = settings.aiMode === 'local';

  const systemInstruction = buildContextSystemPrompt(settings.systemPrompt, attachments, isLocal);

  const history = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim().length > 0)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  if (isLocal) {
    // Keep recent turns compact so SmolLM2-360M stays fast & coherent
    const compactHistory = history.slice(-8);
    const localMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemInstruction },
      ...compactHistory,
    ];

    localAiManager.generate({
      modelId: settings.localModelId,
      messages: localMessages,
      maxNewTokens: settings.localMaxTokens,
      devicePreference: settings.localDevicePreference,
      onChunk,
      onDone,
      onError,
    });

    return () => {
      localAiManager.stop();
    };
  }

  const abortController = new AbortController();
  void streamCloudResponse({
    messages: history,
    systemInstruction,
    settings,
    signal: abortController.signal,
    callbacks: {
      onChunk,
      onDone: () => onDone(abortController.signal.aborted),
      onError,
    },
  });

  return () => {
    abortController.abort();
  };
}

export function deriveConversationTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New Chat';
  return cleaned.length > 44 ? `${cleaned.slice(0, 44).trim()}...` : cleaned;
}
