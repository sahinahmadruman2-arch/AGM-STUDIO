import type { AppSettings, Conversation, StorageSummary } from '../types';

const DB_NAME = 'agm-studio-db';
const DB_VERSION = 1;
const STORE_CONVERSATIONS = 'conversations';
const STORE_SETTINGS = 'settings';
const SETTINGS_KEY = 'app-settings';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  systemPrompt:
    'You are AGM Studio, a helpful AI assistant running locally in the user browser. Keep answers clear, concise, and grounded in any attached context. If a request exceeds what a compact local model can reliably verify, state that honestly.',
  localModelId: 'HuggingFaceTB/SmolLM2-360M-Instruct',
  localDevicePreference: 'auto',
  localMaxTokens: 512,
  temperature: 0.6,
};

// In-memory fallback when IndexedDB is unavailable (e.g., restricted private browsing)
const memoryConversations = new Map<string, Conversation>();
let memorySettings: AppSettings | null = null;
let storageMode: 'indexeddb' | 'memory' = 'indexeddb';

export function getStorageMode(): 'indexeddb' | 'memory' {
  return storageMode;
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore storage persistence errors on unsupported WebViews
  }
  return false;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this browser context.'));
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Failed to open IndexedDB.'));
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        const convStore = db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' });
        convStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      storageMode = 'indexeddb';
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const db = await openDatabase();
    return await new Promise<AppSettings>((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get(SETTINGS_KEY);
      req.onsuccess = () => {
        const stored = req.result?.value as Partial<AppSettings> | undefined;
        resolve({ ...DEFAULT_SETTINGS, ...(stored ?? {}) });
      };
      req.onerror = () => resolve({ ...DEFAULT_SETTINGS });
      tx.oncomplete = () => db.close();
    });
  } catch {
    storageMode = 'memory';
    return memorySettings ? { ...DEFAULT_SETTINGS, ...memorySettings } : { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  memorySettings = { ...settings };
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.put({ key: SETTINGS_KEY, value: settings });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('Failed to save settings.'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    storageMode = 'memory';
  }
}

export async function listConversations(): Promise<Conversation[]> {
  try {
    const db = await openDatabase();
    return await new Promise<Conversation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_CONVERSATIONS, 'readonly');
      const store = tx.objectStore(STORE_CONVERSATIONS);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as Conversation[]) ?? [];
        items.sort((a, b) => b.updatedAt - a.updatedAt);
        items.forEach((c) => memoryConversations.set(c.id, c));
        resolve(items);
      };
      req.onerror = () => reject(req.error ?? new Error('Failed to load conversations.'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    storageMode = 'memory';
    return Array.from(memoryConversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  memoryConversations.set(conversation.id, conversation);
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite');
      const store = tx.objectStore(STORE_CONVERSATIONS);
      const req = store.put(conversation);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('Failed to save conversation.'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    storageMode = 'memory';
  }
}

export async function deleteConversation(id: string): Promise<void> {
  memoryConversations.delete(id);
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite');
      const store = tx.objectStore(STORE_CONVERSATIONS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('Failed to delete conversation.'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    storageMode = 'memory';
  }
}

export async function clearAllConversations(): Promise<void> {
  memoryConversations.clear();
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite');
      const store = tx.objectStore(STORE_CONVERSATIONS);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('Failed to clear conversations.'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    storageMode = 'memory';
  }
}

export async function clearModelCache(): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.toLowerCase().includes('transformers'))
        .map((k) => caches.delete(k))
    );
  } catch {
    // Ignore cache clear failure
  }
}

export async function clearAllLocalData(): Promise<void> {
  memoryConversations.clear();
  memorySettings = null;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_CONVERSATIONS, STORE_SETTINGS], 'readwrite');
      tx.objectStore(STORE_CONVERSATIONS).clear();
      tx.objectStore(STORE_SETTINGS).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Failed to clear local data.'));
      };
    });
  } catch {
    storageMode = 'memory';
  }
  await clearModelCache();
}

export async function getStorageSummary(): Promise<StorageSummary> {
  const conversations = await listConversations();
  const messageCount = conversations.reduce((sum, c) => sum + c.messages.length, 0);
  const serialized = JSON.stringify(conversations);
  const indexedDbEstimateBytes = new Blob([serialized]).size;

  let cacheStorageBytes = 0;
  try {
    if (typeof caches !== 'undefined') {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (!name.toLowerCase().includes('transformers')) continue;
        const cache = await caches.open(name);
        const requests = await cache.keys();
        for (const req of requests) {
          const resp = await cache.match(req);
          if (resp) {
            const cl = resp.headers.get('content-length');
            if (cl && !Number.isNaN(Number(cl))) {
              cacheStorageBytes += Number(cl);
            }
          }
        }
      }
    }
  } catch {
    cacheStorageBytes = 0;
  }

  let browserQuotaBytes: number | null = null;
  let browserUsageBytes: number | null = null;
  try {
    if (navigator.storage && typeof navigator.storage.estimate === 'function') {
      const est = await navigator.storage.estimate();
      browserQuotaBytes = typeof est.quota === 'number' ? est.quota : null;
      browserUsageBytes = typeof est.usage === 'number' ? est.usage : null;
    }
  } catch {
    // Ignore storage estimate failure
  }

  return {
    storageMode,
    conversationCount: conversations.length,
    messageCount,
    indexedDbEstimateBytes,
    cacheStorageBytes,
    browserQuotaBytes,
    browserUsageBytes,
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return `${value >= 10 || exp === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exp]}`;
}
