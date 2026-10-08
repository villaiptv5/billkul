import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/data/store';
import type { Doc } from '../src/data/types';
import { buildDocHtml, docFileName, escapeHtml, whatsappNumber } from '../src/pdf/template';

const doc: Doc = {
  id: 'd', type: 'quote', seq: 12, number: 'Q-0012', date: '2026-10-05', customerId: 'c', customerName: 'Bilal Traders',
  customerPhone: '0321 7654321',
  lines: [
    { id: 'a', itemId: '', name: 'Dell Latitude 5420, Core i5, 8 GB', unit: 'piece', qty: 2, price: 68000 },
    { id: 'b', itemId: '', name: 'Kingston 8 GB DDR4 RAM', unit: 'piece', qty: 2, price: 6500 },
    { id: 'c', itemId: '', name: 'SSD 256 GB', unit: 'piece', qty: 1, price: 7800 },
  ],
  discount: 1800, taxPercent: 0, notes: '', status: 'sent', invoiceId: '', quoteId: '', paidOn: '', createdAt: '', updatedAt: '',
};
const settings = { ...DEFAULT_SETTINGS, shopName: 'Al-Noor Computers', phone: '0300 1234567', address: 'Shop 14, Hall Road, Lahore' };

describe('document html', () => {
  it('shows the quote with its totals', () => {
    const html = buildDocHtml({ doc, settings, lang: 'en' });
    expect(html).toContain('QUOTATION');
    expect(html).toContain('Q-0012');
    expect(html).toContain('Al-Noor Computers');
    expect(html).toContain('Shop 14, Hall Road, Lahore · 0300 1234567');
    expect(html).toContain('136,000');
    expect(html).toContain('156,800');
    expect(html).toContain('− 1,800');
    expect(html).toContain('Rs 155,000');
    expect(html).toContain('5 Oct 2026');
    expect(html).toContain('Made with BillKul');
    expect(html).not.toContain('PAID');
  });
  it('is right-to-left in Urdu', () => {
    const html = buildDocHtml({ doc, settings, lang: 'ur' });
    expect(html).toContain('<html lang="ur" dir="rtl">');
    expect(html).toContain('کوٹیشن برائے');
    expect(html).toContain('5 اکتوبر 2026');
  });
  it('stamps a paid invoice and shows tax', () => {
    const inv: Doc = { ...doc, type: 'invoice', number: 'INV-0008', status: 'paid', paidOn: '2026-10-04', discount: 0, taxPercent: 17 };
    const html = buildDocHtml({ doc: inv, settings: { ...settings, taxLabel: 'GST' }, lang: 'en', template: 'simple' });
    expect(html).toContain('INVOICE');
    expect(html).toContain('Bill to');
    expect(html).toContain('PAID');
    expect(html).toContain('GST 17%');
    expect(html).toContain('26,656'); // 17% of 156,800
    expect(html).toContain('Rs 183,456');
  });
  it('stamps an unpaid invoice UNPAID in red with its date, and leaves drafts and quotes unstamped', () => {
    const due: Doc = { ...doc, type: 'invoice', number: 'INV-0009', status: 'due', paidOn: '' };
    const html = buildDocHtml({ doc: due, settings, lang: 'en' });
    expect(html).toContain('<span class="paid unpaid display">UNPAID<small>5 Oct 2026</small></span>');
    expect(html).toContain('.paid.unpaid { border-color: #C62828; color: #B3261E; }');
    expect(buildDocHtml({ doc: { ...due, status: 'draft' }, settings, lang: 'en' })).not.toContain('UNPAID');
    expect(buildDocHtml({ doc, settings, lang: 'en' })).not.toContain('UNPAID');
    expect(buildDocHtml({ doc: due, settings, lang: 'ur' })).toContain('غیر ادا شدہ');
  });
  it('cannot be broken by what the user types', () => {
    const evil: Doc = { ...doc, customerName: '<script>alert(1)</script>', notes: 'a < b\nline "two"' };
    const html = buildDocHtml({ doc: evil, settings: { ...settings, logo: 'javascript:alert(1)' }, lang: 'en' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &lt; b<br>line &quot;two&quot;');
    expect(html).not.toContain('javascript:alert');
    expect(escapeHtml(`'"&<>`)).toBe('&#39;&quot;&amp;&lt;&gt;');
  });
});

describe('sharing helpers', () => {
  it('names the file after the document and customer', () => {
    expect(docFileName(doc)).toBe('Quote Q-0012 Bilal Traders');
    expect(docFileName({ ...doc, customerName: 'A/B: "Shop"?' })).toBe('Quote Q-0012 A B Shop');
    expect(docFileName({ ...doc, customerName: 'بلال ٹریڈرز' })).toBe('Quote Q-0012 بلال ٹریڈرز');
  });
  it('turns local numbers into WhatsApp numbers', () => {
    expect(whatsappNumber('0321 7654321')).toBe('923217654321');
    expect(whatsappNumber('+92 321 7654321')).toBe('923217654321');
    expect(whatsappNumber('0092-321-7654321')).toBe('923217654321');
    expect(whatsappNumber('')).toBe('');
  });
});

import type { CashRow } from '../src/logic/ledger';
import { customerSummary } from '../src/logic/stats';
import { buildCashReportHtml, buildStatementHtml, cashReportTotals, reportFileName } from '../src/pdf/reports';

describe('printed reports', () => {
  const row = (kind: 'in' | 'out', amount: number, date: string, extra: Partial<CashRow> = {}): CashRow => ({
    key: `${kind}${amount}`, date, kind, amount, category: kind === 'out' ? 'rent' : '', source: 'manual', refId: 'x', note: '', label: '', createdAt: date, ...extra,
  });
  const rows = [
    row('in', 30000, '2026-10-06', { source: 'invoice', label: 'INV-0001', note: 'Humza' }),
    row('out', 25000, '2026-10-01'),
    row('in', 19000, '2026-10-05', { note: 'Counter sale' }),
    row('out', 450, '2026-10-03', { category: 'food', note: '<Tea>' }),
  ];

  it('prints Cash In on its own, oldest first, with its total', () => {
    const html = buildCashReportHtml({ rows, side: 'in', period: 'October 2026', settings, lang: 'en' });
    expect(html).toContain('CASH IN');
    expect(html).toContain('October 2026');
    expect(html).toContain('Invoice INV-0001');
    expect(html).toContain('Humza');
    expect(html).toContain('Total cash in');
    expect(html).toContain('Rs 49,000');
    expect(html).not.toContain('25,000');
    expect(html.indexOf('Counter sale')).toBeLessThan(html.indexOf('Invoice INV-0001'));
  });

  it('prints Cash Out on its own, with categories, and escapes what was typed', () => {
    const html = buildCashReportHtml({ rows, side: 'out', period: 'October 2026', settings, lang: 'en' });
    expect(html).toContain('CASH OUT');
    expect(html).toContain('Rent');
    expect(html).toContain('Tea and food');
    expect(html).toContain('&lt;Tea&gt;');
    expect(html).toContain('Rs 25,450');
    expect(html).not.toContain('Counter sale');
  });

  it('prints both sides with the balance', () => {
    const html = buildCashReportHtml({ rows, side: 'all', period: '6 Oct 2026', settings, lang: 'en' });
    expect(html).toContain('CASH BOOK');
    expect(html).toContain('Rs 23,550');
    expect(cashReportTotals(rows, 'all')).toEqual({ in: 49000, out: 25450, shown: 23550 });
  });

  it('says so when the period is empty, and prints in Urdu right to left', () => {
    const html = buildCashReportHtml({ rows: [], side: 'in', period: 'ستمبر 2026', settings, lang: 'ur' });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('اس مدت میں کوئی اندراج نہیں۔');
  });

  it('prints a customer statement with paid and unpaid invoices and the balance', () => {
    const customer = { id: 'c', name: 'Master Tiles', phone: '0300 1112233', address: '', createdAt: '' };
    const paidDoc: Doc = { ...doc, id: 'p', type: 'invoice', number: 'INV-0002', date: '2026-10-05', status: 'paid', paidOn: '2026-10-06', discount: 0, lines: [{ id: 'a', itemId: '', name: 'Tiles', unit: '', qty: 1, price: 19000 }] };
    const dueDoc: Doc = { ...paidDoc, id: 'u', number: 'INV-0003', date: '2026-10-06', status: 'due', paidOn: '', lines: [{ id: 'a', itemId: '', name: 'Tiles', unit: '', qty: 1, price: 84000 }] };
    const draft: Doc = { ...dueDoc, id: 'x', number: 'INV-0009', status: 'draft' };
    const html = buildStatementHtml({ customer, summary: customerSummary([paidDoc, dueDoc, draft], 'c'), date: '7 Oct 2026', settings, lang: 'en' });
    expect(html).toContain('STATEMENT');
    expect(html).toContain('Master Tiles');
    expect(html).toContain('INV-0002');
    expect(html).toContain('Paid on 6 Oct 2026');
    expect(html).toContain('INV-0003');
    expect(html).toContain('Unpaid');
    expect(html).not.toContain('INV-0009');
    expect(html).toContain('103,000');
    expect(html).toContain('− 19,000');
    expect(html).toContain('Rs 84,000');
  });

  it('makes a safe file name', () => {
    expect(reportFileName('Cash In', 'October 2026')).toBe('Cash In October 2026');
    expect(reportFileName('Statement', 'A/B: "Traders"')).toBe('Statement A B Traders');
  });
});
