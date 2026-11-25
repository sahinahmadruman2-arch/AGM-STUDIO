import { Code2, FileText, Globe, Cpu, ArrowUpRight, Download, CheckCircle2, Info } from 'lucide-react';
import type { LocalEngineState } from '../types';
import { Logo } from './Logo';

interface WelcomeScreenProps {
  localState: LocalEngineState;
  onSelectPrompt: (prompt: string) => void;
  onOpenDocumentUpload: () => void;
  onOpenWebsiteReader: () => void;
  onInitializeModel: () => void;
}

const SUGGESTED_PROMPTS = [
  {
    title: 'JavaScript Code Helper',
    prompt: 'Write a concise JavaScript function to debounce user input and explain how it works.',
    icon: Code2,
  },
  {
    title: 'Summarize Attached PDF',
    prompt: 'Summarize the main topics and key takeaways from the document I attached.',
    icon: FileText,
  },
  {
    title: 'Explain WebGPU vs WASM',
    prompt: 'Briefly explain the difference between WebGPU and WebAssembly for running AI models in a browser.',
    icon: Cpu,
  },
  {
    title: 'Analyze Webpage Excerpt',
    prompt: 'Extract the main conclusions and action items from the website content I added.',
    icon: Globe,
  },
];

export function WelcomeScreen({
  localState,
  onSelectPrompt,
  onOpenDocumentUpload,
  onOpenWebsiteReader,
  onInitializeModel,
}: WelcomeScreenProps) {
  const modelShortName = localState.modelId.split('/').pop() || 'SmolLM2-360M-Instruct';

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 sm:py-10 flex flex-col items-center justify-center">
      <div className="w-full max-w-3xl mx-auto">
        <div className="flex flex-col items-center text-center mb-7 sm:mb-9">
          <div className="mb-4 relative">
            <div className="absolute -inset-3 rounded-2xl bg-emerald-500/15 blur-xl pointer-events-none" />
            <Logo size={52} className="relative" />
          </div>

          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
            AGM Studio
          </h1>

          <p className="mt-2.5 max-w-xl text-sm sm:text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            Pure browser-based AI workspace powered locally by{' '}
            <span className="font-mono text-xs sm:text-[13px] text-slate-800 dark:text-slate-200">
              {modelShortName}
            </span>
            . Zero API keys, zero backend servers—all chats, PDF/TXT/HTML parsing, and inference stay in your browser.
          </p>

          {/* Local Model Initialization Strip */}
          <div className="mt-5 w-full max-w-xl p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0D1424]/80 text-left space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                {localState.status === 'ready' || localState.status === 'generating' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <span>
                  {localState.status === 'ready'
                    ? `Local Engine Ready (${localState.backend?.toUpperCase() ?? 'Browser'})`
                    : localState.status === 'loading'
                      ? `Downloading & Initializing (${localState.progressPercent}%)`
                      : localState.isCachedLikely
                        ? 'Model Cached in Browser'
                        : 'Local Browser Model Standby'}
                </span>
              </div>

              {(localState.status === 'idle' || localState.status === 'error') && (
                <button
                  type="button"
                  onClick={onInitializeModel}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{localState.isCachedLikely ? 'Load Model' : 'Download & Load'}</span>
                </button>
              )}
            </div>

            {localState.status === 'loading' && (
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${Math.max(4, localState.progressPercent)}%` }}
                />
              </div>
            )}

            <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
              <p>
                First download requires internet access (~260 MB) and caches in your browser for offline use. As a compact 360M-parameter model, it excels at concise Q&amp;A and document summaries rather than large cloud-scale reasoning.
              </p>
            </div>
          </div>
        </div>

        {/* Suggested Prompts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {SUGGESTED_PROMPTS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => onSelectPrompt(item.prompt)}
                className="group text-left p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0D1424]/70 hover:border-emerald-500/50 dark:hover:border-emerald-400/40 hover:bg-white dark:hover:bg-[#111A2E] transition-all cursor-pointer flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{item.title}</span>
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
                </div>
                <p className="text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2">
                  {item.prompt}
                </p>
              </button>
            );
          })}
        </div>

        {/* Quick Context Tools */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenDocumentUpload}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] hover:border-emerald-500/40 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Upload PDF, TXT, or HTML</span>
          </button>
          <button
            type="button"
            onClick={onOpenWebsiteReader}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] hover:border-emerald-500/40 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Read Website (CORS)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
