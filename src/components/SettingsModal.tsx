import { useEffect, useState } from 'react';
import {
  X,
  Cpu,
  Sun,
  Moon,
  Database,
  Trash2,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type {
  AppSettings,
  BrowserCapabilities,
  Conversation,
  LocalDevicePreference,
  LocalEngineState,
  LocalModelId,
  StorageSummary,
} from '../types';
import {
  clearModelCache,
  formatBytes,
  getStorageSummary,
} from '../lib/database';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  localState: LocalEngineState;
  capabilities: BrowserCapabilities | null;
  onLoadLocalModel: () => void;
  onUnloadLocalModel: () => void;
  conversations: Conversation[];
  onClearConversations: () => Promise<void>;
  onClearAllData: () => Promise<void>;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  localState,
  capabilities,
  onLoadLocalModel,
  onUnloadLocalModel,
  conversations,
  onClearConversations,
  onClearAllData,
}: SettingsModalProps) {
  const [storageSummary, setStorageSummary] = useState<StorageSummary | null>(null);
  const [confirmClearType, setConfirmClearType] = useState<'conversations' | 'cache' | 'all' | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setConfirmClearType(null);
      return;
    }
    void getStorageSummary().then(setStorageSummary);
  }, [isOpen, conversations.length]);

  if (!isOpen) return null;

  const handleExportConversations = () => {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        app: 'AGM Studio',
        conversations,
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agm-studio-chats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmClear = async () => {
    if (!confirmClearType || isClearing) return;
    setIsClearing(true);
    try {
      if (confirmClearType === 'conversations') {
        await onClearConversations();
      } else if (confirmClearType === 'cache') {
        onUnloadLocalModel();
        await clearModelCache();
      } else {
        await onClearAllData();
      }
      setConfirmClearType(null);
      const refreshed = await getStorageSummary();
      setStorageSummary(refreshed);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="relative z-10 w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0B1120] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10">
          <h2
            id="settings-title"
            className="font-display text-base sm:text-lg font-semibold text-slate-900 dark:text-white"
          >
            AGM Studio Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-7">
          {/* 1. Browser AI Engine */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Browser AI Engine (Transformers.js)
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Zero API keys
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#070B14] space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-medium text-slate-900 dark:text-white">
                    Status:{' '}
                    <span className="text-emerald-600 dark:text-emerald-400 capitalize">
                      {localState.status}
                    </span>
                    {localState.backend ? ` (${localState.backend.toUpperCase()})` : ''}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
                    {localState.progressDetail}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {localState.status === 'ready' || localState.status === 'generating' ? (
                    <button
                      type="button"
                      onClick={onUnloadLocalModel}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                    >
                      Unload Model
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={localState.status === 'loading'}
                      onClick={onLoadLocalModel}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {localState.status === 'loading' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading {localState.progressPercent}%</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Initialize Model</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {localState.status === 'loading' && (
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-200"
                    style={{ width: `${Math.max(4, localState.progressPercent)}%` }}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Local Model
                  </span>
                  <select
                    value={settings.localModelId}
                    onChange={(e) =>
                      onUpdateSettings({
                        localModelId: e.target.value as LocalModelId,
                      })
                    }
                    className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0D1424] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="HuggingFaceTB/SmolLM2-360M-Instruct">
                      SmolLM2-360M-Instruct (Balanced · ~260 MB)
                    </option>
                    <option value="HuggingFaceTB/SmolLM2-135M-Instruct">
                      SmolLM2-135M-Instruct (Ultra-Fast · ~110 MB)
                    </option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Compute Backend
                  </span>
                  <select
                    value={settings.localDevicePreference}
                    onChange={(e) =>
                      onUpdateSettings({
                        localDevicePreference: e.target.value as LocalDevicePreference,
                      })
                    }
                    className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0D1424] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="auto">Auto (WebGPU with WASM fallback)</option>
                    <option value="webgpu">Prefer WebGPU</option>
                    <option value="wasm">Force WebAssembly (WASM)</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Max Response Tokens ({settings.localMaxTokens})
                  </span>
                  <input
                    type="range"
                    min={128}
                    max={1024}
                    step={64}
                    value={settings.localMaxTokens}
                    onChange={(e) =>
                      onUpdateSettings({ localMaxTokens: Number(e.target.value) })
                    }
                    className="w-full accent-emerald-600 mt-1.5"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Sampling Temperature ({settings.temperature.toFixed(1)})
                  </span>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.1}
                    value={settings.temperature}
                    onChange={(e) =>
                      onUpdateSettings({ temperature: Number(e.target.value) })
                    }
                    className="w-full accent-emerald-600 mt-1.5"
                  />
                </label>
              </div>

              {capabilities && (
                <div className="pt-2 border-t border-slate-200 dark:border-white/10 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>WebGPU: {capabilities.webGpu ? 'Supported' : 'Unavailable (WASM fallback)'}</span>
                  <span aria-hidden="true">·</span>
                  <span>WebAssembly: {capabilities.webAssembly ? 'Ready' : 'Missing'}</span>
                  <span aria-hidden="true">·</span>
                  <span>Cache API: {capabilities.cacheApi ? 'Ready' : 'Unavailable'}</span>
                  <span aria-hidden="true">·</span>
                  <span>Network: {capabilities.online ? 'Online' : 'Offline'}</span>
                </div>
              )}
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                System Prompt
              </span>
              <textarea
                rows={2}
                value={settings.systemPrompt}
                onChange={(e) => onUpdateSettings({ systemPrompt: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#070B14] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </label>
          </section>

          {/* 2. Appearance */}
          <section className="space-y-3 pt-5 border-t border-slate-200 dark:border-white/10">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Appearance
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'dark' })}
                className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer ${
                  settings.theme === 'dark'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Space Dark</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'light' })}
                className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer ${
                  settings.theme === 'light'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Clean Light</span>
              </button>
            </div>
          </section>

          {/* 3. Local Storage */}
          <section className="space-y-3 pt-5 border-t border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Local Data &amp; Browser Storage
                </h3>
              </div>
              {storageSummary && (
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {storageSummary.storageMode === 'indexeddb' ? 'IndexedDB' : 'Memory Fallback'}
                </span>
              )}
            </div>

            {storageSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070B14]">
                  <p className="text-slate-500 dark:text-slate-400">Chats</p>
                  <p className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                    {storageSummary.conversationCount}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070B14]">
                  <p className="text-slate-500 dark:text-slate-400">Messages</p>
                  <p className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                    {storageSummary.messageCount}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070B14]">
                  <p className="text-slate-500 dark:text-slate-400">Chat Data</p>
                  <p className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatBytes(storageSummary.indexedDbEstimateBytes)}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070B14]">
                  <p className="text-slate-500 dark:text-slate-400">Model Cache</p>
                  <p className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                    {storageSummary.cacheStorageBytes > 0
                      ? formatBytes(storageSummary.cacheStorageBytes)
                      : localState.isCachedLikely
                        ? 'Cached'
                        : '0 B'}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportConversations}
                disabled={conversations.length === 0}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 inline-flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Chats JSON</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmClearType('conversations')}
                disabled={conversations.length === 0}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 inline-flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear Conversations</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmClearType('cache')}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 inline-flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear Model Cache</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmClearType('all')}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 inline-flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Reset All Data</span>
              </button>
            </div>

            {confirmClearType && (
              <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-rose-700 dark:text-rose-200">
                  {confirmClearType === 'conversations'
                    ? 'Permanently delete all saved conversations?'
                    : confirmClearType === 'cache'
                      ? 'Remove cached Transformers.js model weights from browser storage?'
                      : 'Permanently delete all chats, settings, and cached local model weights?'}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmClearType(null)}
                    className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/10 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClear}
                    disabled={isClearing}
                    className="min-h-[36px] px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium cursor-pointer"
                  >
                    {isClearing ? 'Clearing...' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
