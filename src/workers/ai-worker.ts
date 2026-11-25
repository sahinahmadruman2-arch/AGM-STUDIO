import {
  env,
  pipeline,
  TextStreamer,
  InterruptableStoppingCriteria,
  type TextGenerationPipeline,
  type ProgressInfo,
} from '@huggingface/transformers';

const DEFAULT_MODEL_ID = 'HuggingFaceTB/SmolLM2-360M-Instruct';

// Configure Transformers.js for pure browser execution & Cache API storage
env.allowLocalModels = false;
env.useBrowserCache = true;

type WorkerInboundMessage =
  | { type: 'load'; modelId?: string; devicePreference: 'auto' | 'webgpu' | 'wasm' }
  | {
      type: 'generate';
      requestId: string;
      modelId?: string;
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      maxNewTokens: number;
      temperature: number;
      devicePreference: 'auto' | 'webgpu' | 'wasm';
    }
  | { type: 'stop' }
  | { type: 'unload' };

let generator: TextGenerationPipeline | null = null;
let loadedModelId: string | null = null;
let activeBackend: 'webgpu' | 'wasm' | null = null;
let loadingPromise: Promise<void> | null = null;
const stoppingCriteria = new InterruptableStoppingCriteria();

function post(payload: Record<string, unknown>) {
  self.postMessage(payload);
}

async function detectWebGpuSupport(): Promise<boolean> {
  try {
    const nav = self.navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown | null> };
    };
    if (!nav?.gpu) return false;
    const adapter = await nav.gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

async function initPipelineWithBackend(modelId: string, backend: 'webgpu' | 'wasm') {
  const fileProgress = new Map<string, { loaded: number; total: number }>();

  const progress_callback = (info: ProgressInfo) => {
    if (info.status === 'progress' && 'file' in info) {
      const loaded = typeof info.loaded === 'number' ? info.loaded : 0;
      const total = typeof info.total === 'number' ? info.total : 0;
      if (total > 0) {
        fileProgress.set(info.file, { loaded, total });
      }
      let sumLoaded = 0;
      let sumTotal = 0;
      fileProgress.forEach((entry) => {
        sumLoaded += entry.loaded;
        sumTotal += entry.total;
      });
      const overall =
        sumTotal > 0
          ? Math.min(99, Math.round((sumLoaded / sumTotal) * 100))
          : Math.round(info.progress ?? 0);
      post({
        type: 'progress',
        status: info.status,
        file: info.file,
        progress: overall,
        loaded: sumLoaded || loaded,
        total: sumTotal || total,
      });
    } else if (info.status === 'initiate' || info.status === 'download' || info.status === 'done') {
      post({
        type: 'progress',
        status: info.status,
        file: 'file' in info ? info.file : '',
      });
    }
  };

  const pipe = (await pipeline('text-generation', modelId, {
    device: backend,
    dtype: 'q4',
    progress_callback,
  })) as TextGenerationPipeline;

  return pipe;
}

function formatLoadError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('offline')) {
    return 'Unable to download model files. The first model download requires internet access to fetch weights from Hugging Face Hub; once cached, offline inference is supported.';
  }
  if (lower.includes('out of memory') || lower.includes('oom') || lower.includes('memory')) {
    return 'Browser ran out of memory while loading this model. Try switching to SmolLM2-135M-Instruct in Settings or closing other browser tabs.';
  }
  return raw || 'Failed to initialize local AI model in browser.';
}

