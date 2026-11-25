import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { clearAllLocalData } from '../lib/database';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AGM Studio ErrorBoundary caught:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetAndReload = async () => {
    try {
      await clearAllLocalData();
    } catch {
      // Ignore cleanup error
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] bg-[#060911] text-slate-100 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1120] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="font-display text-lg font-semibold text-white">
                AGM Studio Recovery
              </h1>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              The interface encountered an unexpected error and prevented a blank screen. Your browser data has not been lost.
            </p>
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-rose-300 break-words">
              {this.state.errorMessage}
            </div>
            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Studio</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Reset Local Data</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
