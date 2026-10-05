import { describe, expect, it } from 'vitest';
import { addDays, formatDate, formatDay, formatMonth } from '../src/logic/dates';
import { formatAmount, money, parseAmount } from '../src/logic/money';
import { monthStats } from '../src/logic/stats';
import { docTotals, formatDocNumber, lineTotal } from '../src/logic/totals';
import type { Doc } from '../src/data/types';

function doc(over: Partial<Doc>): Doc {
  return {
    id: 'd', type: 'quote', seq: 1, number: 'Q-0001', date: '2026-10-05', customerId: '', customerName: 'A',
    customerPhone: '', lines: [], discount: 0, taxPercent: 0, notes: '', status: 'sent', invoiceId: '', quoteId: '',
    paidOn: '', createdAt: '', updatedAt: '', ...over,
  };
}
const line = (qty: number, price: number) => ({ id: 'l' + qty + price, itemId: '', name: 'x', unit: '', qty, price });

describe('money', () => {
  it('formats with thousands separators', () => {
    expect(formatAmount(155000)).toBe('155,000');
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(999)).toBe('999');
    expect(formatAmount(1234.5)).toBe('1,234.50');
    expect(formatAmount(1234567.891)).toBe('1,234,567.89');
    expect(formatAmount(-1800)).toBe('-1,800');
    expect(money(155000, { code: 'PKR', symbol: 'Rs' })).toBe('Rs 155,000');
  });
  it('parses typed amounts, including Urdu digits', () => {
    expect(parseAmount('68,000')).toBe(68000);
    expect(parseAmount(' 1 500.50 ')).toBe(1500.5);
    expect(parseAmount('۶۸۰۰۰')).toBe(68000);
    expect(parseAmount('٦٥٠٠')).toBe(6500);
    expect(parseAmount('abc')).toBe(0);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('1.2.3')).toBe(1.23);
  });
});

describe('totals', () => {
  it('matches the prototype quote', () => {
    const d = doc({ lines: [line(2, 68000), line(2, 6500), line(1, 7800)], discount: 1800 });
    expect(docTotals(d)).toEqual({ subtotal: 156800, discount: 1800, tax: 0, total: 155000 });
  });
  it('applies tax after discount', () => {
    const d = doc({ lines: [line(1, 1000)], discount: 100, taxPercent: 17 });
    expect(docTotals(d)).toEqual({ subtotal: 1000, discount: 100, tax: 153, total: 1053 });
  });
  it('never discounts below zero', () => {
    const d = doc({ lines: [line(1, 500)], discount: 900 });
    expect(docTotals(d).total).toBe(0);
    expect(docTotals(d).discount).toBe(500);
  });
  it('rounds fractional quantities', () => {
    expect(lineTotal({ qty: 2.5, price: 90 })).toBe(225);
    expect(lineTotal({ qty: 0.1, price: 0.2 })).toBe(0.02);
  });
  it('pads document numbers', () => {
    expect(formatDocNumber('Q-', 12)).toBe('Q-0012');
    expect(formatDocNumber('INV-', 12345)).toBe('INV-12345');
  });
});

describe('dates', () => {
  it('formats in English and Urdu', () => {
    expect(formatDate('2026-10-05', 'en')).toBe('5 Oct 2026');
    expect(formatDate('2026-10-05', 'ur')).toBe('5 اکتوبر 2026');
    expect(formatMonth('2026-10-05', 'en')).toBe('October 2026');
  });
  it('names today and yesterday', () => {
    expect(formatDay('2026-10-05', 'en', '2026-10-05')).toBe('Today');
    expect(formatDay('2026-10-04', 'en', '2026-10-05')).toBe('Yesterday');
    expect(formatDay('2026-10-02', 'en', '2026-10-05')).toBe('2 Oct');
    expect(formatDay('2025-12-31', 'en', '2026-10-05')).toBe('31 Dec 2025');
    expect(formatDay('2026-10-04', 'ur', '2026-10-05')).toBe('کل');
  });
  it('crosses month ends', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('month stats', () => {
  it('matches the prototype home screen', () => {
    const docs = [
      doc({ id: 'q12', lines: [line(1, 155000)], status: 'sent' }),
      doc({ id: 'q11', lines: [line(1, 18200)], status: 'draft', date: '2026-10-01' }),
      doc({ id: 'i8', type: 'invoice', lines: [line(1, 42500)], status: 'paid', date: '2026-10-04', paidOn: '2026-10-04' }),
      doc({ id: 'i7', type: 'invoice', lines: [line(1, 77000)], status: 'due', date: '2026-10-02' }),
      doc({ id: 'i6', type: 'invoice', lines: [line(1, 98500)], status: 'paid', date: '2026-09-28', paidOn: '2026-10-03' }),
      doc({ id: 'i1', type: 'invoice', lines: [line(1, 5000)], status: 'due', date: '2026-08-10' }),
    ];
    const s = monthStats(docs, '2026-10-05');
    expect(s.quoted).toBe(155000); // the draft is left out
    expect(s.invoiced).toBe(119500); // October invoices only
    expect(s.received).toBe(141000); // paid in October, even if invoiced in September
    expect(s.due).toBe(82000); // everything still owed
  });
});
