import { beforeEach, describe, expect, it } from 'vitest';
import { memoryKV, type KV } from '../src/data/storage';
import { createStore, type Store } from '../src/data/store';
import { cashInHand, cashRows, expenseSummary, monthCash, shiftMonth } from '../src/logic/ledger';
import { lowStockItems, stockHistory, stockLevels, stockState } from '../src/logic/stock';

let kv: KV;
let store: Store;

beforeEach(() => {
  kv = memoryKV();
  store = createStore(kv);
  store.load();
});

const rows = () => cashRows(store.getState());
const levels = () => stockLevels(store.getState().items, store.getState().stockMoves, store.getState().docs);

function invoiceFor(itemId: string, name: string, qty: number, price: number, date = '2026-10-06') {
  const doc = store.createDoc('invoice', date);
  return store.saveDoc({ ...doc, customerName: 'Bilal Traders', lines: [{ id: 'l1', itemId, name, unit: 'piece', qty, price }] });
}

describe('cash book', () => {
  it('adds money in and money out to the cash in hand', () => {
    store.saveCash({ kind: 'in', amount: 20000, date: '2026-10-01', note: 'Opening cash' });
    store.saveCash({ kind: 'out', amount: 3500, date: '2026-10-02', category: 'bills', note: 'Electricity' });
    expect(cashInHand(rows())).toBe(16500);
    expect(monthCash(rows(), '2026-10')).toEqual({ in: 20000, out: 3500 });
    expect(monthCash(rows(), '2026-09')).toEqual({ in: 0, out: 0 });
  });

  it('counts an invoice as money in only once it is paid, on the day it was paid', () => {
    const invoice = invoiceFor('', 'Laptop', 1, 77000, '2026-09-28');
    store.markSent(invoice.id);
    expect(cashInHand(rows())).toBe(0);
    store.markPaid(invoice.id, '2026-10-03');
    const [row] = rows();
    expect(row).toMatchObject({ kind: 'in', amount: 77000, source: 'invoice', date: '2026-10-03', label: 'INV-0001', note: 'Bilal Traders' });
    store.markUnpaid(invoice.id);
    expect(rows()).toHaveLength(0);
  });

  it('edits and deletes an entry', () => {
    const entry = store.saveCash({ kind: 'out', amount: 500, category: 'food' });
    store.saveCash({ id: entry.id, kind: 'out', amount: 650, category: 'food', note: 'Tea' });
    expect(store.getState().cash).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ amount: 650, note: 'Tea', category: 'food' });
    store.deleteCash(entry.id);
    expect(rows()).toHaveLength(0);
  });

  it('lists newest first and keeps an unknown category under Other', () => {
    store.saveCash({ kind: 'out', amount: 100, date: '2026-10-01', category: 'made-up' });
    store.saveCash({ kind: 'in', amount: 900, date: '2026-10-05' });
    expect(rows().map((r) => r.date)).toEqual(['2026-10-05', '2026-10-01']);
    expect(rows()[1].category).toBe('other');
  });

  it('survives a reload', () => {
    store.saveCash({ kind: 'in', amount: 1200, date: '2026-10-01' });
    const again = createStore(kv);
    again.load();
    expect(cashInHand(cashRows(again.getState()))).toBe(1200);
  });
});

