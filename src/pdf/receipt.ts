import type { Doc, Lang, ReceiptPaper, Settings } from '../data/types';
import { translate, type StringKey, type Vars } from '../i18n';
import { formatDate, formatDateTime } from '../logic/dates';
import { formatAmount, money } from '../logic/money';
import { docTotals, lineTotal } from '../logic/totals';
import { escapeHtml } from './template';

const MM_TO_PX = 96 / 25.4;

/**
 * The two roll widths thermal (POS) printers use. The printer cannot print to the very edge,
 * so the receipt keeps a margin inside the roll: 72 mm of an 80 mm roll, 48 mm of a 58 mm roll.
 */
export const RECEIPT_PAPERS: Record<ReceiptPaper, { widthMm: number; marginMm: number }> = {
  r80: { widthMm: 80, marginMm: 4 },
  r58: { widthMm: 58, marginMm: 5 },
};

/** The style element that carries the receipt's page size, so the print step can correct its length. */
export const RECEIPT_PAGE_STYLE = 'receipt-page';

/** Roll width in screen pixels, for the preview. */
export function receiptWidthPx(paper: ReceiptPaper): number {
  return Math.round(RECEIPT_PAPERS[paper].widthMm * MM_TO_PX);
}

/**
 * A fair guess of the receipt's length, used where the page size has to be given before the page is laid out.
 * It leans long: a little blank paper at the end is better than a receipt split across two pages.
 */
export function receiptHeightMm(doc: Doc, settings: Settings, lang: Lang, paper: ReceiptPaper): number {
  const row = lang === 'ur' ? 8 : 4.6;
  const perLine = paper === 'r80' ? 34 : 22;
  const wrapped = (text: string) => Math.max(1, Math.ceil(text.trim().length / perLine));
  const totals = docTotals(doc);
  let mm = 8;
  if (settings.logo.startsWith('data:image/')) mm += 18;
  mm += 8 * wrapped(settings.shopName || 'x');
  if (settings.address.trim()) mm += row * wrapped(settings.address);
  if (settings.phone.trim()) mm += row;
  mm += 6 + row * (doc.customerPhone ? 4 : 3);
  mm += 7;
  for (const line of doc.lines) mm += row * wrapped(line.name) + row + 2.5;
  mm += 6 + row * ((totals.discount > 0 || totals.tax > 0 ? 1 : 0) + (totals.discount > 0 ? 1 : 0) + (totals.tax > 0 ? 1 : 0)) + 10;
  if (doc.type === 'invoice' && doc.status !== 'draft') mm += 10;
  if (doc.notes.trim()) mm += 4 + row * doc.notes.split('\n').reduce((n, l) => n + wrapped(l), 0);
  mm += 6 + row * wrapped(settings.footerNote || 'Thank you for your business.') + row + 5;
  return Math.ceil(mm);
}

