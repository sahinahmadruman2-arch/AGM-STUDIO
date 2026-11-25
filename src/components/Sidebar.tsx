import { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Pencil,
  Trash2,
  Check,
  X,
  Cloud,
  Cpu,
  Sun,
  Moon,
  Settings,
  Search,
} from 'lucide-react';
import type { AiMode, Conversation, LocalEngineState, ThemeMode } from '../types';
import { Logo } from './Logo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  aiMode: AiMode;
  theme: ThemeMode;
  localState: LocalEngineState;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onChangeMode: (mode: AiMode) => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  aiMode,
  theme,
  localState,
  onNewChat,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onChangeMode,
  onToggleTheme,
  onOpenSettings,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : conversations;

  const startEditing = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const commitEdit = () => {
    if (editingId && editingTitle.trim()) {
      onRenameConversation(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const sidebarContent = (
    <aside className="w-[280px] h-full flex flex-col border-r border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#080D1A]/95 backdrop-blur-xl select-none">
      {/* Top Brand + New Chat */}
      <div className="p-4 border-b border-slate-200 dark:border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo size={30} className="shrink-0" />
            <span className="font-display text-base font-semibold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              AGM Studio
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onNewChat();
            onClose();
          }}
          className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors shadow-sm shadow-emerald-950/20 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>New Chat</span>
        </button>
      </div>

      {/* AI Mode Selector */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium">AI Engine Mode</span>
          <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
            {aiMode === 'cloud'
              ? 'Cloud'
              : localState.status === 'ready' || localState.status === 'generating'
                ? localState.backend?.toUpperCase() || 'Local'
                : localState.status === 'loading'
                  ? `${localState.progressPercent}%`
                  : 'Local'}
          </span>
        </div>

        <div
          className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10"
          role="group"
          aria-label="AI Engine Mode"
        >
          <button
            type="button"
            onClick={() => onChangeMode('cloud')}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              aiMode === 'cloud'
                ? 'bg-white dark:bg-[#131C31] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Cloud AI</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('local')}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              aiMode === 'local'
                ? 'bg-white dark:bg-[#131C31] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Local AI</span>
          </button>
        </div>

        {aiMode === 'local' && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">
                {localState.modelId.split('/').pop() || 'SmolLM2-360M-Instruct'}
              </span>
              <span className="font-mono tabular-nums shrink-0">
                {localState.status === 'loading'
                  ? `${localState.progressPercent}%`
                  : localState.status === 'ready'
                    ? 'Ready'
                    : localState.status === 'generating'
                      ? 'Active'
                      : localState.status === 'error'
                        ? 'Error'
                        : localState.isCachedLikely
                          ? 'Cached'
                          : 'Standby'}
              </span>
            </div>
            {localState.status === 'loading' && (
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${Math.max(4, localState.progressPercent)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conversation Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            aria-label="Search conversations"
            className="w-full min-h-[38px] pl-8 pr-3 py-1.5 rounded-lg text-xs bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500/60"
          />
        </div>
      </div>

      {/* Conversation History List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-1 space-y-1">
        {filteredConversations.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-500">
            {conversations.length === 0
              ? 'No conversations yet. Start a new chat above.'
              : 'No matching conversations.'}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isEditing = editingId === conv.id;

            return (
              <div
                key={conv.id}
                className={`group relative rounded-xl transition-colors ${
                  isActive
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30'
                    : 'border border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-1 p-1.5">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                      className="flex-1 min-w-0 px-2 py-1 text-xs rounded-md bg-white dark:bg-[#0D1424] border border-emerald-500/50 text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={commitEdit}
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                      aria-label="Save title"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      aria-label="Cancel rename"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectConversation(conv.id);
                        onClose();
                      }}
                      className="flex-1 min-w-0 min-h-[44px] px-3 py-2 text-left flex items-center gap-2.5 cursor-pointer"
                    >
                      <MessageSquare
                        className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-medium truncate ${
                            isActive
                              ? 'text-slate-900 dark:text-white'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {conv.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-500 font-mono tabular-nums truncate">
                          {conv.messages.length} msgs ·{' '}
                          {new Date(conv.updatedAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center pr-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => startEditing(conv)}
                        className="min-h-[36px] min-w-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 cursor-pointer"
                        aria-label={`Rename ${conv.title}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteConversation(conv.id)}
                        className="min-h-[36px] min-w-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        aria-label={`Delete ${conv.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Theme & Settings Controls */}
      <div className="p-3 border-t border-slate-200 dark:border-white/10 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onToggleTheme}
          className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-700 shrink-0" />
              <span>Dark</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenSettings();
            onClose();
          }}
          className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Settings className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <div className="hidden lg:block h-full shrink-0">{sidebarContent}</div>

      {/* Mobile slide-over drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full max-w-[85vw]">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