describe('expenses', () => {
  it('totals money out by category for a month, largest first', () => {
    store.saveCash({ kind: 'out', amount: 25000, date: '2026-10-01', category: 'rent' });
    store.saveCash({ kind: 'out', amount: 300, date: '2026-10-02', category: 'food' });
    store.saveCash({ kind: 'out', amount: 450, date: '2026-10-09', category: 'food' });
    store.saveCash({ kind: 'out', amount: 9999, date: '2026-09-30', category: 'rent' });
    store.saveCash({ kind: 'in', amount: 5000, date: '2026-10-03' });
    expect(expenseSummary(rows(), '2026-10')).toEqual({
      total: 25750,
      byCategory: [
        { category: 'rent', amount: 25000 },
        { category: 'food', amount: 750 },
      ],
    });
  });

  it('moves between months across a year end', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('stock', () => {
  it('is not counted until an item is tracked', () => {
    const item = store.saveItem({ name: 'Windows installation', price: 1500 });
    expect(item.trackStock).toBe(false);
    expect(levels().has(item.id)).toBe(false);
  });

  it('goes up when stock is added and down when an invoice is issued', () => {
    const ssd = store.saveItem({ name: 'SSD 256 GB', price: 7800 });
    store.addStock(ssd.id, 10, { date: '2026-10-01' });
    expect(store.getState().items[0].trackStock).toBe(true);
    expect(levels().get(ssd.id)).toBe(10);

    const invoice = invoiceFor(ssd.id, 'SSD 256 GB', 3, 7800);
    expect(levels().get(ssd.id)).toBe(10); // still a draft
    store.markSent(invoice.id);
    expect(levels().get(ssd.id)).toBe(7);
    store.markPaid(invoice.id);
    expect(levels().get(ssd.id)).toBe(7);
    store.deleteDoc(invoice.id);
    expect(levels().get(ssd.id)).toBe(10);
  });

  it('is not touched by quotes, and is taken when a quote becomes an invoice', () => {
    const ram = store.saveItem({ name: 'RAM', price: 6500 });
    store.addStock(ram.id, 5);
    const quote = store.createDoc('quote');
    store.saveDoc({ ...quote, lines: [{ id: 'l1', itemId: ram.id, name: 'RAM', unit: '', qty: 2, price: 6500 }] });
    store.markSent(quote.id);
    expect(levels().get(ram.id)).toBe(5);
    store.convertToInvoice(quote.id);
    expect(levels().get(ram.id)).toBe(3);
  });

  it('can be corrected to the number counted on the shelf', () => {
    const toner = store.saveItem({ name: 'Toner', price: 4200 });
    store.addStock(toner.id, 8);
    store.setStock(toner.id, 6);
    expect(levels().get(toner.id)).toBe(6);
    expect(store.getState().stockMoves.map((m) => [m.kind, m.qty])).toEqual([['open', 8], ['correct', -2]]);
    store.setStock(toner.id, 6);
    expect(store.getState().stockMoves).toHaveLength(2); // nothing to correct
  });

  it('warns when an item is low or has run out', () => {
    const a = store.saveItem({ name: 'A', trackStock: true, lowStock: 2 });
    const b = store.saveItem({ name: 'B', trackStock: true, lowStock: 2 });
    const c = store.saveItem({ name: 'C', trackStock: true });
    store.addStock(a.id, 5);
    store.addStock(b.id, 2);
    expect(stockState(a, 5)).toBe('ok');
    expect(stockState(b, 2)).toBe('low');
    expect(stockState(c, 0)).toBe('out');
    expect(lowStockItems(store.getState().items, levels()).map((i) => i.name)).toEqual(['C', 'B']);
  });

  it('puts what was paid for stock into the cash book as an expense', () => {
    const ssd = store.saveItem({ name: 'SSD 256 GB' });
    store.addStock(ssd.id, 10, { cost: 60000, date: '2026-10-02' });
    expect(rows()[0]).toMatchObject({ kind: 'out', amount: 60000, category: 'stock', source: 'stock', note: 'SSD 256 GB' });
    expect(expenseSummary(rows(), '2026-10').byCategory).toEqual([{ category: 'stock', amount: 60000 }]);
  });

  it('keeps a history of what came in and what was sold', () => {
    const ssd = store.saveItem({ name: 'SSD 256 GB' });
    store.addStock(ssd.id, 10, { date: '2026-10-01' });
    const invoice = invoiceFor(ssd.id, 'SSD 256 GB', 4, 7800, '2026-10-03');
    store.markSent(invoice.id);
    const history = stockHistory(ssd.id, store.getState().stockMoves, store.getState().docs);
    expect(history.map((e) => [e.kind, e.qty, e.label])).toEqual([['invoice', -4, 'INV-0001'], ['open', 10, '']]);
  });

  it('forgets the stock of a deleted item', () => {
    const item = store.saveItem({ name: 'Mouse' });
    store.addStock(item.id, 3);
    store.deleteItem(item.id);
    expect(store.getState().stockMoves).toHaveLength(0);
  });
});

describe('backup with the books', () => {
  it('carries the cash book and stock to a new device', () => {
    const ssd = store.saveItem({ name: 'SSD 256 GB', lowStock: 2 });
    store.addStock(ssd.id, 10, { cost: 60000 });
    store.saveCash({ kind: 'out', amount: 25000, category: 'rent' });
    const fresh = createStore(memoryKV());
    fresh.load();
    expect(fresh.importBackup(store.exportBackup())).toBe(true);
    const s = fresh.getState();
    expect(s.cash).toHaveLength(1);
    expect(stockLevels(s.items, s.stockMoves, s.docs).get(ssd.id)).toBe(10);
    expect(cashInHand(cashRows(s))).toBe(-85000);
  });

  it('reads a backup made before the books existed', () => {
    const old = JSON.stringify({
      app: 'billkul',
      version: 1,
      data: { settings: { shopName: 'Old shop' }, customers: [], items: [{ id: 'i1', name: 'Mouse', unit: '', price: 900, createdAt: '2026-01-01' }], docs: [] },
    });
    expect(store.importBackup(old)).toBe(true);
    const s = store.getState();
    expect(s.items[0]).toMatchObject({ name: 'Mouse', trackStock: false, lowStock: 0 });
    expect(s.cash).toEqual([]);
    expect(s.stockMoves).toEqual([]);
  });
});