// Thermal printers have one colour and coarse dots: black only, no tints, no thin grey text.
const CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #ffffff; }
body {
  font-family: 'DM Sans', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 12px; line-height: 1.4; color: #000000; font-weight: 500;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
html[lang="ur"] body { font-family: 'DM Sans', 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', 'Noto Naskh Arabic', Tahoma, sans-serif; line-height: 2.1; }
.num { font-family: 'DM Sans', 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.4; direction: ltr; unicode-bidi: isolate; }
.lat, html[lang="ur"] .shop.lat { line-height: 1.4; }
.c { text-align: center; }
.logo { display: block; margin: 0 auto 2mm; width: 16mm; height: 16mm; object-fit: contain; filter: grayscale(1) contrast(1.4); }
.shop { font-size: 17px; font-weight: 700; line-height: 1.25; }
html[lang="ur"] .shop { line-height: 2; }
.small { font-size: 11px; }
.rule { border: 0; border-top: 1px dashed #000000; margin: 2mm 0; }
.kind { font-size: 14px; font-weight: 700; letter-spacing: 1.5px; }
html[lang="ur"] .kind { letter-spacing: 0; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 3mm; }
.row > :first-child { min-width: 0; }
.row > :last-child { text-align: end; flex: none; max-width: 70%; }
.item { padding: 1mm 0; break-inside: avoid; page-break-inside: avoid; }
.item .name { font-weight: 600; overflow-wrap: anywhere; }
.cols { font-size: 11px; font-weight: 600; }
.amount { font-weight: 700; }
.grand { margin-top: 1mm; padding-top: 1.5mm; border-top: 1.5px solid #000000; }
.grand .k { font-size: 14px; font-weight: 700; }
.grand .v { font-size: 18px; font-weight: 700; }
.state { margin: 2.5mm auto 0; padding: 0.8mm 3mm; border: 1.5px solid #000000; border-radius: 1.5mm; width: fit-content; font-size: 12px; font-weight: 700; }
.notes { overflow-wrap: anywhere; }
.foot { margin-top: 1mm; }
`;

export interface ReceiptHtmlInput {
  doc: Doc;
  settings: Settings;
  lang: Lang;
  paper: ReceiptPaper;
}

/** The quote or invoice as a narrow receipt for a thermal (POS) printer. */
export function buildReceiptHtml({ doc, settings, lang, paper }: ReceiptHtmlInput): string {
  const t = (key: StringKey, vars?: Vars) => translate(lang, key, vars);
  const { widthMm, marginMm } = RECEIPT_PAPERS[paper];
  const heightMm = receiptHeightMm(doc, settings, lang, paper);
  const totals = docTotals(doc);
  const isQuote = doc.type === 'quote';
  const showBreakdown = totals.discount > 0 || totals.tax > 0;
  const taxLabel = `${settings.taxLabel.trim() || t('tax')} ${formatAmount(doc.taxPercent)}%`;
  const logo = settings.logo.startsWith('data:image/') ? `<img class="logo" src="${escapeHtml(settings.logo)}" alt="">` : '';
  const text = (value: string) => escapeHtml(value).replace(/\r?\n/g, '<br>');
  // English text inside an Urdu receipt keeps normal line spacing; only Nastaliq needs the tall lines.
  const tight = (value: string) => (/[\u0600-\u06FF]/.test(value) ? '' : ' lat');

  const items = doc.lines
    .map(
      (l) => `<div class="item">
<div class="name${tight(l.name)}" dir="auto">${escapeHtml(l.name)}</div>
<div class="row"><span class="num">${formatAmount(l.qty)} × ${formatAmount(l.price)}</span><span class="num amount">${formatAmount(lineTotal(l))}</span></div>
</div>`,
    )
    .join('\n');

  const state =
    doc.type !== 'invoice' || doc.status === 'draft'
      ? ''
      : doc.status === 'paid'
        ? `<div class="state">${escapeHtml(t('paidStamp'))}${doc.paidOn ? ` · ${escapeHtml(formatDate(doc.paidOn, lang))}` : ''}</div>`
        : `<div class="state">${escapeHtml(t('unpaid'))}</div>`;

  return `<!doctype html>
<html lang="${lang}" dir="${lang === 'ur' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${receiptWidthPx(paper)}">
<title>${escapeHtml(doc.number)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&amp;family=Noto+Nastaliq+Urdu:wght@400;600;700&amp;display=swap">
<style>${CSS}body { padding: 3mm ${marginMm}mm 5mm; }</style>
<style id="${RECEIPT_PAGE_STYLE}">@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }</style>
</head>
<body>
<div class="c">
${logo}
<div class="shop${tight(settings.shopName)}" dir="auto">${escapeHtml(settings.shopName.trim() || t('myShop'))}</div>
${settings.address.trim() ? `<div class="small${tight(settings.address)}" dir="auto">${escapeHtml(settings.address.trim())}</div>` : ''}
${settings.phone.trim() ? `<div class="small num">${escapeHtml(settings.phone.trim())}</div>` : ''}
</div>
<hr class="rule">
<div class="row"><span class="kind">${escapeHtml(t(isQuote ? 'docQuotation' : 'docInvoice'))}</span><span class="num amount">${escapeHtml(doc.number)}</span></div>
<div class="row"><span>${escapeHtml(t('date'))}</span><span>${escapeHtml(receiptWhen(doc, lang))}</span></div>
${doc.customerName.trim() ? `<div class="row"><span>${escapeHtml(t('customer'))}</span><span class="${tight(doc.customerName).trim()}" dir="auto">${escapeHtml(doc.customerName.trim())}</span></div>` : ''}
${doc.customerPhone ? `<div class="row"><span>${escapeHtml(t('phone'))}</span><span class="num">${escapeHtml(doc.customerPhone)}</span></div>` : ''}
<hr class="rule">
<div class="row cols"><span>${escapeHtml(t('colItem'))} · ${escapeHtml(t('colQty'))} × ${escapeHtml(t('colPrice'))}</span><span>${escapeHtml(t('colAmount'))}</span></div>
<hr class="rule">
${items}
<hr class="rule">
${showBreakdown ? `<div class="row"><span>${escapeHtml(t('subtotal'))}</span><span class="num">${formatAmount(totals.subtotal)}</span></div>` : ''}
${totals.discount > 0 ? `<div class="row"><span>${escapeHtml(t('discount'))}</span><span class="num">− ${formatAmount(totals.discount)}</span></div>` : ''}
${totals.tax > 0 ? `<div class="row"><span dir="auto">${escapeHtml(taxLabel)}</span><span class="num">${formatAmount(totals.tax)}</span></div>` : ''}
<div class="row grand"><span class="k">${escapeHtml(t('total'))}</span><span class="v num">${escapeHtml(money(totals.total, settings.currency))}</span></div>
${state}
<hr class="rule">
${doc.notes.trim() ? `<div class="notes small${tight(doc.notes)}" dir="auto">${text(doc.notes.trim())}</div><hr class="rule">` : ''}
<div class="c foot" dir="auto">${text(settings.footerNote.trim() || t('defaultFooter'))}</div>
<div class="c small">${escapeHtml(t('madeWith'))}</div>
</body>
</html>`;
}

/**
 * The date on the receipt with the time of the sale: when the invoice was completed, or for an older
 * one when it was started. The time is left out when that moment was on another day than the invoice date.
 */
export function receiptWhen(doc: Doc, lang: Lang): string {
  return formatDateTime(doc.date, doc.issuedAt || doc.createdAt, lang);
}
