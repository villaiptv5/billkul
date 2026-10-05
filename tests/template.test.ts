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
