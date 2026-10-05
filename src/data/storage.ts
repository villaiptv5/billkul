/** The small part of the localStorage API the app relies on. */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryKV(seed: Record<string, string> = {}): KV {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/**
 * On the phone, `expo-sqlite/localStorage/install` (imported in index.ts) backs
 * `localStorage` with SQLite. In a browser it is the browser's own storage.
 * If storage is blocked, the app still runs from memory for the session.
 */
export function deviceKV(): KV {
  try {
    const ls = (globalThis as { localStorage?: KV }).localStorage;
    if (ls) {
      ls.setItem('bk1:probe', '1');
      ls.removeItem('bk1:probe');
      return ls;
    }
  } catch {
    // fall through to memory
  }
  return memoryKV();
}
