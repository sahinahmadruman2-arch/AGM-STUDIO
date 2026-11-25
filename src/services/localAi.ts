import type { LocalDevicePreference, LocalEngineState, LocalModelId } from '../types';
import { formatBytes } from './storage';

export const LOCAL_MODEL_ID: LocalModelId = 'HuggingFaceTB/SmolLM2-360M-Instruct';

type Listener = (state: LocalEngineState) => void;

interface ActiveRequest {
  requestId: string;
  onChunk: (delta: string) => void;
  onDone: (interrupted: boolean) => void;
  onError: (message: string) => void;
}

class LocalAiManager {
  private worker: Worker | null = null;
  private listeners = new Set<Listener>();
  private activeRequest: ActiveRequest | null = null;
  private state: LocalEngineState = {
    status: 'idle',
    backend: null,
    modelId: LOCAL_MODEL_ID,
    progressPercent: 0,
    progressFile: '',
    progressDetail: 'Zero API keys · Downloads once & caches in your browser',
    error: null,
    isCachedLikely: false,
  };

  constructor() {
    void this.checkModelCached();
  }

  private async checkModelCached(modelId = this.state.modelId) {
    try {
      if (typeof caches === 'undefined') return;
      const keys = await caches.keys();
      const cacheKey = keys.find((k) => k.toLowerCase().includes('transformers'));
      if (cacheKey) {
        const cache = await caches.open(cacheKey);
        const entries = await cache.keys();
        const shortName = modelId.split('/').pop() || modelId;
        const hasModel = entries.some((req) => req.url.includes(shortName));
        if (hasModel) {
          this.updateState({
            isCachedLikely: true,
            progressDetail: 'Cached in browser · Click Initialize or send a message',
          });
        }
      }
    } catch {
      // Ignore cache probe failure
    }
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/localAi.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (event: MessageEvent) => this.handleWorkerMessage(event.data);
      this.worker.onerror = (err) => {
        const message = err.message || 'Local AI Web Worker crashed.';
        this.updateState({
          status: 'error',
          error: message,
          progressDetail: message,
        });
        if (this.activeRequest) {
          this.activeRequest.onError(message);
          this.activeRequest = null;
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
        progressDetail: file ? `Downloading ${file}${sizeText}` : 'Preparing local model...',
        error: null,
      });
    } else if (data.type === 'status') {
      const status = data.status as LocalEngineState['status'];
      const backend = (data.backend as LocalEngineState['backend']) ?? this.state.backend;
      const modelId = typeof data.modelId === 'string' ? data.modelId : this.state.modelId;
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
      if (this.activeRequest && data.requestId === this.activeRequest.requestId && typeof data.text === 'string') {
        this.activeRequest.onChunk(data.text);
      }
    } else if (data.type === 'done') {
      if (this.activeRequest && data.requestId === this.activeRequest.requestId) {
        const req = this.activeRequest;
        this.activeRequest = null;
        req.onDone(Boolean(data.interrupted));
      }
    } else if (data.type === 'error') {
      const message = typeof data.message === 'string' ? data.message : 'Local AI error.';
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

  loadModel(devicePreference: LocalDevicePreference, modelId: LocalModelId = LOCAL_MODEL_ID) {
    this.updateState({ modelId });
    const worker = this.ensureWorker();
    worker.postMessage({ type: 'load', modelId, devicePreference });
  }

  generate(params: {
    modelId: LocalModelId;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    maxNewTokens: number;
    devicePreference: LocalDevicePreference;
    onChunk: (delta: string) => void;
    onDone: (interrupted: boolean) => void;
    onError: (message: string) => void;
  }) {
    if (this.activeRequest) {
      this.stop();
    }
    this.updateState({ modelId: params.modelId });
    const worker = this.ensureWorker();
    const requestId = crypto.randomUUID();
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
      devicePreference: params.devicePreference,
    });
  }

  stop() {
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
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
