import type {
  BrowserCapabilities,
  LocalDevicePreference,
  LocalEngineState,
  LocalModelId,
} from '../types';
import { formatBytes } from './database';
import { createId } from './id';

export const DEFAULT_LOCAL_MODEL_ID: LocalModelId = 'HuggingFaceTB/SmolLM2-360M-Instruct';

type Listener = (state: LocalEngineState) => void;

interface ActiveRequest {
  requestId: string;
  onChunk: (delta: string) => void;
  onDone: (interrupted: boolean) => void;
  onError: (message: string) => void;
}

export async function detectBrowserCapabilities(): Promise<BrowserCapabilities> {
  let webGpu = false;
  try {
    const nav = navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown | null> };
    };
    if (nav?.gpu) {
      const adapter = await nav.gpu.requestAdapter();
      webGpu = Boolean(adapter);
    }
  } catch {
    webGpu = false;
  }

  return {
    webGpu,
    webAssembly: typeof WebAssembly === 'object',
    webWorker: typeof Worker !== 'undefined',
    indexedDb: typeof indexedDB !== 'undefined',
    cacheApi: typeof caches !== 'undefined',
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  };
}

class LocalAiManager {
  private worker: Worker | null = null;
  private listeners = new Set<Listener>();
  private activeRequest: ActiveRequest | null = null;
  private state: LocalEngineState = {
    status: 'idle',
    backend: null,
    modelId: DEFAULT_LOCAL_MODEL_ID,
    progressPercent: 0,
    progressFile: '',
    progressDetail: 'Not loaded · First download requires internet, then caches for offline use',
    error: null,
    isCachedLikely: false,
    isSupported: typeof Worker !== 'undefined' && typeof WebAssembly === 'object',
  };

  constructor() {
    void this.checkModelCached();
  }

  async checkModelCached(modelId: LocalModelId = this.state.modelId): Promise<boolean> {
    try {
      if (typeof caches === 'undefined') return false;
      const keys = await caches.keys();
      const cacheKey = keys.find((k) => k.toLowerCase().includes('transformers'));
      if (!cacheKey) return false;
      const cache = await caches.open(cacheKey);
      const entries = await cache.keys();
      const shortName = modelId.split('/').pop() || modelId;
      const hasModel = entries.some((req) => req.url.includes(shortName));
      if (hasModel) {
        this.updateState({
          isCachedLikely: true,
          progressDetail:
            this.state.status === 'idle'
              ? 'Model weights cached in browser · Click Initialize or send a message'
              : this.state.progressDetail,
        });
      }
      return hasModel;
    } catch {
      return false;
    }
  }

