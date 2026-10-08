const KEY = 'bk1:device';
let cached: string | null = null;

/** A browser has no lasting phone ID: a random one kept in this browser stands in for it. */
export async function deviceId(): Promise<string> {
  if (cached !== null) return cached;
  try {
    let id = window.localStorage.getItem(KEY) ?? '';
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      id = 'web-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      window.localStorage.setItem(KEY, id);
    }
    cached = id;
  } catch {
    cached = '';
  }
  return cached;
}
