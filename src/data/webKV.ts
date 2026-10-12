import type { KV } from './storage';

/**
 * Storage for the PC (browser) version. The browser's simple storage (localStorage) holds only
 * about 5 MB, which a busy shop fills within months. This keeps the shop in the browser's database
 * (IndexedDB) instead, which holds hundreds of MB, with a copy in memory so reads stay instant.
 * Everything is read once before the app starts; each change is written in the background.
 */

const DB_NAME = 'billkul';
const TABLE = 'kv';
/** Small keys that stay in localStorage because other code reads them there directly. */
const STAY = new Set(['bk1:gtoken', 'bk1:device']);

let ready: KV | null = null;

/** The PC storage once `loadWebKV` has run, or null (on the phone, and in tests). */
export function webKV(): KV | null {
  return ready;
}

function promised<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(TABLE);
  return promised(request);
}

/** Reads the shop into memory, moving it out of localStorage the first time. Never throws. */
export async function loadWebKV(): Promise<KV | null> {
  if (ready) return ready;
  let db: IDBDatabase;
  const map = new Map<string, string>();
  try {
    db = await openDb();
    const tx = db.transaction(TABLE, 'readonly');
    const store = tx.objectStore(TABLE);
    const [keys, values] = await Promise.all([promised(store.getAllKeys()), promised(store.getAll())]);
    keys.forEach((k, i) => map.set(String(k), String(values[i])));
  } catch {
    return null; // No database in this browser: the app carries on with localStorage.
  }

  // First start after the update: bring the shop over from localStorage, then free that space.
  try {
    const old: [string, string][] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('bk1:') && !STAY.has(key)) old.push([key, localStorage.getItem(key) ?? '']);
    }
    if (old.length) {
      const tx = db.transaction(TABLE, 'readwrite');
      const store = tx.objectStore(TABLE);
      for (const [k, v] of old) {
        if (!map.has(k)) {
          map.set(k, v);
          store.put(v, k);
        }
      }
      await done(tx);
      for (const [k] of old) localStorage.removeItem(k);
    }
  } catch {
    // Left in localStorage; the next start tries again.
  }

  // Ask the browser not to clear the shop when the disk runs low.
  try {
    void navigator.storage?.persist?.();
  } catch {
    // Not offered by this browser.
  }

  const pending = new Map<string, string | null>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (!pending.size) return;
    const batch = [...pending];
    pending.clear();
    try {
      const tx = db.transaction(TABLE, 'readwrite');
      const store = tx.objectStore(TABLE);
      for (const [k, v] of batch) {
        if (v === null) store.delete(k);
        else store.put(v, k);
      }
    } catch {
      // The tab is closing; nothing more can be done.
    }
  };
  const queue = (key: string, value: string | null) => {
    pending.set(key, value);
    if (!timer) timer = setTimeout(flush, 0);
  };
  // Write anything still waiting when the tab is hidden or closed.
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());

  ready = {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, String(v));
      queue(k, String(v));
    },
    removeItem: (k) => {
      map.delete(k);
      queue(k, null);
    },
  };
  return ready;
}
