import type { KV } from '../data/storage';
import type { Store, SyncKind, SyncRecord } from '../data/store';

/**
 * Keeps a phone and a PC signed in to the same Pro account showing the same shop.
 *
 * Every record (a document, customer, item, cash entry, stock entry, and the shop settings) is pushed to
 * our server when it changes here, and records changed elsewhere are pulled in. The server numbers every
 * change; this device remembers the last number it has seen, and a fingerprint of each record as last
 * agreed with the server, so it only sends what really changed. When both sides changed the same record
 * since the last round, the change pushed last wins.
 */

export type SyncResult = 'ok' | 'idle' | 'offline' | 'not_pro' | 'signed_out' | 'busy';

export interface SyncServer {
  push(token: string, changes: SyncRecord[]): Promise<{ ok: true; rev: number } | { ok: false; error: string }>;
  pull(token: string, since: number): Promise<{ ok: true; changes: SyncRecord[]; rev: number; more: boolean } | { ok: false; error: string }>;
}

interface Memory {
  /** Whose records these are: a different account starts again. */
  phone: string;
  rev: number;
  /** Fingerprint of each record as the server last had it, by "kind:id". */
  sent: Record<string, string>;
}

const KEY = 'bk1:sync';
const BATCH = 300;
const BATCH_BYTES = 3 * 1024 * 1024;

/** A short fingerprint of a text (FNV-1a, 32 bits, twice over with different seeds). */
export function fingerprint(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

export interface SyncStatus {
  /** ISO time of the last round that reached the server, or ''. */
  lastAt: string;
  result: SyncResult;
}

export function createSync(store: Store, kv: KV, server: SyncServer) {
  let running = false;
  let again = false;
  let status: SyncStatus = { lastAt: '', result: 'idle' };
  const listeners = new Set<() => void>();
  const setStatus = (next: Partial<SyncStatus>) => {
    status = { ...status, ...next };
    listeners.forEach((fn) => fn());
  };

  const read = (phone: string): Memory => {
    try {
      const saved = JSON.parse(kv.getItem(KEY) ?? 'null') as Memory | null;
      if (saved && saved.phone === phone && typeof saved.rev === 'number' && saved.sent) return saved;
    } catch {
      // start again
    }
    return { phone, rev: 0, sent: {} };
  };
  const write = (m: Memory) => kv.setItem(KEY, JSON.stringify(m));

  const snapshot = () => {
    const out = new Map<string, { record: SyncRecord; print: string }>();
    for (const [key, record] of store.syncRecords()) out.set(key, { record, print: fingerprint(JSON.stringify(record.body)) });
    return out;
  };

  async function round(): Promise<SyncResult> {
    const { account, settings } = store.getState();
    if (!account) return 'idle';
    if (account.plan !== 'pro') return 'not_pro';
    const token = account.token;
    const memory = read(account.phone);

    // 1. Send what changed here. A device still being set up sends nothing: it takes the shop from the others.
    if (settings.setupDone) {
      const now = snapshot();
      const out: { record: SyncRecord; key: string; print: string | null }[] = [];
      for (const [key, { record, print }] of now) if (memory.sent[key] !== print) out.push({ record, key, print });
      for (const key of Object.keys(memory.sent)) {
        if (!now.has(key)) {
          const at = key.indexOf(':');
          out.push({ record: { kind: key.slice(0, at) as SyncKind, id: key.slice(at + 1), body: null }, key, print: null });
        }
      }
      let i = 0;
      while (i < out.length) {
        const batch: typeof out = [];
        let bytes = 0;
        while (i < out.length && batch.length < BATCH) {
          const size = JSON.stringify(out[i].record.body ?? null).length + 80;
          if (batch.length && bytes + size > BATCH_BYTES) break;
          batch.push(out[i]);
          bytes += size;
          i++;
        }
        const result = await server.push(token, batch.map((b) => b.record));
        if (!result.ok) return failure(result.error, memory);
        for (const b of batch) {
          if (b.print === null) delete memory.sent[b.key];
          else memory.sent[b.key] = b.print;
        }
        write(memory);
      }
    }

    // 2. Take in what changed elsewhere, page by page.
    for (let page = 0; page < 1000; page++) {
      const result = await server.pull(token, memory.rev);
      if (!result.ok) return failure(result.error, memory);
      // Read again: something may have been changed here while the request was out.
      const here = snapshot();
      const take: SyncRecord[] = [];
      for (const change of result.changes) {
        const key = `${change.kind}:${change.id}`;
        const local = here.get(key);
        const dirty = local ? memory.sent[key] !== local.print : key in memory.sent;
        // A record changed here and not sent yet keeps its own version; it goes out in the next round and wins.
        if (dirty && memory.sent[key] !== undefined) continue;
        if (change.body === null) {
          delete memory.sent[key];
          if (local) take.push(change);
          continue;
        }
        const print = fingerprint(JSON.stringify(change.body));
        memory.sent[key] = print;
        if (!local || local.print !== print) take.push(change);
      }
      store.applySyncRecords(take);
      memory.rev = result.rev;
      write(memory);
      if (!result.more) break;
    }
    return 'ok';
  }

  function failure(error: string, memory: Memory): SyncResult {
    write(memory);
    if (error === 'not_pro') return 'not_pro';
    if (error === 'signed_out') return 'signed_out';
    return 'offline';
  }

  /** One round of sending and taking in. Asked again while busy, it runs once more afterwards. */
  async function syncNow(): Promise<SyncResult> {
    if (running) {
      again = true;
      return 'busy';
    }
    running = true;
    let result: SyncResult = 'idle';
    try {
      do {
        again = false;
        result = await round();
      } while (again && result === 'ok');
    } catch {
      result = 'offline';
    } finally {
      running = false;
    }
    setStatus(result === 'ok' ? { result, lastAt: new Date().toISOString() } : { result });
    return result;
  }

  return {
    syncNow,
    getStatus: () => status,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    /** Forgets what was agreed with the server, so the next round sends everything again. */
    reset: () => kv.removeItem(KEY),
  };
}

export type Sync = ReturnType<typeof createSync>;
