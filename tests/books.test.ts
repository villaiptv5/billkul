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

import { salesReport } from '../src/logic/sales';

describe('sales report', () => {
  const report = (period = '2026-10') => salesReport(store.getState().docs, store.getState().items, period);

  function sell(lines: { itemId: string; name: string; qty: number; price: number; cost?: number }[], extra: { discount?: number; taxPercent?: number; date?: string; customer?: string } = {}) {
    const doc = store.createDoc('invoice', extra.date ?? '2026-10-06');
    const saved = store.saveDoc({ ...doc, customerName: extra.customer ?? '', discount: extra.discount ?? 0, taxPercent: extra.taxPercent ?? 0, lines: lines.map((l, i) => ({ id: `l${i}`, unit: '', ...l })) });
    store.markSent(saved.id);
    store.markPaid(saved.id, saved.date);
    return saved;
  }

  it('counts only paid invoices, on the day the money came in', () => {
    const fan = store.saveItem({ name: 'Fan', price: 5000, cost: 4000 });
    const unpaid = store.createDoc('invoice', '2026-10-03');
    store.saveDoc({ ...unpaid, lines: [{ id: 'a', itemId: fan.id, name: 'Fan', unit: '', qty: 1, price: 5000, cost: 4000 }] });
    expect(report().invoices).toBe(0); // a draft is not a sale
    store.markSent(unpaid.id);
    expect(report()).toMatchObject({ invoices: 0, sales: 0, profit: 0 }); // issued but unpaid is not a sale yet
    store.markPaid(unpaid.id, '2026-10-08');
    expect(report('2026-10-03').invoices).toBe(0);
    expect(report('2026-10-08')).toMatchObject({ invoices: 1, sales: 5000, profit: 1000 });
    store.markUnpaid(unpaid.id);
    expect(report().invoices).toBe(0);
  });

  it('counts what sold and the profit on it: sale price less purchase price', () => {
    const ssd = store.saveItem({ name: 'SSD 256 GB', price: 7800, cost: 6000 });
    sell([{ itemId: ssd.id, name: ssd.name, qty: 3, price: 7800, cost: 6000 }]);
    expect(report()).toMatchObject({ invoices: 1, qty: 3, sales: 23400, profit: 5400 });
    expect(report().byItem).toEqual([{ key: ssd.id, label: 'SSD 256 GB', detail: '', qty: 3, sales: 23400, profit: 5400, invoices: 0 }]);
  });

  it('shows a loss when an item sells below its purchase price', () => {
    const ram = store.saveItem({ name: 'RAM', price: 6500, cost: 7000 });
    sell([{ itemId: ram.id, name: 'RAM', qty: 2, price: 6500, cost: 7000 }]);
    expect(report().profit).toBe(-1000);
  });

  it('gives one day or a whole month, with the month broken down day by day', () => {
    const mouse = store.saveItem({ name: 'Mouse', price: 900, cost: 600 });
    sell([{ itemId: mouse.id, name: 'Mouse', qty: 2, price: 900, cost: 600 }], { date: '2026-10-05' });
    sell([{ itemId: mouse.id, name: 'Mouse', qty: 1, price: 900, cost: 600 }], { date: '2026-10-06' });
    sell([{ itemId: mouse.id, name: 'Mouse', qty: 4, price: 900, cost: 600 }], { date: '2026-10-06' });
    sell([{ itemId: mouse.id, name: 'Mouse', qty: 9, price: 900, cost: 600 }], { date: '2026-09-30' });
    expect(report('2026-10-06')).toMatchObject({ invoices: 2, qty: 5, sales: 4500, profit: 1500 });
    expect(report('2026-10-05')).toMatchObject({ invoices: 1, qty: 2, sales: 1800, profit: 600 });
    expect(report('2026-10-04')).toMatchObject({ invoices: 0, qty: 0, sales: 0, profit: 0 });
    const month = report('2026-10');
    expect(month).toMatchObject({ invoices: 3, qty: 7, sales: 6300, profit: 2100 });
    expect(month.byDay.map((d) => [d.label, d.invoices, d.qty, d.sales, d.profit])).toEqual([
      ['2026-10-06', 2, 5, 4500, 1500],
      ['2026-10-05', 1, 2, 1800, 600],
    ]);
  });

  it('lists the invoices of the period with the profit on each', () => {
    const mouse = store.saveItem({ name: 'Mouse', price: 900, cost: 600 });
    const first = sell([{ itemId: mouse.id, name: 'Mouse', qty: 2, price: 900, cost: 600 }], { customer: 'Bilal Traders' });
    expect(report('2026-10-06').byInvoice).toEqual([{ key: first.id, label: 'INV-0001', detail: 'Bilal Traders', qty: 2, sales: 1800, profit: 600, invoices: 1 }]);
  });

  it('takes the invoice discount off the profit and leaves tax out', () => {
    const a = store.saveItem({ name: 'A', cost: 600 });
    const b = store.saveItem({ name: 'B', cost: 100 });
    sell([{ itemId: a.id, name: 'A', qty: 1, price: 800, cost: 600 }, { itemId: b.id, name: 'B', qty: 1, price: 200, cost: 100 }], { discount: 100, taxPercent: 17 });
    const r = report();
    expect(r.sales).toBe(900);
    expect(r.profit).toBe(200);
    expect(r.byItem.map((i) => [i.label, i.sales, i.profit])).toEqual([['A', 720, 120], ['B', 180, 80]]);
  });

  it('counts only issued invoices: not drafts, not quotes', () => {
    const item = store.saveItem({ name: 'Mouse', price: 900, cost: 600 });
    const draft = store.createDoc('invoice', '2026-10-06');
    store.saveDoc({ ...draft, lines: [{ id: 'l', itemId: item.id, name: 'Mouse', unit: '', qty: 5, price: 900, cost: 600 }] });
    const quote = store.createDoc('quote', '2026-10-06');
    store.saveDoc({ ...quote, lines: [{ id: 'l', itemId: item.id, name: 'Mouse', unit: '', qty: 5, price: 900, cost: 600 }] });
    store.markSent(quote.id);
    expect(report()).toMatchObject({ invoices: 0, sales: 0, profit: 0 });
  });

  it('keeps the purchase price an invoice was sold at when the price changes later', () => {
    const ssd = store.saveItem({ name: 'SSD', price: 7800, cost: 6000 });
    sell([{ itemId: ssd.id, name: 'SSD', qty: 1, price: 7800, cost: 6000 }]);
    store.saveItem({ id: ssd.id, name: 'SSD', cost: 7000 });
    expect(report().profit).toBe(1800);
  });

  it('uses the purchase price of today for invoices written before purchase prices existed', () => {
    const ssd = store.saveItem({ name: 'SSD', price: 7800, cost: 6000 });
    sell([{ itemId: ssd.id, name: 'SSD', qty: 2, price: 7800 }]);
    expect(report().profit).toBe(3600);
  });

  it('treats a service with no purchase price as all profit, and names goods that are missing one', () => {
    const install = store.saveItem({ name: 'Windows installation', price: 1500 });
    const cable = store.saveItem({ name: 'Cable', price: 300, trackStock: true });
    sell([{ itemId: install.id, name: install.name, qty: 1, price: 1500 }, { itemId: cable.id, name: 'Cable', qty: 2, price: 300 }]);
    const r = report();
    expect(r.profit).toBe(2100);
    expect(r.missingCost).toEqual(['Cable']);
  });

  it('sets the purchase price from the last stock bought', () => {
    const ssd = store.saveItem({ name: 'SSD', price: 7800 });
    store.addStock(ssd.id, 10, { unitCost: 6200 });
    expect(store.getState().items[0].cost).toBe(6200);
  });

  it('reads the purchase price again when a quote becomes an invoice', () => {
    const ssd = store.saveItem({ name: 'SSD', price: 7800, cost: 6000 });
    const quote = store.createDoc('quote', '2026-10-06');
    store.saveDoc({ ...quote, lines: [{ id: 'l', itemId: ssd.id, name: 'SSD', unit: '', qty: 1, price: 7800, cost: 6000 }] });
    store.saveItem({ id: ssd.id, name: 'SSD', cost: 6500 });
    const invoice = store.convertToInvoice(quote.id, '2026-10-06');
    expect(invoice?.lines[0].cost).toBe(6500);
    store.markPaid(invoice!.id, '2026-10-06');
    expect(report().profit).toBe(1300);
  });

  it('keeps the totals exact when a discount does not divide evenly between lines', () => {
    const a = store.saveItem({ name: 'A', cost: 6000 });
    const b = store.saveItem({ name: 'B', cost: 7000 });
    const c = store.saveItem({ name: 'C', cost: 3400 });
    sell(
      [
        { itemId: a.id, name: 'A', qty: 3, price: 7800, cost: 6000 },
        { itemId: b.id, name: 'B', qty: 1, price: 6500, cost: 7000 },
        { itemId: c.id, name: 'C', qty: 2, price: 4200, cost: 3400 },
        { itemId: '', name: 'Service', qty: 1, price: 1500 },
      ],
      { discount: 1000 },
    );
    const r = report();
    expect(r.sales).toBe(38800);
    expect(r.profit).toBe(7000);
    expect(r.byDay[0]).toMatchObject({ sales: 38800, profit: 7000 });
  });
});

