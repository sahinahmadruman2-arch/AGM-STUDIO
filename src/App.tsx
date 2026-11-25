import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Menu,
  Globe,
  Eraser,
  Settings as SettingsIcon,
  AlertCircle,
  X,
  ArrowDown,
  WifiOff,
  RotateCcw,
} from 'lucide-react';
import type {
  AppSettings,
  AttachmentItem,
  BrowserCapabilities,
  ChatMessage,
  Conversation,
  LocalEngineState,
} from './types';
import {
  DEFAULT_SETTINGS,
  clearAllConversations,
  clearAllLocalData,
  deleteConversation,
  getStorageMode,
  listConversations,
  loadSettings,
  requestPersistentStorage,
  saveConversation,
  saveSettings,
} from './lib/database';
import {
  hideNativeSplash,
  initNativeBridge,
  registerAndroidBackHandler,
  syncNativeSystemBars,
} from './lib/capacitor-bridge';
import { createId } from './lib/id';
import { detectBrowserCapabilities, localAiManager } from './lib/local-ai';
import { deriveConversationTitle, generateAssistantReply } from './lib/chat-engine';
import { processUploadedDocument } from './lib/document-reader';
import { Sidebar } from './components/Sidebar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { MessageBubble } from './components/MessageBubble';
import { Composer } from './components/Composer';
import { WebsiteReaderModal } from './components/WebsiteReaderModal';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { SettingsModal, type SettingsTab } from './components/SettingsModal';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draftAttachments, setDraftAttachments] = useState<AttachmentItem[]>([]);
  const [input, setInput] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  const [localState, setLocalState] = useState<LocalEngineState>(() => localAiManager.getState());
  const [capabilities, setCapabilities] = useState<BrowserCapabilities | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isWebsiteReaderOpen, setIsWebsiteReaderOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('engine');
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const stopRef = useRef<(() => void) | null>(null);
  const activeGenTokenRef = useRef(0);
  const isSubmittingRef = useRef(false);
  const rafUpdateRef = useRef<number | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const streamingContentRef = useRef('');

  useEffect(() => {
    let mounted = true;
    void initNativeBridge();

    (async () => {
      try {
        void requestPersistentStorage();
        const [loadedSettings, loadedConvs, caps] = await Promise.all([
          loadSettings(),
          listConversations(),
          detectBrowserCapabilities(),
        ]);
        if (!mounted) return;
        setSettings(loadedSettings);
        setConversations(loadedConvs);
        setCapabilities(caps);
        if (loadedConvs.length > 0) {
          setActiveConversationId(loadedConvs[0].id);
        }
        if (getStorageMode() === 'memory') {
          setStorageWarning(
            'IndexedDB is restricted in this session. Chats will stay available until the app closes.'
          );
        }
        void localAiManager.checkModelCached(loadedSettings.localModelId);
      } catch (err) {
        if (mounted) {
          setBannerError(
            err instanceof Error ? err.message : 'Failed to initialize local workspace storage.'
          );
        }
      } finally {
        if (mounted) {
          setIsHydrated(true);
          void hideNativeSplash();
        }
      }
    })();

    const unsubscribe = localAiManager.subscribe((state) => {
      setLocalState(state);
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (rafUpdateRef.current !== null) {
        cancelAnimationFrame(rafUpdateRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    void syncNativeSystemBars(settings.theme);
  }, [settings.theme]);

  const backStateRef = useRef({
    previewAttachment,
    isWebsiteReaderOpen,
    isSettingsOpen,
    isSidebarOpen,
  });

  useEffect(() => {
    backStateRef.current = {
      previewAttachment,
      isWebsiteReaderOpen,
      isSettingsOpen,
      isSidebarOpen,
    };
  }, [previewAttachment, isWebsiteReaderOpen, isSettingsOpen, isSidebarOpen]);

  useEffect(() => {
    return registerAndroidBackHandler(() => {
      const state = backStateRef.current;
      if (state.previewAttachment) {
        setPreviewAttachment(null);
        return true;
      }
      if (state.isWebsiteReaderOpen) {
        setIsWebsiteReaderOpen(false);
        return true;
      }
      if (state.isSettingsOpen) {
        setIsSettingsOpen(false);
        return true;
      }
      if (state.isSidebarOpen) {
        setIsSidebarOpen(false);
        return true;
      }
      return false;
    });
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const currentAttachments = activeConversation
    ? activeConversation.attachments
    : draftAttachments;

  const openSettings = useCallback((tab: SettingsTab = 'engine') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettings(next);
      if (patch.localModelId) {
        void localAiManager.checkModelCached(patch.localModelId);
      }
      return next;
    });
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 84;
    shouldAutoScrollRef.current = isNearBottom;
    setShowScrollBottom(!isNearBottom && el.scrollHeight > el.clientHeight + 100);
  }, []);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom(isGenerating ? 'auto' : 'smooth');
    }
  }, [activeConversation?.messages.length, isGenerating, scrollToBottom]);

  const persistConversationUpdate = useCallback((conv: Conversation) => {
    setConversations((prev) => {
      const exists = prev.some((c) => c.id === conv.id);
      const updated = exists
        ? prev.map((c) => (c.id === conv.id ? conv : c))
        : [conv, ...prev];
      return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
    });
    void saveConversation(conv);
  }, []);

  const abortActiveGeneration = useCallback(() => {
    activeGenTokenRef.current += 1;
    if (rafUpdateRef.current !== null) {
      cancelAnimationFrame(rafUpdateRef.current);
      rafUpdateRef.current = null;
    }
    if (stopRef.current) {
      const stopFn = stopRef.current;
      stopRef.current = null;
      stopFn();
    }
    setIsGenerating(false);
    setStreamingMessageId(null);
    isSubmittingRef.current = false;
  }, []);

  const handleNewChat = useCallback(() => {
    if (isGenerating) {
      abortActiveGeneration();
    }
    setActiveConversationId(null);
    setDraftAttachments([]);
    setBannerError(null);
  }, [isGenerating, abortActiveGeneration]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (id === activeConversationId) return;
      if (isGenerating) {
        abortActiveGeneration();
      }
      setActiveConversationId(id);
      setBannerError(null);
      shouldAutoScrollRef.current = true;
    },
    [activeConversationId, isGenerating, abortActiveGeneration]
  );

  const handleRenameConversation = useCallback(
    (id: string, title: string) => {
      const target = conversations.find((c) => c.id === id);
      if (!target) return;
      const updated: Conversation = {
        ...target,
        title,
        updatedAt: Date.now(),
      };
      persistConversationUpdate(updated);
    },
    [conversations, persistConversationUpdate]
  );

  const handleDeleteConversation = useCallback(
    (id: string) => {
      if (id === activeConversationId && isGenerating) {
        abortActiveGeneration();
      }
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (id === activeConversationId) {
          setActiveConversationId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
      void deleteConversation(id);
    },
    [activeConversationId, isGenerating, abortActiveGeneration]
  );

  const handleClearCurrentChat = useCallback(() => {
    if (!activeConversation || isGenerating) return;
    const cleared: Conversation = {
      ...activeConversation,
      messages: [],
      updatedAt: Date.now(),
    };
    persistConversationUpdate(cleared);
  }, [activeConversation, isGenerating, persistConversationUpdate]);

  const handleAttachItem = useCallback(
    (item: AttachmentItem) => {
      if (activeConversation) {
        const updated: Conversation = {
          ...activeConversation,
          attachments: [...activeConversation.attachments, item],
          updatedAt: Date.now(),
        };
        persistConversationUpdate(updated);
      } else {
        setDraftAttachments((prev) => [...prev, item]);
      }
    },
    [activeConversation, persistConversationUpdate]
  );

  const handleRemoveAttachment = useCallback(
    (id: string) => {
      if (activeConversation) {
        const updated: Conversation = {
          ...activeConversation,
          attachments: activeConversation.attachments.filter((a) => a.id !== id),
          updatedAt: Date.now(),
        };
        persistConversationUpdate(updated);
      } else {
        setDraftAttachments((prev) => prev.filter((a) => a.id !== id));
      }
    },
    [activeConversation, persistConversationUpdate]
  );

  const handleUploadFiles = useCallback(
    async (files: FileList) => {
      setIsProcessingFile(true);
      setBannerError(null);
      try {
        for (const file of Array.from(files)) {
          const item = await processUploadedDocument(file);
          handleAttachItem(item);
        }
      } catch (err) {
        setBannerError(
          err instanceof Error ? err.message : 'Unable to process uploaded document.'
        );
      } finally {
        setIsProcessingFile(false);
      }
    },
    [handleAttachItem]
  );

  const runAssistantGeneration = useCallback(
    (convSnapshot: Conversation, assistantMessageId: string) => {
      const genToken = ++activeGenTokenRef.current;
      setIsGenerating(true);
      setStreamingMessageId(assistantMessageId);
      setBannerError(null);
      shouldAutoScrollRef.current = true;
      streamingContentRef.current = '';

      const historyForModel = convSnapshot.messages.filter(
        (m) => m.id !== assistantMessageId
      );

      let latestConv = convSnapshot;

      const patchAssistantMessage = (patch: Partial<ChatMessage>, persist: boolean) => {
        latestConv = {
          ...latestConv,
          updatedAt: Date.now(),
          messages: latestConv.messages.map((m) =>
            m.id === assistantMessageId ? { ...m, ...patch } : m
          ),
        };
        setConversations((prev) =>
          prev
            .map((c) => (c.id === latestConv.id ? latestConv : c))
            .sort((a, b) => b.updatedAt - a.updatedAt)
        );
        if (persist) {
          void saveConversation(latestConv);
        }
      };

      const flushStreamingContent = () => {
        rafUpdateRef.current = null;
        if (activeGenTokenRef.current !== genToken) return;
        patchAssistantMessage(
          {
            content: streamingContentRef.current,
            backend: localAiManager.getState().backend,
          },
          false
        );
        if (shouldAutoScrollRef.current) {
          scrollToBottom('auto');
        }
      };

      const stop = generateAssistantReply({
        messages: historyForModel,
        attachments: convSnapshot.attachments,
        settings,
        onContent: (fullText) => {
          if (activeGenTokenRef.current !== genToken) return;
          streamingContentRef.current = fullText;
          if (rafUpdateRef.current === null) {
            rafUpdateRef.current = requestAnimationFrame(flushStreamingContent);
          }
        },
        onDone: (interrupted, finalText) => {
          if (rafUpdateRef.current !== null) {
            cancelAnimationFrame(rafUpdateRef.current);
            rafUpdateRef.current = null;
          }
          const finalContent = finalText || streamingContentRef.current;
          if (activeGenTokenRef.current === genToken) {
            setIsGenerating(false);
            setStreamingMessageId(null);
            stopRef.current = null;
            isSubmittingRef.current = false;
          }
          patchAssistantMessage(
            {
              content: finalContent,
              backend: localAiManager.getState().backend,
              isStopped: interrupted,
            },
            true
          );
        },
        onError: (errMsg) => {
          if (rafUpdateRef.current !== null) {
            cancelAnimationFrame(rafUpdateRef.current);
            rafUpdateRef.current = null;
          }
          if (activeGenTokenRef.current === genToken) {
            setIsGenerating(false);
            setStreamingMessageId(null);
            stopRef.current = null;
            isSubmittingRef.current = false;
          }
          patchAssistantMessage(
            {
              content: streamingContentRef.current,
              error: errMsg,
            },
            true
          );
        },
      });

      stopRef.current = stop;
    },
    [settings, scrollToBottom]
  );

  const sendPrompt = useCallback(
    (promptText: string, extraAttachment?: AttachmentItem) => {
      const trimmed = promptText.trim();
      if (!trimmed || isGenerating || isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      try {
        const now = Date.now();
        const baseAttachments = activeConversation
          ? [...activeConversation.attachments]
          : [...draftAttachments];
        if (extraAttachment) {
          baseAttachments.push(extraAttachment);
        }

        const userMessage: ChatMessage = {
          id: createId(),
          role: 'user',
          content: trimmed,
          createdAt: now,
          attachments: baseAttachments.map((a) => ({
            id: a.id,
            kind: a.kind,
            name: a.name,
            wordCount: a.wordCount,
            pageCount: a.pageCount,
            url: a.url,
          })),
        };

        const assistantId = createId();
        const localModelShort = settings.localModelId.split('/').pop() || 'SmolLM2-360M-Instruct';
        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: now + 1,
          model: localModelShort,
          backend: localState.backend,
        };

        let targetConv: Conversation;
        if (activeConversation) {
          targetConv = {
            ...activeConversation,
            title:
              activeConversation.messages.length === 0
                ? deriveConversationTitle(trimmed)
                : activeConversation.title,
            attachments: baseAttachments,
            messages: [...activeConversation.messages, userMessage, assistantMessage],
            updatedAt: now,
          };
        } else {
          targetConv = {
            id: createId(),
            title: deriveConversationTitle(trimmed),
            createdAt: now,
            updatedAt: now,
            attachments: baseAttachments,
            messages: [userMessage, assistantMessage],
          };
          setDraftAttachments([]);
          setActiveConversationId(targetConv.id);
        }

        setInput('');
        persistConversationUpdate(targetConv);
        runAssistantGeneration(targetConv, assistantId);
      } catch (err) {
        isSubmittingRef.current = false;
        setBannerError(err instanceof Error ? err.message : 'Unable to send message.');
      }
    },
    [
      isGenerating,
      activeConversation,
      draftAttachments,
      settings.localModelId,
      localState.backend,
      persistConversationUpdate,
      runAssistantGeneration,
    ]
  );

  const handleRegenerate = useCallback(() => {
    if (
      !activeConversation ||
      isGenerating ||
      isSubmittingRef.current ||
      activeConversation.messages.length === 0
    ) {
      return;
    }

    const messages = [...activeConversation.messages];
    const last = messages[messages.length - 1];
    if (last.role === 'assistant') {
      messages.pop();
    }

    const assistantId = createId();
    const localModelShort = settings.localModelId.split('/').pop() || 'SmolLM2-360M-Instruct';
    const newAssistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      model: localModelShort,
      backend: localState.backend,
    };

    const updatedConv: Conversation = {
      ...activeConversation,
      messages: [...messages, newAssistantMsg],
      updatedAt: Date.now(),
    };

    persistConversationUpdate(updatedConv);
    runAssistantGeneration(updatedConv, assistantId);
  }, [
    activeConversation,
    isGenerating,
    settings.localModelId,
    localState.backend,
    persistConversationUpdate,
    runAssistantGeneration,
  ]);

  const handleStop = useCallback(() => {
    abortActiveGeneration();
  }, [abortActiveGeneration]);

  const handleAttachWebsite = useCallback(
    (attachment: AttachmentItem, suggestedQuestion?: string) => {
      if (suggestedQuestion) {
        sendPrompt(suggestedQuestion, attachment);
      } else {
        handleAttachItem(attachment);
      }
    },
    [handleAttachItem, sendPrompt]
  );

  const handleClearAllConversations = useCallback(async () => {
    if (isGenerating) abortActiveGeneration();
    await clearAllConversations();
    setConversations([]);
    setActiveConversationId(null);
    setDraftAttachments([]);
  }, [isGenerating, abortActiveGeneration]);

  const handleResetAllLocalData = useCallback(async () => {
    if (isGenerating) abortActiveGeneration();
    localAiManager.unload();
    await clearAllLocalData();
    setConversations([]);
    setActiveConversationId(null);
    setDraftAttachments([]);
    setSettings({ ...DEFAULT_SETTINGS });
  }, [isGenerating, abortActiveGeneration]);

  const modelShortName = settings.localModelId.split('/').pop() || 'SmolLM2-360M-Instruct';
  const messages = activeConversation?.messages ?? [];
  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  }, [messages]);

  return (
    <div className="h-[100dvh] w-full flex overflow-hidden agm-space-canvas text-slate-900 dark:text-slate-100">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        theme={settings.theme}
        localState={localState}
        isOnline={isOnline}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onInitializeModel={() =>
          localAiManager.loadModel(settings.localDevicePreference, settings.localModelId)
        }
        onToggleTheme={() =>
          updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
        }
        onOpenSettings={openSettings}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col h-full relative">
        {/* Top Bar */}
        <header className="min-h-14 pt-[env(safe-area-inset-top)] px-3 sm:px-6 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#080D1A]/85 backdrop-blur-xl flex items-center justify-between gap-3 shrink-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="agm-press lg:hidden min-h-[44px] min-w-[44px] -ml-1.5 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer shrink-0"
              aria-label="Open navigation sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0 flex items-center gap-2">
              <h2 className="font-display text-sm sm:text-[15px] font-semibold text-slate-900 dark:text-white truncate max-w-[180px] sm:max-w-[340px]">
                {activeConversation ? activeConversation.title : 'AGM Studio'}
              </h2>
              <span className="hidden md:inline text-xs text-slate-400" aria-hidden="true">
                ·
              </span>
              <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400 truncate whitespace-nowrap">
                {modelShortName}
                {localState.backend ? ` (${localState.backend.toUpperCase()})` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isOnline && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 px-2">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsWebsiteReaderOpen(true)}
              className="agm-press min-h-[42px] min-w-[42px] px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              aria-label="Open Website Reader"
            >
              <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Website Reader</span>
            </button>

            {activeConversation && messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearCurrentChat}
                disabled={isGenerating}
                className="agm-press min-h-[42px] min-w-[42px] sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-40"
                title="Clear messages in this conversation"
                aria-label="Clear conversation"
              >
                <Eraser className="w-4 h-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => openSettings('engine')}
              className="agm-press lg:hidden min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
              aria-label="Open settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Local Model Downloading Banner */}
        {localState.status === 'loading' && (
          <div className="px-4 py-2 border-b border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3 shrink-0">
            <span className="truncate">{localState.progressDetail}</span>
            <span className="font-mono tabular-nums font-medium shrink-0">
              {localState.progressPercent}%
            </span>
          </div>
        )}

        {/* Storage Fallback Notice */}
        {storageWarning && (
          <div className="px-4 py-2 border-b border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3 shrink-0">
            <span className="truncate">{storageWarning}</span>
            <button
              type="button"
              onClick={() => setStorageWarning(null)}
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg hover:bg-amber-500/15 cursor-pointer shrink-0"
              aria-label="Dismiss storage notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error Banner */}
        {bannerError && (
          <div className="px-4 py-2.5 border-b border-rose-500/30 bg-rose-500/10 text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{bannerError}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {localState.status === 'error' && (
                <button
                  type="button"
                  onClick={() => {
                    setBannerError(null);
                    localAiManager.loadModel(settings.localDevicePreference, settings.localModelId);
                  }}
                  className="min-h-[32px] px-2.5 rounded-lg bg-rose-600 text-white text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setBannerError(null)}
                className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg hover:bg-rose-500/15 cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Messages Feed or Welcome Screen */}
        {!isHydrated ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            Loading AGM Studio...
          </div>
        ) : messages.length === 0 ? (
          <WelcomeScreen
            localState={localState}
            onSelectPrompt={(prompt) => sendPrompt(prompt)}
            onOpenDocumentUpload={() => fileInputRef.current?.click()}
            onOpenWebsiteReader={() => setIsWebsiteReaderOpen(true)}
            onInitializeModel={() =>
              localAiManager.loadModel(settings.localDevicePreference, settings.localModelId)
            }
          />
        ) : (
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-5 sm:py-7 relative"
          >
            <div className="max-w-3xl mx-auto space-y-6 pb-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={isGenerating && msg.id === streamingMessageId}
                  isLastAssistant={msg.id === lastAssistantId}
                  onRegenerate={msg.id === lastAssistantId ? handleRegenerate : undefined}
                />
              ))}
            </div>

            {showScrollBottom && (
              <button
                type="button"
                onClick={() => {
                  shouldAutoScrollRef.current = true;
                  scrollToBottom('smooth');
                }}
                className="agm-press fixed bottom-28 right-5 sm:right-8 z-30 min-h-[44px] min-w-[44px] rounded-full border border-slate-200 dark:border-white/15 bg-white/95 dark:bg-[#111827]/95 shadow-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                aria-label="Scroll to latest messages"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Composer */}
        <Composer
          input={input}
          onChangeInput={setInput}
          onSend={() => sendPrompt(input)}
          onStop={handleStop}
          isGenerating={isGenerating}
          isProcessingFile={isProcessingFile}
          attachments={currentAttachments}
          onUploadFiles={handleUploadFiles}
          onRemoveAttachment={handleRemoveAttachment}
          onPreviewAttachment={setPreviewAttachment}
          onOpenWebsiteReader={() => setIsWebsiteReaderOpen(true)}
          localState={localState}
          onOpenSettings={() => openSettings('engine')}
          fileInputRef={fileInputRef}
        />
      </div>

      {/* Modals */}
      <WebsiteReaderModal
        isOpen={isWebsiteReaderOpen}
        onClose={() => setIsWebsiteReaderOpen(false)}
        onAttachWebsite={handleAttachWebsite}
      />

      <DocumentPreviewModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        onRemove={handleRemoveAttachment}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        initialTab={settingsTab}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        localState={localState}
        capabilities={capabilities}
        onLoadLocalModel={() =>
          localAiManager.loadModel(settings.localDevicePreference, settings.localModelId)
        }
        onUnloadLocalModel={() => localAiManager.unload()}
        conversations={conversations}
        onClearConversations={handleClearAllConversations}
        onClearAllData={handleResetAllLocalData}
      />
    </div>
  );
}
