export type AiMode = 'cloud' | 'local';
export type ThemeMode = 'dark' | 'light';
export type CloudProvider = 'gemini' | 'openai-compatible';
export type CloudModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
export type ThinkingDepth = 'LOW' | 'MEDIUM' | 'HIGH';
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
  mode?: AiMode;
  model?: string;
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
  mode: AiMode;
  attachments: AttachmentItem[];
  messages: ChatMessage[];
}

export interface AppSettings {
  aiMode: AiMode;
  theme: ThemeMode;
  cloudProvider: CloudProvider;
  cloudModel: CloudModelId;
  thinkingDepth: ThinkingDepth;
  customEndpointUrl: string;
  customModelName: string;
  systemPrompt: string;
  localModelId: LocalModelId;
  localDevicePreference: LocalDevicePreference;
  localMaxTokens: number;
}

export type LocalEngineStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error';

export interface LocalModelProgress {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

export interface LocalEngineState {
  status: LocalEngineStatus;
  backend: 'webgpu' | 'wasm' | null;
  modelId: string;
  progressPercent: number;
  progressFile: string;
  progressDetail: string;
  error: string | null;
  isCachedLikely: boolean;
}

export interface StorageSummary {
  conversationCount: number;
  messageCount: number;
  indexedDbEstimateBytes: number;
  cacheStorageBytes: number;
  browserQuotaBytes: number | null;
  browserUsageBytes: number | null;
}

export interface CloudHealthInfo {
  cloudAvailable: boolean;
  models: Array<{
    id: CloudModelId;
    label: string;
    description: string;
  }>;
}
