import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/data/store';
import type { Doc } from '../src/data/types';
import { buildReceiptHtml, receiptHeightMm, receiptWidthPx } from '../src/pdf/receipt';
import { hasUrduScript, nastaliqRoom, splitLatin, urduSize } from '../src/ui/nastaliq';

const doc: Doc = {
  id: 'd', type: 'invoice', seq: 4, number: 'INV-0004', date: '2026-10-07', customerId: 'c', customerName: 'Humza',
  customerPhone: '0300 1112233',
  lines: [
    { id: 'a', itemId: '', name: 'Samsung J5', unit: 'piece', qty: 1, price: 30000 },
    { id: 'b', itemId: '', name: 'Camera <Dhom> 10', unit: 'piece', qty: 2, price: 5600 },
  ],
  discount: 200, taxPercent: 0, notes: '', status: 'paid', invoiceId: '', quoteId: '', paidOn: '2026-10-07', createdAt: '', updatedAt: '',
};
const settings = { ...DEFAULT_SETTINGS, shopName: 'Al Mizzan Electronics & Mobile', phone: '03318222236', address: 'Gujranwala' };

describe('thermal receipt', () => {
  it('prints the invoice on an 80 mm roll with every line and the total', () => {
    const html = buildReceiptHtml({ doc, settings, lang: 'en', paper: 'r80' });
    expect(html).toContain('size: 80mm');
    expect(html).toContain('margin: 0');
    expect(html).toContain('Al Mizzan Electronics &amp; Mobile');
    expect(html).toContain('INVOICE');
    expect(html).toContain('INV-0004');
    expect(html).toContain('7 Oct 2026');
    expect(html).toContain('Humza');
    expect(html).toContain('1 × 30,000');
    expect(html).toContain('2 × 5,600');
    expect(html).toContain('11,200');
    expect(html).toContain('− 200');
    expect(html).toContain('Rs 41,000');
    expect(html).toContain('PAID · 7 Oct 2026');
    expect(html).toContain('Thank you for your business.');
  });
  it('fits a 58 mm roll and is narrower on screen', () => {
    const html = buildReceiptHtml({ doc, settings, lang: 'en', paper: 'r58' });
    expect(html).toContain('size: 58mm');
    expect(receiptWidthPx('r58')).toBeLessThan(receiptWidthPx('r80'));
    expect(receiptWidthPx('r80')).toBe(302);
  });
  it('uses black only, so a one-colour printer shows everything', () => {
    const html = buildReceiptHtml({ doc, settings, lang: 'en', paper: 'r80' });
    const colours = new Set(html.match(/#[0-9A-Fa-f]{6}\b/g));
    expect([...colours].sort()).toEqual(['#000000', '#ffffff']);
  });
  it('says when an invoice is not paid, and leaves a quotation unmarked', () => {
    expect(buildReceiptHtml({ doc: { ...doc, status: 'due', paidOn: '' }, settings, lang: 'en', paper: 'r80' })).toContain('<div class="state">Unpaid</div>');
    const quote = buildReceiptHtml({ doc: { ...doc, type: 'quote', number: 'Q-0001', status: 'sent', paidOn: '' }, settings, lang: 'en', paper: 'r80' });
    expect(quote).toContain('QUOTATION');
    expect(quote).not.toContain('class="state"');
  });
  it('cannot be broken by what the user types', () => {
    const html = buildReceiptHtml({ doc, settings, lang: 'en', paper: 'r80' });
    expect(html).toContain('Camera &lt;Dhom&gt; 10');
    expect(html).not.toContain('<Dhom>');
    expect(html).not.toContain('<script');
  });
  it('is right-to-left in Urdu and grows with the number of lines', () => {
    const html = buildReceiptHtml({ doc, settings, lang: 'ur', paper: 'r80' });
    expect(html).toContain('<html lang="ur" dir="rtl">');
    expect(html).toContain('انوائس');
    const long = { ...doc, lines: Array.from({ length: 12 }, (_, i) => ({ ...doc.lines[0], id: String(i) })) };
    expect(receiptHeightMm(long, settings, 'en', 'r80')).toBeGreaterThan(receiptHeightMm(doc, settings, 'en', 'r80') + 50);
  });
});

describe('Urdu lettering', () => {
  it('sets Urdu a little larger than Latin text, and never tiny', () => {
    expect(urduSize(15)).toBe(16.5);
    expect(urduSize(11.5)).toBe(13);
    expect(hasUrduScript('کیش بک')).toBe(true);
    expect(hasUrduScript('Cash book 2026')).toBe(false);
  });
  it('leaves room for the strokes that reach outside the line', () => {
    // "کیش" in bold rises 2.06 em above the baseline; a 30 px line at 16.5 px gives about 1.56 em.
    const size = 16.5;
    const room = nastaliqRoom(size);
    const above = 1.904 * size + (30 - 2.5 * size) / 2 + room.top;
    const below = 0.596 * size + (30 - 2.5 * size) / 2 + room.bottom;
    expect(above / size).toBeGreaterThan(2.3);
    expect(below / size).toBeGreaterThan(0.68);
    expect(room.start / size).toBeGreaterThanOrEqual(0.45);
    expect(room.end / size).toBeGreaterThanOrEqual(0.21);
  });
  it('separates digits and English words from Urdu, so the phone can set them in the Latin face', () => {
    expect(splitLatin('اکتوبر 2026')).toEqual([{ text: 'اکتوبر ', latin: false }, { text: '2026', latin: true }]);
    expect(splitLatin('انوائس INV-0002')).toEqual([{ text: 'انوائس ', latin: false }, { text: 'INV-0002', latin: true }]);
    expect(splitLatin('7 اکتوبر 2026 کو ادا ہوئی').map((r) => r.latin)).toEqual([true, false, true, false]);
    expect(splitLatin('کیش بک')).toEqual([{ text: 'کیش بک', latin: false }]);
  });
});

describe('receipt time', () => {
  it('shows the time of the sale next to the date', async () => {
    const { receiptWhen } = await import('../src/pdf/receipt');
    const at = new Date(2026, 9, 9, 15, 24).toISOString();
    const doc = { date: '2026-10-09', issuedAt: at, createdAt: new Date(2026, 9, 9, 15, 1).toISOString() } as never;
    expect(receiptWhen(doc, 'en')).toMatch(/^9 Oct 2026, 3:24\s?pm$/i);
    const old = { date: '2026-10-09', createdAt: new Date(2026, 9, 9, 9, 5).toISOString() } as never;
    expect(receiptWhen(old, 'en')).toMatch(/^9 Oct 2026, 9:05\s?am$/i);
    const other = { date: '2026-10-06', issuedAt: at, createdAt: at } as never;
    expect(receiptWhen(other, 'en')).toBe('6 Oct 2026');
  });
});
