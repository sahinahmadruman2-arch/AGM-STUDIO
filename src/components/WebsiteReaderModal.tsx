import { useState, type FormEvent } from 'react';
import {
  Globe,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
  ClipboardPaste,
} from 'lucide-react';
import {
  extractPastedWebsiteContent,
  fetchWebsiteInBrowser,
  websiteResultToAttachment,
  type WebsiteFetchResult,
} from '../lib/website-reader';
import type { AttachmentItem } from '../types';

interface WebsiteReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttachWebsite: (attachment: AttachmentItem, suggestedQuestion?: string) => void;
}

export function WebsiteReaderModal({
  isOpen,
  onClose,
  onAttachWebsite,
}: WebsiteReaderModalProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'paste'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WebsiteFetchResult | null>(null);

  if (!isOpen) return null;

  const handleFetch = async (e: FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await fetchWebsiteInBrowser(urlInput);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read website.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleParsePasted = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    try {
      const data = extractPastedWebsiteContent(pasteContent, pasteTitle);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to parse pasted content.');
    }
  };

  const handleAttach = (askNow: boolean) => {
    if (!result) return;
    const attachment = websiteResultToAttachment(result);
    onAttachWebsite(
      attachment,
      askNow ? `Summarize the main points from "${result.title}".` : undefined
    );
    setUrlInput('');
    setPasteTitle('');
    setPasteContent('');
    setResult(null);
    setError(null);
    onClose();
  };

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
        aria-labelledby="website-reader-title"
        className="agm-sheet-up relative z-10 w-full sm:max-w-2xl max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0B1120] shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mt-2.5 shrink-0" />
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2
              id="website-reader-title"
              className="font-display text-base font-semibold text-slate-900 dark:text-white"
            >
              Browser Website Reader
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            aria-label="Close website reader"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-5 pt-3 border-b border-slate-200 dark:border-white/10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('url');
              setError(null);
            }}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-medium border-b-2 transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'url'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Fetch Public URL</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('paste');
              setError(null);
            }}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-medium border-b-2 transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'paste'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Paste HTML or Text</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'url' ? (
            <>
              <form onSubmit={handleFetch} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://en.wikipedia.org/api/rest_v1/page/summary/WebGPU"
                  aria-label="Website URL"
                  required
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#070B14] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isLoading || !urlInput.trim()}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Fetching...</span>
                    </>
                  ) : (
                    <span>Fetch in Browser</span>
                  )}
                </button>
              </form>

              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] text-xs text-slate-600 dark:text-slate-400">
                <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <p className="leading-relaxed">
                  Fetches directly from your browser using <span className="font-mono">fetch()</span> and <span className="font-mono">DOMParser</span> with no proxy server. Websites that block cross-origin requests (CORS) will be rejected by your browser—use the <span className="font-medium text-slate-800 dark:text-slate-200">Paste HTML or Text</span> tab for those pages.
                </p>
              </div>
            </>
          ) : (
            <form onSubmit={handleParsePasted} className="space-y-3">
              <input
                type="text"
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                placeholder="Optional page title (e.g. MDN WebGPU Guide)"
                aria-label="Optional page title"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#070B14] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
              <textarea
                rows={5}
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder="Paste article text or HTML source here..."
                aria-label="Paste webpage text or HTML"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#070B14] text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!pasteContent.trim()}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-medium cursor-pointer"
                >
                  Extract Readable Text
                </button>
              </div>
            </form>
          )}

          {error && (
            <div className="space-y-2.5 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs sm:text-sm text-rose-700 dark:text-rose-300">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="leading-relaxed">{error}</p>
              </div>
              {activeTab === 'url' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('paste');
                    setError(null);
                  }}
                  className="text-xs font-medium underline underline-offset-2 hover:text-rose-900 dark:hover:text-white cursor-pointer"
                >
                  Switch to Paste HTML or Text
                </button>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Content extracted in browser</span>
                </div>
                <h3 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                  {result.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums break-all">
                  {result.url} · {result.wordCount.toLocaleString()} words
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                  <span className="font-medium">Extracted Content Preview</span>
                  <span className="font-mono tabular-nums">
                    {result.content.length.toLocaleString()} chars
                  </span>
                </div>
                <div className="max-h-[240px] overflow-y-auto p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070B14] text-xs sm:text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono">
                  {result.content}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {result && (
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => handleAttach(false)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap cursor-pointer"
            >
              Add to Context
            </button>
            <button
              type="button"
              onClick={() => handleAttach(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Add &amp; Summarize</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