import { customerSummary, dueReport } from '../src/logic/stats';
import { daysBetween } from '../src/logic/dates';

describe('due and customer history', () => {
  function doc(type: 'quote' | 'invoice', customer: { id: string; name: string; phone: string }, amount: number, date: string) {
    const d = store.createDoc(type, date);
    return store.saveDoc({ ...d, customerId: customer.id, customerName: customer.name, customerPhone: customer.phone, lines: [{ id: 'l', itemId: '', name: 'Thing', unit: '', qty: 1, price: amount }] });
  }

  it('counts days across a month end', () => {
    expect(daysBetween('2026-09-28', '2026-10-07')).toBe(9);
    expect(daysBetween('2026-10-07', '2026-10-07')).toBe(0);
  });

  it('lists who owes what, the biggest first, with how long each invoice has waited', () => {
    const bilal = store.saveCustomer({ name: 'Bilal Traders', phone: '0321 7654321' });
    const usman = store.saveCustomer({ name: 'Usman Electronics', phone: '' });
    const a = doc('invoice', bilal, 5000, '2026-10-01');
    const b = doc('invoice', bilal, 7000, '2026-09-20');
    const c = doc('invoice', usman, 84000, '2026-10-06');
    const paid = doc('invoice', usman, 1000, '2026-10-02');
    doc('invoice', usman, 999, '2026-10-03'); // a draft does not count
    [a, b, c, paid].forEach((d) => store.markSent(d.id));
    store.markPaid(paid.id, '2026-10-05');
    const q = doc('quote', bilal, 3000, '2026-10-06');
    store.markSent(q.id);

    const report = dueReport(store.getState().docs, '2026-10-07');
    expect(report.total).toBe(96000);
    expect(report.count).toBe(3);
    expect(report.groups.map((g) => [g.name, g.total])).toEqual([['Usman Electronics', 84000], ['Bilal Traders', 12000]]);
    expect(report.groups[1].invoices.map((i) => [i.doc.number, i.days])).toEqual([['INV-0002', 17], ['INV-0001', 6]]);
    expect(report.openQuotes.map((o) => o.doc.number)).toEqual(['Q-0001']);
    expect(report.openQuotesTotal).toBe(3000);

    store.markPaid(c.id);
    expect(dueReport(store.getState().docs, '2026-10-07').total).toBe(12000);
  });

  it('sums up one customer: quoted, invoiced, paid and still due', () => {
    const bilal = store.saveCustomer({ name: 'Bilal Traders', phone: '' });
    const other = store.saveCustomer({ name: 'Someone else', phone: '' });
    const q = doc('quote', bilal, 9000, '2026-10-01');
    store.markSent(q.id);
    const i1 = doc('invoice', bilal, 5000, '2026-10-02');
    const i2 = doc('invoice', bilal, 2000, '2026-10-03');
    doc('invoice', bilal, 111, '2026-10-04'); // draft
    const o = doc('invoice', other, 77777, '2026-10-04');
    [i1, i2, o].forEach((d) => store.markSent(d.id));
    store.markPaid(i1.id);
    const s = customerSummary(store.getState().docs, bilal.id);
    expect(s).toMatchObject({ quoted: 9000, invoiced: 7000, paid: 5000, due: 2000 });
    expect(s.invoices.map((d) => d.number)).toEqual(['INV-0003', 'INV-0002', 'INV-0001']);
    expect(s.quotes.map((d) => d.number)).toEqual(['Q-0001']);
  });
});
