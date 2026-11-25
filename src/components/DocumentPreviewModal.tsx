import { useEffect, useState } from 'react';
import { FileText, Globe, X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import type { AttachmentItem } from '../types';
import { formatBytes } from '../lib/database';

interface DocumentPreviewModalProps {
  attachment: AttachmentItem | null;
  onClose: () => void;
  onRemove: (id: string) => void;
}

export function DocumentPreviewModal({
  attachment,
  onClose,
  onRemove,
}: DocumentPreviewModalProps) {
  const [selectedPage, setSelectedPage] = useState<number | 'all'>('all');

  useEffect(() => {
    setSelectedPage('all');
  }, [attachment?.id]);

  if (!attachment) return null;

  const hasPages = attachment.kind === 'pdf' && Array.isArray(attachment.pages) && attachment.pages.length > 0;
  const displayedText =
    hasPages && selectedPage !== 'all'
      ? attachment.pages![selectedPage - 1] ?? ''
      : attachment.content;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm agm-backdrop-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-preview-title"
        className="agm-sheet-up relative z-10 w-full sm:max-w-2xl max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0B1120] shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mt-2.5 shrink-0" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            {attachment.kind === 'website' ? (
              <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0">
              <h2
                id="doc-preview-title"
                className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate"
              >
                {attachment.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
                {attachment.kind.toUpperCase()}
                {attachment.sizeBytes ? ` · ${formatBytes(attachment.sizeBytes)}` : ''}
                {attachment.pageCount ? ` · ${attachment.pageCount} pages` : ''}
                {` · ${attachment.wordCount.toLocaleString()} words`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer shrink-0"
            aria-label="Close document preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {hasPages && (
          <div className="px-5 py-2.5 border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedPage(selectedPage === 'all' ? 1 : 'all')}
              className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
            >
              {selectedPage === 'all' ? 'View Page by Page' : 'View All Pages'}
            </button>

            {selectedPage !== 'all' && (
              <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  disabled={selectedPage <= 1}
                  onClick={() => setSelectedPage((p) => (typeof p === 'number' ? Math.max(1, p - 1) : 1))}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 cursor-pointer"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>
                  Page {selectedPage} / {attachment.pages!.length}
                </span>
                <button
                  type="button"
                  disabled={selectedPage >= attachment.pages!.length}
                  onClick={() =>
                    setSelectedPage((p) =>
                      typeof p === 'number' ? Math.min(attachment.pages!.length, p + 1) : 1
                    )
                  }
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 cursor-pointer"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070B14] text-xs sm:text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono">
            {displayedText}
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onRemove(attachment.id);
              onClose();
            }}
            className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Remove from Context</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-medium cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
