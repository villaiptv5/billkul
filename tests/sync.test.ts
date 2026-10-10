import { describe, expect, it } from 'vitest';
import { memoryKV } from '../src/data/storage';
import { createStore, type Store, type SyncRecord } from '../src/data/store';
import { createSync, type SyncServer } from '../src/sync/engine';

/** The account server's sync routes, in memory: one row per record, numbered changes. */
function fakeServer(): SyncServer & { rows: Map<string, { rev: number; record: SyncRecord }> } {
  let rev = 0;
  const rows = new Map<string, { rev: number; record: SyncRecord }>();
  return {
    rows,
    async push(_token, changes) {
      for (const c of changes) rows.set(`${c.kind}:${c.id}`, { rev: ++rev, record: JSON.parse(JSON.stringify(c)) });
      return { ok: true, rev };
    },
    async pull(_token, since) {
      const list = [...rows.values()].filter((r) => r.rev > since).sort((a, b) => a.rev - b.rev);
      const page = list.slice(0, 400);
      return { ok: true, changes: page.map((r) => JSON.parse(JSON.stringify(r.record))), rev: page.length === list.length ? rev : page[page.length - 1].rev, more: list.length > 400 };
    },
  };
}

const account = { phone: '+923001234567', token: 't'.repeat(64), plan: 'pro' as const, proUntil: '', limits: { docs: 10, cash: 10 }, supportWhatsapp: '' };

function device(server: SyncServer, setup = true) {
  const kv = memoryKV();
  const store = createStore(kv);
  store.load();
  store.signIn(account);
  if (setup) store.completeSetup({ language: 'en', businessType: 'other', shopName: 'Al Noor', phone: '0300', logo: '' }, false);
  return { store, sync: createSync(store, kv, server) };
}

const invoice = (store: Store, price: number) => {
  const d = store.createDoc('invoice', '2026-10-10');
  return store.saveDoc({ ...d, lines: [{ id: 'l', itemId: '', name: 'Fan', unit: '', qty: 1, price }] });
};

describe('sync between a phone and a PC', () => {
  it('a new PC takes the whole shop from the phone, set-up included', async () => {
    const server = fakeServer();
    const phone = device(server);
    invoice(phone.store, 5000);
    phone.store.saveCustomer({ name: 'Ali', phone: '' });
    phone.store.saveCash({ kind: 'in', amount: 1000 });
    expect(await phone.sync.syncNow()).toBe('ok');

    const pc = device(server, false);
    expect(pc.store.getState().settings.setupDone).toBe(false);
    expect(await pc.sync.syncNow()).toBe('ok');
    const s = pc.store.getState();
    expect(s.settings.setupDone).toBe(true);
    expect(s.settings.shopName).toBe('Al Noor');
    expect(s.docs).toHaveLength(1);
    expect(s.customers.map((c) => c.name)).toEqual(['Ali']);
    expect(s.cash).toHaveLength(1);
    // nothing sent back that was not changed
    const before = server.rows.size;
    await pc.sync.syncNow();
    expect(server.rows.size).toBe(before);
  });

  it('carries edits and deletions both ways', async () => {
    const server = fakeServer();
    const phone = device(server);
    const doc = invoice(phone.store, 5000);
    await phone.sync.syncNow();
    const pc = device(server, false);
    await pc.sync.syncNow();

    pc.store.markPaid(doc.id, '2026-10-10');
    await pc.sync.syncNow();
    await phone.sync.syncNow();
    expect(phone.store.getState().docs[0].status).toBe('paid');

    phone.store.deleteDoc(doc.id);
    await phone.sync.syncNow();
    await pc.sync.syncNow();
    expect(pc.store.getState().docs).toHaveLength(0);
  });

  it('keeps a change made here when the other side changed the same record too: the later push wins', async () => {
    const server = fakeServer();
    const phone = device(server);
    const doc = invoice(phone.store, 5000);
    await phone.sync.syncNow();
    const pc = device(server, false);
    await pc.sync.syncNow();

    phone.store.saveDoc({ ...phone.store.getState().docs[0], notes: 'from phone' });
    pc.store.saveDoc({ ...pc.store.getState().docs[0], notes: 'from pc' });
    await phone.sync.syncNow();
    await pc.sync.syncNow(); // the PC pushes after the phone: its version wins
    await phone.sync.syncNow();
    expect(phone.store.getState().docs.find((d) => d.id === doc.id)?.notes).toBe('from pc');
    expect(pc.store.getState().docs.find((d) => d.id === doc.id)?.notes).toBe('from pc');
  });

  it('never hands out a document number twice after syncing', async () => {
    const server = fakeServer();
    const phone = device(server);
    invoice(phone.store, 1);
    invoice(phone.store, 2);
    await phone.sync.syncNow();
    const pc = device(server, false);
    await pc.sync.syncNow();
    expect(invoice(pc.store, 3).number).toBe('INV-0003');
  });

  it('a device being set up sends nothing, and a Free account does not sync', async () => {
    const server = fakeServer();
    const fresh = device(server, false);
    await fresh.sync.syncNow();
    expect(server.rows.size).toBe(0);
    const free = device(server);
    free.store.updateAccount({ plan: 'free' });
    expect(await free.sync.syncNow()).toBe('not_pro');
    expect(server.rows.size).toBe(0);
  });

  it('pulls a long list in pages', async () => {
    const server = fakeServer();
    const phone = device(server);
    for (let i = 0; i < 950; i++) phone.store.saveCustomer({ name: `C${i}`, phone: '' });
    await phone.sync.syncNow();
    const pc = device(server, false);
    await pc.sync.syncNow();
    expect(pc.store.getState().customers).toHaveLength(950);
  });
});
