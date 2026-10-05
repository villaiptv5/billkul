import { beforeEach, describe, expect, it } from 'vitest';
import { memoryKV, type KV } from '../src/data/storage';
import { createStore, type Store } from '../src/data/store';
import { docTotals } from '../src/logic/totals';

let kv: KV;
let store: Store;
const line = (name: string, qty: number, price: number) => ({ id: name, itemId: '', name, unit: 'piece', qty, price });

beforeEach(() => {
  kv = memoryKV();
  store = createStore(kv);
  store.load();
});

describe('setup', () => {
  it('saves the shop and loads sample items for the business type', () => {
    store.completeSetup({ language: 'en', businessType: 'computer', shopName: ' Al-Noor Computers ', phone: '0300 1234567', logo: '' }, true);
    const s = store.getState();
    expect(s.settings.setupDone).toBe(true);
    expect(s.settings.shopName).toBe('Al-Noor Computers');
    expect(s.items.length).toBe(5);
    expect(s.items.every((i) => i.price === 0)).toBe(true);
  });
  it('can be skipped without sample items', () => {
    store.completeSetup({ language: 'ur', businessType: 'other', shopName: '', phone: '', logo: '' }, false);
    expect(store.getState().items.length).toBe(0);
    expect(store.getState().settings.language).toBe('ur');
  });
});

describe('documents', () => {
  it('numbers quotes and invoices separately', () => {
    expect(store.createDoc('quote').number).toBe('Q-0001');
    expect(store.createDoc('quote').number).toBe('Q-0002');
    expect(store.createDoc('invoice').number).toBe('INV-0001');
    expect(store.getState().settings.nextQuote).toBe(3);
  });

  it('gives the number back when a blank document is abandoned', () => {
    const q = store.createDoc('quote');
    expect(store.discardIfEmpty(q.id)).toBe(true);
    expect(store.getState().docs.length).toBe(0);
    expect(store.createDoc('quote').number).toBe('Q-0001');
  });

  it('keeps a document that has content', () => {
    const q = store.createDoc('quote');
    store.saveDoc({ ...q, lines: [line('RAM', 1, 6500)] });
    expect(store.discardIfEmpty(q.id)).toBe(false);
    expect(store.getState().docs.length).toBe(1);
  });

  it('autosaves every change so a restart loses nothing', () => {
    const q = store.createDoc('quote');
    store.saveDoc({ ...q, customerName: 'Bilal Traders', lines: [line('Laptop', 2, 68000)], discount: 1800 });
    const reopened = createStore(kv);
    reopened.load();
    const d = reopened.getState().docs[0];
    expect(d.customerName).toBe('Bilal Traders');
    expect(docTotals(d).total).toBe(134200);
    expect(reopened.getState().settings.nextQuote).toBe(2);
  });

  it('turns a quote into an invoice in one step, once', () => {
    const q = store.createDoc('quote');
    store.saveDoc({ ...q, customerName: 'Usman Electronics', lines: [line('Laptop', 1, 77000)] });
    store.markSent(q.id);
    const inv = store.convertToInvoice(q.id)!;
    expect(inv.number).toBe('INV-0001');
    expect(inv.status).toBe('due');
    expect(inv.customerName).toBe('Usman Electronics');
    expect(docTotals(inv).total).toBe(77000);
    const quote = store.getState().docs.find((d) => d.id === q.id)!;
    expect(quote.status).toBe('accepted');
    expect(quote.invoiceId).toBe(inv.id);
    expect(store.convertToInvoice(q.id)!.id).toBe(inv.id);
    expect(store.getState().docs.length).toBe(2);
  });

  it('marks sent, paid and unpaid', () => {
    const q = store.createDoc('quote');
    store.markSent(q.id);
    expect(store.getState().docs[0].status).toBe('sent');
    const inv = store.createDoc('invoice');
    store.markSent(inv.id);
    expect(store.getState().docs[1].status).toBe('due');
    store.markPaid(inv.id, '2026-10-05');
    expect(store.getState().docs[1].status).toBe('paid');
    expect(store.getState().docs[1].paidOn).toBe('2026-10-05');
    store.markUnpaid(inv.id);
    expect(store.getState().docs[1].status).toBe('due');
  });

  it('unlinks the quote when its invoice is deleted', () => {
    const q = store.createDoc('quote');
    store.saveDoc({ ...q, lines: [line('x', 1, 10)] });
    const inv = store.convertToInvoice(q.id)!;
    store.deleteDoc(inv.id);
    expect(store.getState().docs.length).toBe(1);
    expect(store.getState().docs[0].invoiceId).toBe('');
  });
});

