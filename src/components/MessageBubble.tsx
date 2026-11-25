import { memo, useState } from 'react';
import { Check, Copy, RotateCcw, AlertCircle, FileText, Globe } from 'lucide-react';
import type { ChatMessage } from '../types';
import { copyTextToClipboard } from '../lib/clipboard';
import { Logo } from './Logo';
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

export const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming,
  isLastAssistant,
  onRegenerate,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(message.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end agm-fade-up">
        <div className="max-w-[88%] sm:max-w-[76%] flex flex-col items-end gap-1.5">
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              {message.attachments.map((att) => (
                <span
                  key={att.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white/85 dark:bg-[#0D1424]"
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

          <div className="rounded-2xl rounded-tr-sm px-4 py-3 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-sm shadow-emerald-950/20">
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
    <div className="flex justify-start agm-fade-up">
      <div className="w-full max-w-[97%] sm:max-w-[86%] flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 px-0.5 flex-wrap">
          <span className="inline-flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
            <Logo size={20} className="shrink-0" />
            <span className="font-display">AGM Studio</span>
          </span>
          {message.model && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] truncate max-w-[170px]">{message.model}</span>
            </>
          )}
          {message.backend && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] uppercase">{message.backend}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="font-mono text-[11px] tabular-nums">
            {formatTimestamp(message.createdAt)}
          </span>
        </div>

        <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0D1424]/95 shadow-sm">
          {message.error ? (
            <div className="space-y-3 text-sm text-rose-600 dark:text-rose-400">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="space-y-1 min-w-0">
                  <p className="font-medium">Unable to complete response</p>
                  <p className="text-xs leading-relaxed opacity-90 break-words">{message.error}</p>
                </div>
              </div>
              {isLastAssistant && onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="agm-press min-h-[38px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Response</span>
                </button>
              )}
            </div>
          ) : isStreaming && !message.content ? (
            <div className="flex items-center gap-2.5 py-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="inline-flex gap-1" aria-hidden="true">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.1s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
              </span>
              <span>Generating response...</span>
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
                <p className="mt-2.5 text-xs text-amber-600 dark:text-amber-400">
                  Generation stopped by user.
                </p>
              )}
            </>
          )}
        </div>

        {!isStreaming && (message.content || (isLastAssistant && onRegenerate && !message.error)) && (
          <div className="flex items-center gap-1.5 px-0.5">
            {message.content && (
              <button
                type="button"
                onClick={handleCopy}
                className="agm-press min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] inline-flex items-center gap-1.5 cursor-pointer"
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
            {isLastAssistant && onRegenerate && !message.error && (
              <button
                type="button"
                onClick={onRegenerate}
                className="agm-press min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] inline-flex items-center gap-1.5 cursor-pointer"
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
});
