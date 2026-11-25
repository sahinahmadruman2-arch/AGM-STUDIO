import { useState } from 'react';
import { Check, Copy, RotateCcw, AlertCircle, FileText, Globe, Cpu } from 'lucide-react';
import type { ChatMessage } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming: boolean;
  isLastAssistant: boolean;
  onRegenerate?: () => void;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MessageBubble({
  message,
  isStreaming,
  isLastAssistant,
  onRegenerate,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] sm:max-w-[78%] flex flex-col items-end gap-1.5">
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              {message.attachments.map((att) => (
                <span
                  key={att.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04]"
                >
                  {att.kind === 'website' ? (
                    <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}
                  <span className="truncate max-w-[180px]">{att.name}</span>
                </span>
              ))}
            </div>
          )}

          <div className="rounded-2xl rounded-tr-sm px-4 py-3 bg-emerald-600 text-white dark:bg-emerald-600/90 dark:text-white shadow-sm">
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>

          <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-500 px-1">
            {formatTimestamp(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[96%] sm:max-w-[86%] flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 px-1 flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>AGM Studio</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>Browser AI</span>
          {message.model && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] truncate max-w-[180px]">{message.model}</span>
            </>
          )}
          {message.backend && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] uppercase">{message.backend}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="font-mono text-[11px] tabular-nums">{formatTimestamp(message.createdAt)}</span>
        </div>

        <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#0D1424]/85 backdrop-blur-md">
          {message.error ? (
            <div className="flex items-start gap-2.5 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">Local inference error</p>
                <p className="text-xs leading-relaxed opacity-90">{message.error}</p>
              </div>
            </div>
          ) : isStreaming && !message.content ? (
            <div className="flex items-center gap-2.5 py-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.1s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
              </span>
              <span>Preparing response in Web Worker...</span>
            </div>
          ) : (
            <>
              <MarkdownRenderer content={message.content} />
              {isStreaming && (
                <span
                  className="inline-block w-2 h-4 ml-1 align-middle bg-emerald-500/80 animate-pulse"
                  aria-hidden="true"
                />
              )}
              {message.isStopped && !isStreaming && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Generation stopped by user.
                </p>
              )}
            </>
          )}
        </div>

        {!isStreaming && (
          <div className="flex items-center gap-2 px-1">
            {message.content && (
              <button
                type="button"
                onClick={handleCopy}
                className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                aria-label="Copy response"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
            {isLastAssistant && onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                aria-label="Regenerate response"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
