import { Code2, FileText, Globe, Cpu, Cloud, ArrowUpRight } from 'lucide-react';
import type { AiMode, LocalEngineState } from '../types';
import { Logo } from './Logo';

interface WelcomeScreenProps {
  aiMode: AiMode;
  cloudModelLabel: string;
  localState: LocalEngineState;
  onSelectPrompt: (prompt: string) => void;
  onOpenDocumentUpload: () => void;
  onOpenWebsiteReader: () => void;
  onSwitchMode: (mode: AiMode) => void;
}

const SUGGESTED_PROMPTS = [
  {
    title: 'Architecture & Code Review',
    prompt: 'Design a clean TypeScript rate limiter using the token bucket algorithm, and explain edge cases to test.',
    icon: Code2,
  },
  {
    title: 'Summarize a Technical Paper',
    prompt: 'I am going to attach a PDF document. Please summarize its key findings, methodology, and open limitations.',
    icon: FileText,
  },
  {
    title: 'Analyze Live Web Docs',
    prompt: 'Explain how WebGPU acceleration improves in-browser Transformer inference compared to WebAssembly.',
    icon: Globe,
  },
  {
    title: 'Offline Reasoning Check',
    prompt: 'Compare pros and cons of running lightweight local LLMs inside the browser versus cloud APIs for privacy-sensitive workflows.',
    icon: Cpu,
  },
];

export function WelcomeScreen({
  aiMode,
  cloudModelLabel,
  localState,
  onSelectPrompt,
  onOpenDocumentUpload,
  onOpenWebsiteReader,
  onSwitchMode,
}: WelcomeScreenProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col items-center justify-center">
      <div className="w-full max-w-3xl mx-auto">
        <div className="flex flex-col items-center text-center mb-8 sm:mb-10">
          <div className="mb-4 relative">
            <div className="absolute -inset-3 rounded-2xl bg-emerald-500/15 blur-xl pointer-events-none" />
            <Logo size={52} className="relative" />
          </div>

          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
            AGM Studio
          </h1>

          <p className="mt-2.5 max-w-xl text-sm sm:text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            Hybrid AI workspace with private in-browser inference (zero API keys required), built-in Cloud AI, local PDF/TXT/HTML parsing, and live website reading.
          </p>

          {/* Interactive Mode Switcher */}
          <div
            className="mt-5 inline-flex items-center gap-1 p-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04]"
            role="group"
            aria-label="Select AI Operating Mode"
          >
            <button
              type="button"
              onClick={() => onSwitchMode('local')}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                aiMode === 'local'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/20'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>
                Local AI · {localState.modelId.split('/').pop()}
                {localState.backend ? ` (${localState.backend.toUpperCase()})` : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onSwitchMode('cloud')}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                aiMode === 'cloud'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/20'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Cloud className="w-4 h-4" />
              <span>Cloud AI · {cloudModelLabel}</span>
            </button>
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
            <span>Read Public Website</span>
          </button>
        </div>
      </div>
    </div>
  );
}
