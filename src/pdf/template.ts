import type { Doc, Lang, Settings, TemplateId } from '../data/types';
import { translate, type StringKey, type Vars } from '../i18n';
import { formatDate } from '../logic/dates';
import { formatAmount, money } from '../logic/money';
import { docTotals, lineTotal } from '../logic/totals';

/** A4 at 96 dpi. The preview lays the page out at this width and scales it to fit the screen. */
export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

export function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function multiline(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

const FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&amp;family=Sora:wght@600;700&amp;family=Noto+Nastaliq+Urdu:wght@400;600;700&amp;display=swap">';

const BASE_CSS = `
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #ffffff; }
body {
  font-family: 'DM Sans', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 15px; line-height: 1.45; color: #0B1F17;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
html[lang="ur"] body { font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', 'Noto Naskh Arabic', serif; line-height: 2.1; }
@media screen { body { padding: 12mm; } }
.num, .latin { font-family: 'DM Sans', 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.45; direction: ltr; unicode-bidi: isolate; }
.display { font-family: 'Sora', 'DM Sans', 'Segoe UI', Roboto, Arial, sans-serif; }
html[lang="ur"] .display { font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif; }
.muted { color: #51635A; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
.shop { display: flex; align-items: center; gap: 14px; min-width: 0; }
.logo { width: 68px; height: 68px; border-radius: 12px; object-fit: cover; flex: none; }
.shop-name { font-size: 26px; font-weight: 700; line-height: 1.25; }
html[lang="ur"] .shop-name { line-height: 2; }
.shop-line { font-size: 14px; margin-top: 3px; }
.title { text-align: end; flex: none; }
.title-word { font-size: 22px; font-weight: 700; letter-spacing: 2px; }
html[lang="ur"] .title-word { letter-spacing: 0; }
.title-num { font-size: 15px; margin-top: 2px; }
.meta { display: flex; justify-content: space-between; gap: 24px; margin-top: 26px; }
.meta .label { font-size: 13px; }
.meta .strong { font-size: 18px; font-weight: 600; }
.meta .end { text-align: end; }
table { width: 100%; border-collapse: collapse; margin-top: 24px; }
thead { display: table-header-group; }
th { font-size: 13px; font-weight: 600; text-align: start; padding: 10px 12px; }
td { padding: 12px 12px; border-bottom: 1px solid #E6ECE8; vertical-align: top; }
tr { break-inside: avoid; page-break-inside: avoid; }
th.r, td.r { text-align: end; white-space: nowrap; }
td.amount { font-weight: 600; }
.unit { font-size: 13px; }
.totals { margin-top: 16px; display: flex; justify-content: flex-end; break-inside: avoid; page-break-inside: avoid; }
.totals-box { width: 48%; min-width: 280px; }
.trow { display: flex; justify-content: space-between; gap: 16px; padding: 5px 12px; }
.trow.grand { margin-top: 8px; padding-top: 10px; border-top: 2px solid #0B1F17; align-items: baseline; }
.trow.grand .k { font-size: 16px; font-weight: 600; }
.trow.grand .v { font-size: 24px; font-weight: 700; }
.paid { display: inline-block; margin-top: 14px; padding: 4px 16px; border: 2.5px solid #00995A; border-radius: 8px; color: #007A48; font-size: 16px; font-weight: 700; letter-spacing: 2px; transform: rotate(-4deg); }
html[lang="ur"] .paid { letter-spacing: 0; }
.paid small { display: block; font-size: 10.5px; font-weight: 500; letter-spacing: 0; text-align: center; }
.notes { margin-top: 26px; padding: 12px 14px; background: #F4F7F5; border-radius: 8px; break-inside: avoid; page-break-inside: avoid; }
.foot { margin-top: 36px; padding-top: 12px; border-top: 1px solid #DCE5E0; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; font-size: 13px; color: #51635A; break-inside: avoid; page-break-inside: avoid; }
.mark { font-size: 11.5px; flex: none; }
`;

const CLASSIC_CSS = `
.head { background: #0B1F17; color: #ffffff; border-radius: 12px; padding: 22px 24px; align-items: center; }
.head .muted { color: #C9D8D0; }
.title-word { color: #00D27A; }
.logo { border: 1px solid #24382F; }
thead th { background: #EEF3F0; color: #3D4D45; }
thead th:first-child { border-start-start-radius: 6px; border-end-start-radius: 6px; }
thead th:last-child { border-start-end-radius: 6px; border-end-end-radius: 6px; }
`;

const SIMPLE_CSS = `
.head { padding-bottom: 18px; border-bottom: 3px solid #00D27A; }
.title-word { color: #0B1F17; }
thead th { border-bottom: 1.5px solid #0B1F17; color: #0B1F17; }
`;

export interface DocHtmlInput {
  doc: Doc;
  settings: Settings;
  lang: Lang;
  template?: TemplateId;
}

/** The whole quote or invoice as one self-contained HTML page: preview, print and PDF all use it. */
export function buildDocHtml({ doc, settings, lang, template }: DocHtmlInput): string {
  const t = (key: StringKey, vars?: Vars) => translate(lang, key, vars);
  const tpl = template ?? settings.template;
  const totals = docTotals(doc);
  const isQuote = doc.type === 'quote';
  const showBreakdown = totals.discount > 0 || totals.tax > 0;
  const taxLabel = `${settings.taxLabel.trim() || t('tax')} ${formatAmount(doc.taxPercent)}%`;
  const logo = settings.logo.startsWith('data:image/') ? `<img class="logo" src="${escapeHtml(settings.logo)}" alt="">` : '';
  const shopLine = [settings.address.trim(), settings.phone.trim()].filter(Boolean);

  const rows = doc.lines
    .map(
      (l) => `<tr>
<td><div dir="auto">${escapeHtml(l.name)}</div>${l.unit ? `<div class="unit muted" dir="auto">${escapeHtml(t('per', { unit: l.unit }))}</div>` : ''}</td>
<td class="r num">${formatAmount(l.qty)}</td>
<td class="r num">${formatAmount(l.price)}</td>
<td class="r num amount">${formatAmount(lineTotal(l))}</td>
</tr>`,
    )
    .join('\n');

  const paid =
    doc.type === 'invoice' && doc.status === 'paid'
      ? `<div><span class="paid display">${escapeHtml(t('paidStamp'))}${doc.paidOn ? `<small>${escapeHtml(formatDate(doc.paidOn, lang))}</small>` : ''}</span></div>`
      : '';

  return `<!doctype html>
<html lang="${lang}" dir="${lang === 'ur' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${PAGE_WIDTH}">
<title>${escapeHtml(doc.number)}</title>
${FONT_LINK}
<style>${BASE_CSS}${tpl === 'simple' ? SIMPLE_CSS : CLASSIC_CSS}</style>
</head>
<body>
<div class="head">
  <div class="shop">
    ${logo}
    <div style="min-width:0">
      <div class="shop-name display" dir="auto">${escapeHtml(settings.shopName.trim() || t('myShop'))}</div>
      ${shopLine.length ? `<div class="shop-line muted" dir="auto">${shopLine.map(escapeHtml).join(' · ')}</div>` : ''}
    </div>
  </div>
  <div class="title">
    <div class="title-word display">${escapeHtml(t(isQuote ? 'docQuotation' : 'docInvoice'))}</div>
    <div class="title-num muted num">${escapeHtml(doc.number)}</div>
  </div>
</div>

<div class="meta">
  <div>
    <div class="label muted">${escapeHtml(t(isQuote ? 'quoteFor' : 'billTo'))}</div>
    <div class="strong" dir="auto">${escapeHtml(doc.customerName.trim() || '—')}</div>
    ${doc.customerPhone ? `<div class="muted num">${escapeHtml(doc.customerPhone)}</div>` : ''}
  </div>
  <div class="end">
    <div class="label muted">${escapeHtml(t('date'))}</div>
    <div class="strong">${escapeHtml(formatDate(doc.date, lang))}</div>
  </div>
</div>

<table>
<thead><tr>
<th>${escapeHtml(t('colItem'))}</th>
<th class="r">${escapeHtml(t('colQty'))}</th>
<th class="r">${escapeHtml(t('colPrice'))}</th>
<th class="r">${escapeHtml(t('colAmount'))}</th>
</tr></thead>
<tbody>
${rows}
</tbody>
</table>

<div class="totals"><div class="totals-box">
${showBreakdown ? `<div class="trow"><span class="muted">${escapeHtml(t('subtotal'))}</span><span class="num">${formatAmount(totals.subtotal)}</span></div>` : ''}
${totals.discount > 0 ? `<div class="trow"><span class="muted">${escapeHtml(t('discount'))}</span><span class="num">− ${formatAmount(totals.discount)}</span></div>` : ''}
${totals.tax > 0 ? `<div class="trow"><span class="muted" dir="auto">${escapeHtml(taxLabel)}</span><span class="num">${formatAmount(totals.tax)}</span></div>` : ''}
<div class="trow grand"><span class="k">${escapeHtml(t('total'))}</span><span class="v display num">${escapeHtml(money(totals.total, settings.currency))}</span></div>
${paid}
</div></div>

${doc.notes.trim() ? `<div class="notes" dir="auto">${multiline(doc.notes.trim())}</div>` : ''}

<div class="foot">
  <div dir="auto">${multiline(settings.footerNote.trim() || t('defaultFooter'))}</div>
  <div class="mark">${escapeHtml(t('madeWith'))}</div>
</div>
</body>
</html>`;
}

/** File name for the shared PDF, safe on every phone: "Quote Q-0012 Bilal Traders". */
export function docFileName(doc: Doc): string {
  const kind = doc.type === 'quote' ? 'Quote' : 'Invoice';
  const who = doc.customerName.replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  return [kind, doc.number.replace(/[^A-Za-z0-9-]+/g, ''), who].filter(Boolean).join(' ');
}

/** Digits only, with a leading 0 turned into Pakistan's 92 so WhatsApp can open the chat. */
export function whatsappNumber(phone: string, defaultCountry = '92'): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (phone.trim().startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return defaultCountry + digits.slice(1);
  return digits;
}
