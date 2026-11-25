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
  Info,
  Copy,
  Check,
  Sliders,
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
import { copyTextToClipboard } from '../lib/clipboard';
import { isNativeAndroid } from '../lib/capacitor-bridge';
import { Logo } from './Logo';

export type SettingsTab = 'engine' | 'app' | 'storage' | 'about';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: SettingsTab;
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
  initialTab = 'engine',
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
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [storageSummary, setStorageSummary] = useState<StorageSummary | null>(null);
  const [confirmClearType, setConfirmClearType] = useState<'conversations' | 'cache' | 'all' | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      void getStorageSummary().then(setStorageSummary);
    } else {
      setConfirmClearType(null);
      setCopiedJson(false);
    }
  }, [isOpen, initialTab, conversations.length]);

  if (!isOpen) return null;

  const buildExportPayload = () =>
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        app: 'AGM Studio',
        conversations,
      },
      null,
      2
    );

  const handleExportConversations = () => {
    const payload = buildExportPayload();
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agm-studio-chats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleCopyExportJson = async () => {
    const ok = await copyTextToClipboard(buildExportPayload());
    if (ok) {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1800);
    }
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

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Cpu }> = [
    { id: 'engine', label: 'AI Engine', icon: Cpu },
    { id: 'app', label: 'App & Theme', icon: Sliders },
    { id: 'storage', label: 'Storage', icon: Database },
    { id: 'about', label: 'About', icon: Info },
  ];

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
        aria-labelledby="settings-title"
        className="agm-sheet-up relative z-10 w-full sm:max-w-2xl max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0B1120] shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
      >
        {/* Mobile sheet drag handle */}
        <div className="sm:hidden w-10 h-1 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mt-2.5 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-white/10 shrink-0">
          <h2
            id="settings-title"
            className="font-display text-base sm:text-lg font-semibold text-slate-900 dark:text-white"
          >
            AGM Studio Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="agm-press min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] flex items-center gap-1.5 overflow-x-auto shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`agm-press min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'engine' && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Local AI Engine (Transformers.js)
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
                        className="agm-press min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                      >
                        Unload Model
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={localState.status === 'loading'}
                        onClick={onLoadLocalModel}
                        className="agm-press min-h-[40px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        {localState.status === 'loading' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Loading {localState.progressPercent}%</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>
                              {localState.status === 'error' ? 'Retry Initialize' : 'Initialize Model'}
                            </span>
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
                      className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0D1424] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
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
                      className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0D1424] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
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
                    <span>WebGPU: {capabilities.webGpu ? 'Supported' : 'WASM fallback'}</span>
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
                  rows={3}
                  value={settings.systemPrompt}
                  onChange={(e) => onUpdateSettings({ systemPrompt: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#070B14] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Shapes how the local model responds across turns in this workspace.
                </p>
              </label>
            </section>
          )}

          {activeTab === 'app' && (
            <section className="space-y-5">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Theme Selection
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ theme: 'dark' })}
                    className={`agm-press min-h-[48px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer ${
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
                    className={`agm-press min-h-[48px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer ${
                      settings.theme === 'light'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>Clean Light</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#070B14] space-y-2.5 text-xs">
                <h4 className="font-semibold text-slate-900 dark:text-white">Application Details</h4>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Application</span>
                  <span className="font-medium text-slate-900 dark:text-white">AGM Studio</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Version</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-white">1.0.0</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Runtime</span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {isNativeAndroid() ? 'Android Capacitor (com.agmstudio.app)' : 'Browser Web App'}
                  </span>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'storage' && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Local Data &amp; Storage
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
                  className="agm-press min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Chats JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyExportJson}
                  disabled={conversations.length === 0}
                  className="agm-press min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 inline-flex items-center gap-2 cursor-pointer"
                >
                  {copiedJson ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Copied JSON</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Chats JSON</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmClearType('conversations')}
                  disabled={conversations.length === 0}
                  className="agm-press min-h-[44px] px-3.5 py-2 rounded-xl border border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 inline-flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Conversations</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmClearType('cache')}
                  className="agm-press min-h-[44px] px-3.5 py-2 rounded-xl border border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 inline-flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Model Cache</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmClearType('all')}
                  className="agm-press min-h-[44px] px-3.5 py-2 rounded-xl border border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 inline-flex items-center gap-2 cursor-pointer"
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
                        ? 'Remove cached Transformers.js model weights from storage?'
                        : 'Permanently delete all chats, settings, and cached local model weights?'}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmClearType(null)}
                      className="min-h-[38px] px-3 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/10 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmClear}
                      disabled={isClearing}
                      className="min-h-[38px] px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium cursor-pointer"
                    >
                      {isClearing ? 'Clearing...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === 'about' && (
            <section className="space-y-4">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#070B14] flex items-center gap-4">
                <Logo size={48} animated className="shrink-0" />
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    AGM Studio
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Pure Browser &amp; Android Local AI Workspace · Version 1.0.0
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D1424]/70 space-y-2">
                <h4 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  About AGM Studio
                </h4>
                <p className="text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                  AGM Studio is a private, offline-capable AI workspace built for Android and modern browsers. It runs open-weight SmolLM2 models locally via Transformers.js (WebGPU / WebAssembly), stores conversations in IndexedDB, extracts text from PDF, TXT, and HTML files, and reads public CORS-enabled webpages directly without API keys or external servers.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
