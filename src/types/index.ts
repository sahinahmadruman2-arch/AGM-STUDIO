export type ThemeMode = 'dark' | 'light';
export type LocalDevicePreference = 'auto' | 'webgpu' | 'wasm';
export type LocalModelId =
  | 'HuggingFaceTB/SmolLM2-360M-Instruct'
  | 'HuggingFaceTB/SmolLM2-135M-Instruct';

export interface AttachmentItem {
  id: string;
  kind: 'pdf' | 'txt' | 'html' | 'website';
  name: string;
  content: string;
  sizeBytes?: number;
  wordCount: number;
  charCount: number;
  pageCount?: number;
  pages?: string[];
  url?: string;
  description?: string;
  addedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  model?: string;
  backend?: 'webgpu' | 'wasm' | null;
  attachments?: Array<{
    id: string;
    kind: AttachmentItem['kind'];
    name: string;
    wordCount: number;
    pageCount?: number;
    url?: string;
  }>;
  error?: string;
  isStopped?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  attachments: AttachmentItem[];
  messages: ChatMessage[];
}

export interface AppSettings {
  theme: ThemeMode;
  systemPrompt: string;
  localModelId: LocalModelId;
  localDevicePreference: LocalDevicePreference;
  localMaxTokens: number;
  temperature: number;
}

export type LocalEngineStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error';

export interface LocalEngineState {
  status: LocalEngineStatus;
  backend: 'webgpu' | 'wasm' | null;
  modelId: LocalModelId;
  progressPercent: number;
  progressFile: string;
  progressDetail: string;
  error: string | null;
  isCachedLikely: boolean;
  isSupported: boolean;
}

export interface StorageSummary {
  storageMode: 'indexeddb' | 'memory';
  conversationCount: number;
  messageCount: number;
  indexedDbEstimateBytes: number;
  cacheStorageBytes: number;
  browserQuotaBytes: number | null;
  browserUsageBytes: number | null;
}

export interface BrowserCapabilities {
  webGpu: boolean;
  webAssembly: boolean;
  webWorker: boolean;
  indexedDb: boolean;
  cacheApi: boolean;
  online: boolean;
}