  private ensureWorker(): Worker {
    if (!this.state.isSupported) {
      throw new Error(
        'This browser does not support Web Workers and WebAssembly required for local AI inference.'
      );
    }
    if (!this.worker) {
      try {
        this.worker = new Worker(new URL('../workers/ai-worker.ts', import.meta.url), {
          type: 'module',
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? `Failed to start AI Web Worker: ${err.message}`
            : 'Failed to start AI Web Worker.';
        this.updateState({
          status: 'error',
          error: message,
          progressDetail: message,
        });
        throw new Error(message);
      }

      this.worker.onmessage = (event: MessageEvent) => this.handleWorkerMessage(event.data);
      this.worker.onerror = (err) => {
        const message = err.message || 'Local AI Web Worker encountered an error.';
        try {
          this.worker?.terminate();
        } catch {
          // Ignore terminate error
        }
        this.worker = null;
        this.updateState({
          status: 'error',
          backend: null,
          error: message,
          progressDetail: message,
        });
        if (this.activeRequest) {
          const req = this.activeRequest;
          this.activeRequest = null;
          req.onError(message);
        }
      };
    }
    return this.worker;
  }

  private handleWorkerMessage(data: Record<string, unknown>) {
    if (!data || typeof data.type !== 'string') return;

    if (data.type === 'progress') {
      const file = typeof data.file === 'string' ? data.file.split('/').pop() || data.file : '';
      const progress = typeof data.progress === 'number' ? data.progress : this.state.progressPercent;
      const loaded = typeof data.loaded === 'number' ? data.loaded : 0;
      const total = typeof data.total === 'number' ? data.total : 0;

      const sizeText = total > 0 ? ` (${formatBytes(loaded)} / ${formatBytes(total)})` : '';
      this.updateState({
        status: 'loading',
        progressPercent: progress,
        progressFile: file,
        progressDetail: file ? `Downloading ${file}${sizeText}` : 'Preparing model assets...',
        error: null,
      });
    } else if (data.type === 'status') {
      const status = data.status as LocalEngineState['status'];
      const backend =
        'backend' in data
          ? ((data.backend as LocalEngineState['backend']) ?? null)
          : this.state.backend;
      const modelId =
        typeof data.modelId === 'string'
          ? (data.modelId as LocalModelId)
          : this.state.modelId;
      const detail = typeof data.detail === 'string' ? data.detail : '';
      this.updateState({
        status,
        backend,
        modelId,
        progressPercent:
          status === 'ready' || status === 'generating'
            ? 100
            : status === 'idle'
              ? 0
              : this.state.progressPercent,
        progressDetail: detail,
        error: status === 'error' ? detail : null,
        isCachedLikely: status === 'ready' ? true : this.state.isCachedLikely,
      });
    } else if (data.type === 'chunk') {
      if (
        this.activeRequest &&
        data.requestId === this.activeRequest.requestId &&
        typeof data.text === 'string'
      ) {
        this.activeRequest.onChunk(data.text);
      }
    } else if (data.type === 'done') {
      if (this.activeRequest && data.requestId === this.activeRequest.requestId) {
        const req = this.activeRequest;
        this.activeRequest = null;
        req.onDone(Boolean(data.interrupted));
      }
    } else if (data.type === 'error') {
      const message = typeof data.message === 'string' ? data.message : 'Local AI inference error.';
      if (this.activeRequest && data.requestId === this.activeRequest.requestId) {
        const req = this.activeRequest;
        this.activeRequest = null;
        req.onError(message);
      }
    }
  }

  private updateState(patch: Partial<LocalEngineState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }

  getState(): LocalEngineState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  loadModel(devicePreference: LocalDevicePreference, modelId: LocalModelId = DEFAULT_LOCAL_MODEL_ID) {
    this.updateState({ modelId, error: null });
    try {
      const worker = this.ensureWorker();
      worker.postMessage({ type: 'load', modelId, devicePreference });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to initialize local AI.';
      this.updateState({ status: 'error', error: message, progressDetail: message });
    }
  }

  generate(params: {
    modelId: LocalModelId;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    maxNewTokens: number;
    temperature: number;
    devicePreference: LocalDevicePreference;
    onChunk: (delta: string) => void;
    onDone: (interrupted: boolean) => void;
    onError: (message: string) => void;
  }) {
    if (this.activeRequest) {
      this.stop();
    }
    this.updateState({ modelId: params.modelId, error: null });

    let worker: Worker;
    try {
      worker = this.ensureWorker();
    } catch (err) {
      params.onError(err instanceof Error ? err.message : 'Local AI worker unavailable.');
      return;
    }

    const requestId = createId();
    this.activeRequest = {
      requestId,
      onChunk: params.onChunk,
      onDone: params.onDone,
      onError: params.onError,
    };

    worker.postMessage({
      type: 'generate',
      requestId,
      modelId: params.modelId,
      messages: params.messages,
      maxNewTokens: params.maxNewTokens,
      temperature: params.temperature,
      devicePreference: params.devicePreference,
    });
  }

  stop() {
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
    }
    if (this.activeRequest) {
      const req = this.activeRequest;
      this.activeRequest = null;
      req.onDone(true);
    }
  }

  unload() {
    if (this.worker) {
      this.worker.postMessage({ type: 'unload' });
    }
    this.activeRequest = null;
  }
}

export const localAiManager = new LocalAiManager();
