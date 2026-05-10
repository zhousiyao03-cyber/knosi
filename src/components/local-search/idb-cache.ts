/**
 * Tiny IndexedDB cache for the wasm-built BM25 index.
 *
 * We keep one DB called `knosi-local-search` with a single `cache` store
 * keyed by user id. Each entry is `{ bytes: Uint8Array, builtAt: number,
 * docCount: number }`. We don't reach for a higher-level wrapper (idb-keyval
 * etc.) — this code is small and runs once per session.
 */

const DB_NAME = "knosi-local-search";
const DB_VERSION = 1;
const STORE_NAME = "cache";

export type CachedIndex = {
  bytes: Uint8Array;
  builtAt: number;
  /** Latest `notes.updatedAt` that contributed to the cached index. */
  freshAs: number;
  docCount: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readCached(userKey: string): Promise<CachedIndex | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise<CachedIndex | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(userKey);
      req.onsuccess = () => resolve((req.result as CachedIndex | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function writeCached(
  userKey: string,
  cached: CachedIndex
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(cached, userKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Cache failures are non-fatal — search still works in-memory.
  }
}

export async function clearCached(userKey: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(userKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}
