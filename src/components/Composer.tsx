import { useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  Paperclip,
  Globe,
  Send,
  Square,
  Cloud,
  Cpu,
  X,
  FileText,
  Eye,
  Loader2,
} from 'lucide-react';
import type { AiMode, AttachmentItem, LocalEngineState } from '../types';

interface ComposerProps {
  input: string;
  onChangeInput: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
  isProcessingFile: boolean;
  attachments: AttachmentItem[];
  onUploadFiles: (files: FileList) => void;
  onRemoveAttachment: (id: string) => void;
  onPreviewAttachment: (attachment: AttachmentItem) => void;
  onOpenWebsiteReader: () => void;
  aiMode: AiMode;
  cloudModelLabel: string;
  localState: LocalEngineState;
  onToggleMode: () => void;
}

export function Composer({
  input,
  onChangeInput,
  onSend,
  onStop,
  isGenerating,
  isProcessingFile,
  attachments,
  onUploadFiles,
  onRemoveAttachment,
  onPreviewAttachment,
  onOpenWebsiteReader,
  aiMode,
  cloudModelLabel,
  localState,
  onToggleMode,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && input.trim().length > 0) {
        onSend();
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const canSend = !isGenerating && input.trim().length > 0;

  return (
    <div className="border-t border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#080D1A]/85 backdrop-blur-xl px-3 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto space-y-2.5">
        {/* Attached Documents & Websites Strip */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-100/80 dark:bg-white/[0.05] text-xs text-slate-800 dark:text-slate-200 shrink-0"
              >
                {att.kind === 'website' ? (
                  <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <button
                  type="button"
                  onClick={() => onPreviewAttachment(att)}
                  className="inline-flex items-center gap-1.5 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                  title="Preview extracted content"
                >
                  <span className="max-w-[140px] sm:max-w-[200px] truncate font-medium">
                    {att.name}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {att.pageCount ? `${att.pageCount}p` : `${att.wordCount}w`}
                  </span>
                  <Eye className="w-3 h-3 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(att.id)}
                  className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  aria-label={`Remove ${att.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main Composer Box */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0D1424] focus-within:border-emerald-500/60 dark:focus-within:border-emerald-400/50 focus-within:ring-2 focus-within:ring-emerald-500/15 transition-all shadow-sm">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => onChangeInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              attachments.length > 0
                ? 'Ask a question about your attached documents or websites...'
                : aiMode === 'local'
                  ? 'Message Local AI (SmolLM2-360M runs in your browser)...'
                  : 'Message AGM Studio...'
            }
            aria-label="Message input"
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none max-h-[180px]"
          />

          <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
            <div className="flex items-center gap-1 min-w-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.html,.htm,application/pdf,text/plain,text/html"
                multiple
                onChange={handleFileChange}
                className="hidden"
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile}
                className="min-h-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                title="Upload PDF, TXT, or HTML file"
                aria-label="Attach document"
              >
                {isProcessingFile ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                ) : (
                  <Paperclip className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                )}
                <span className="hidden sm:inline">Document</span>
              </button>

              <button
                type="button"
                onClick={onOpenWebsiteReader}
                className="min-h-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Read public website URL"
                aria-label="Open website reader"
              >
                <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Website</span>
              </button>

              <button
                type="button"
                onClick={onToggleMode}
                className="min-h-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap min-w-0 cursor-pointer"
                title="Click to switch between Cloud AI and Local AI"
                aria-label="Switch AI mode"
              >
                {aiMode === 'local' ? (
                  <>
                    <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate max-w-[110px] sm:max-w-[160px]">
                      Local{localState.backend ? ` · ${localState.backend.toUpperCase()}` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate max-w-[110px] sm:max-w-[170px]">
                      {cloudModelLabel}
                    </span>
                  </>
                )}
              </button>
            </div>

            {isGenerating ? (
              <button
                type="button"
                onClick={onStop}
                className="min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                aria-label="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                className="min-h-[44px] min-w-[44px] px-3.5 sm:px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-white/10 disabled:text-slate-400 dark:disabled:text-slate-500 text-white text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