async function ensureModelLoaded(
  requestedModelId: string | undefined,
  devicePreference: 'auto' | 'webgpu' | 'wasm'
): Promise<void> {
  const modelId = requestedModelId || DEFAULT_MODEL_ID;
  const shortName = modelId.split('/').pop() || modelId;

  if (generator && activeBackend && loadedModelId === modelId) {
    if (devicePreference === 'auto' || devicePreference === activeBackend) {
      return;
    }
    await unloadModel();
  } else if (generator && loadedModelId !== modelId) {
    await unloadModel();
  }

  if (loadingPromise) {
    await loadingPromise;
    if (loadedModelId === modelId && generator) return;
  }

  loadingPromise = (async () => {
    post({
      type: 'status',
      status: 'loading',
      modelId,
      backend: null,
      detail: 'Checking browser WebGPU and WebAssembly support...',
    });

    const hasWebGpu = devicePreference !== 'wasm' ? await detectWebGpuSupport() : false;
    const preferredBackend: 'webgpu' | 'wasm' =
      devicePreference === 'wasm'
        ? 'wasm'
        : devicePreference === 'webgpu'
          ? hasWebGpu
            ? 'webgpu'
            : 'wasm'
          : hasWebGpu
            ? 'webgpu'
            : 'wasm';

    try {
      post({
        type: 'status',
        status: 'loading',
        modelId,
        backend: preferredBackend,
        detail:
          preferredBackend === 'webgpu'
            ? `Initializing ${shortName} on WebGPU...`
            : `Initializing ${shortName} on WebAssembly (WASM)...`,
      });

      generator = await initPipelineWithBackend(modelId, preferredBackend);
      loadedModelId = modelId;
      activeBackend = preferredBackend;
      post({
        type: 'status',
        status: 'ready',
        modelId,
        backend: activeBackend,
        detail: `Ready (${activeBackend === 'webgpu' ? 'WebGPU' : 'WASM'})`,
      });
    } catch (err) {
      if (preferredBackend === 'webgpu') {
        post({
          type: 'status',
          status: 'loading',
          modelId,
          backend: 'wasm',
          detail: 'WebGPU initialization failed; falling back to WebAssembly (WASM)...',
        });
        try {
          generator = await initPipelineWithBackend(modelId, 'wasm');
          loadedModelId = modelId;
          activeBackend = 'wasm';
          post({
            type: 'status',
            status: 'ready',
            modelId,
            backend: 'wasm',
            detail: 'Ready (WASM fallback)',
          });
        } catch (wasmErr) {
          throw new Error(formatLoadError(wasmErr));
        }
      } else {
        throw new Error(formatLoadError(err));
      }
    }
  })();

  try {
    await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

async function unloadModel() {
  stoppingCriteria.interrupt();
  if (generator) {
    try {
      const disposable = generator as unknown as { dispose?: () => Promise<void> };
      if (typeof disposable.dispose === 'function') {
        await disposable.dispose();
      }
    } catch {
      // Ignore dispose errors
    }
    generator = null;
  }
  loadedModelId = null;
  activeBackend = null;
  post({
    type: 'status',
    status: 'idle',
    backend: null,
    detail: 'Model unloaded from memory',
  });
}

async function handleGenerate(msg: Extract<WorkerInboundMessage, { type: 'generate' }>) {
  try {
    await ensureModelLoaded(msg.modelId, msg.devicePreference);
    if (!generator) {
      throw new Error('Local AI model failed to initialize.');
    }

    stoppingCriteria.reset();
    post({
      type: 'status',
      status: 'generating',
      modelId: loadedModelId,
      backend: activeBackend,
      detail: `Generating locally (${activeBackend === 'webgpu' ? 'WebGPU' : 'WASM'})...`,
    });

    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        if (text) {
          post({
            type: 'chunk',
            requestId: msg.requestId,
            text,
          });
        }
      },
    });

    const safeTemp = Math.max(0.1, Math.min(1.2, msg.temperature || 0.6));

    await generator(msg.messages, {
      max_new_tokens: Math.max(64, Math.min(1024, msg.maxNewTokens || 512)),
      do_sample: safeTemp > 0.15,
      temperature: safeTemp,
      top_p: 0.9,
      repetition_penalty: 1.12,
      streamer,
      stopping_criteria: [stoppingCriteria],
    });

    post({
      type: 'done',
      requestId: msg.requestId,
      interrupted: stoppingCriteria.interrupted,
    });

    post({
      type: 'status',
      status: 'ready',
      modelId: loadedModelId,
      backend: activeBackend,
      detail: `Ready (${activeBackend === 'webgpu' ? 'WebGPU' : 'WASM'})`,
    });
  } catch (err) {
    const message = formatLoadError(err);
    post({
      type: 'error',
      requestId: msg.requestId,
      message,
    });
    post({
      type: 'status',
      status: generator ? 'ready' : 'error',
      modelId: loadedModelId,
      backend: activeBackend,
      detail: message,
    });
  }
}

self.onmessage = async (event: MessageEvent<WorkerInboundMessage>) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'load') {
    try {
      await ensureModelLoaded(msg.modelId, msg.devicePreference);
    } catch (err) {
      const message = formatLoadError(err);
      post({
        type: 'status',
        status: 'error',
        backend: null,
        detail: message,
      });
    }
  } else if (msg.type === 'generate') {
    await handleGenerate(msg);
  } else if (msg.type === 'stop') {
    stoppingCriteria.interrupt();
  } else if (msg.type === 'unload') {
    await unloadModel();
  }
};