describe('customers and items', () => {
  it('adds, edits and deletes', () => {
    const c = store.saveCustomer({ name: ' Ayesha Khan ', phone: '0301 5556677' });
    expect(c.name).toBe('Ayesha Khan');
    store.saveCustomer({ id: c.id, name: 'Ayesha K.' });
    expect(store.getState().customers).toHaveLength(1);
    expect(store.getState().customers[0].phone).toBe('0301 5556677');
    const item = store.saveItem({ name: 'SSD 256 GB', unit: 'piece', price: 7800 });
    store.saveItem({ id: item.id, name: item.name, price: 8000 });
    expect(store.getState().items[0].price).toBe(8000);
    expect(store.getState().items[0].unit).toBe('piece');
    store.deleteItem(item.id);
    store.deleteCustomer(c.id);
    expect(store.getState().items).toHaveLength(0);
    expect(store.getState().customers).toHaveLength(0);
  });
  it('imports contacts without duplicates', () => {
    store.saveCustomer({ name: 'Hamza Sheikh', phone: '0345-8889900' });
    const added = store.saveCustomers([
      { name: 'Hamza Sheikh', phone: '0345 8889900' },
      { name: 'Sana Boutique', phone: '0300 4445566' },
      { name: '  ', phone: '123' },
    ]);
    expect(added).toBe(1);
    expect(store.getState().customers).toHaveLength(2);
  });
});

describe('backup', () => {
  it('restores everything on a fresh install', () => {
    store.completeSetup({ language: 'en', businessType: 'computer', shopName: 'Al-Noor Computers', phone: '', logo: '' }, true);
    store.saveCustomer({ name: 'Bilal Traders', phone: '0321 7654321' });
    const q = store.createDoc('quote');
    store.saveDoc({ ...q, customerName: 'Bilal Traders', lines: [line('Laptop', 2, 68000)] });
    const backup = store.exportBackup();

    const freshKv = memoryKV();
    const fresh = createStore(freshKv);
    fresh.load();
    expect(fresh.importBackup(backup)).toBe(true);
    expect(fresh.getState().settings.shopName).toBe('Al-Noor Computers');
    expect(fresh.getState().customers).toHaveLength(1);
    expect(fresh.getState().items).toHaveLength(5);
    expect(fresh.getState().docs[0].number).toBe('Q-0001');

    const again = createStore(freshKv);
    again.load();
    expect(again.getState().docs).toHaveLength(1);
    expect(again.createDoc('quote').number).toBe('Q-0002');
  });
  it('refuses a file that is not a BillKul backup', () => {
    expect(store.importBackup('not json')).toBe(false);
    expect(store.importBackup(JSON.stringify({ app: 'other', data: {} }))).toBe(false);
    expect(store.getState().docs).toHaveLength(0);
  });
  it('replaces old documents rather than mixing them', () => {
    const old = store.createDoc('quote');
    store.saveDoc({ ...old, customerName: 'Old' });
    const other = createStore(memoryKV());
    other.load();
    other.completeSetup({ language: 'en', businessType: 'other', shopName: 'New Shop', phone: '', logo: '' }, false);
    expect(store.importBackup(other.exportBackup())).toBe(true);
    expect(store.getState().docs).toHaveLength(0);
    expect(kv.getItem(`bk1:doc:${old.id}`)).toBeNull();
  });
});
