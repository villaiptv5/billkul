import type { Customer, Lang, Settings } from '../data/types';
import { translate, type StringKey, type Vars } from '../i18n';
import { cashDetail, cashTitle } from '../logic/cashLabels';
import { formatDate } from '../logic/dates';
import type { CashRow } from '../logic/ledger';
import { formatAmount, money, round2 } from '../logic/money';
import type { CustomerSummary } from '../logic/stats';
import { docTotals } from '../logic/totals';
import { escapeHtml, pageHtml, shopHeadHtml } from './template';

const REPORT_CSS = `
.report-meta { display: flex; justify-content: space-between; gap: 24px; margin-top: 22px; }
.report-meta .label { font-size: 13px; }
.report-meta .strong { font-size: 18px; font-weight: 600; }
.report-meta .end { text-align: end; }
td.small, .small { font-size: 13px; }
td.red, .red { color: #B42318; font-weight: 700; }
td.green { color: #007A48; }
.empty { margin-top: 28px; padding: 22px; text-align: center; color: #51635A; background: #F4F7F5; border-radius: 8px; }
`;

function foot(lang: Lang): string {
  return `<div class="foot"><div></div><div class="mark">${escapeHtml(translate(lang, 'madeWith'))}</div></div>`;
}

export type CashSide = 'in' | 'out' | 'all';

export interface CashReportInput {
  /** The rows of the period, already filtered. */
  rows: CashRow[];
  side: CashSide;
  /** "October 2026" or "6 Oct 2026", as it should print. */
  period: string;
  settings: Settings;
  lang: Lang;
}

export function cashReportTotals(rows: CashRow[], side: CashSide): { in: number; out: number; shown: number } {
  let cashIn = 0;
  let cashOut = 0;
  for (const row of rows) {
    if (row.kind === 'in') cashIn += row.amount;
    else cashOut += row.amount;
  }
  cashIn = round2(cashIn);
  cashOut = round2(cashOut);
  return { in: cashIn, out: cashOut, shown: side === 'in' ? cashIn : side === 'out' ? cashOut : round2(cashIn - cashOut) };
}

/** The Cash In report, the Cash Out report, or the whole cash book, for one day or one month. */
export function buildCashReportHtml({ rows, side, period, settings, lang }: CashReportInput): string {
  const t = (key: StringKey, vars?: Vars) => translate(lang, key, vars);
  const list = [...rows].filter((r) => side === 'all' || r.kind === side).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const totals = cashReportTotals(list, side);
  const word = t(side === 'in' ? 'docCashIn' : side === 'out' ? 'docCashOut' : 'docCashBook');

  const body = list
    .map((row) => {
      const detail = cashDetail(row);
      const what = `<td><div dir="auto">${escapeHtml(cashTitle(row, t))}</div>${detail ? `<div class="unit muted" dir="auto">${escapeHtml(detail)}</div>` : ''}</td>`;
      const date = `<td class="small" style="white-space:nowrap">${escapeHtml(formatDate(row.date, lang))}</td>`;
      if (side === 'all') {
        return `<tr>${date}${what}<td class="r num green">${row.kind === 'in' ? formatAmount(row.amount) : ''}</td><td class="r num">${row.kind === 'out' ? formatAmount(row.amount) : ''}</td></tr>`;
      }
      return `<tr>${date}${what}<td class="r num amount">${formatAmount(row.amount)}</td></tr>`;
    })
    .join('\n');

  const head =
    side === 'all'
      ? `<th>${escapeHtml(t('date'))}</th><th>${escapeHtml(t('colDetails'))}</th><th class="r">${escapeHtml(t('moneyIn'))}</th><th class="r">${escapeHtml(t('moneyOut'))}</th>`
      : `<th>${escapeHtml(t('date'))}</th><th>${escapeHtml(t('colDetails'))}</th><th class="r">${escapeHtml(t('colAmount'))}</th>`;

  const totalRows =
    side === 'all'
      ? `<div class="trow"><span class="muted">${escapeHtml(t('totalCashIn'))}</span><span class="num">${formatAmount(totals.in)}</span></div>
<div class="trow"><span class="muted">${escapeHtml(t('totalCashOut'))}</span><span class="num">− ${formatAmount(totals.out)}</span></div>
<div class="trow grand"><span class="k">${escapeHtml(t('balance'))}</span><span class="v display num">${escapeHtml(money(totals.shown, settings.currency))}</span></div>`
      : `<div class="trow grand"><span class="k">${escapeHtml(t(side === 'in' ? 'totalCashIn' : 'totalCashOut'))}</span><span class="v display num">${escapeHtml(money(totals.shown, settings.currency))}</span></div>`;

  return pageHtml({
    lang,
    title: `${word} ${period}`,
    template: settings.template,
    css: REPORT_CSS,
    body: `${shopHeadHtml(settings, lang, word, escapeHtml(period))}
${
  list.length
    ? `<table>
<thead><tr>${head}</tr></thead>
<tbody>
${body}
</tbody>
</table>
<div class="totals"><div class="totals-box">
${totalRows}
</div></div>`
    : `<div class="empty">${escapeHtml(t('noEntriesInPeriod'))}</div>`
}
${foot(lang)}`,
  });
}

export interface StatementInput {
  customer: Customer;
  summary: CustomerSummary;
  /** Today, as it should print. */
  date: string;
  settings: Settings;
  lang: Lang;
}

/** A customer's statement: every invoice issued to them, what is paid, and what is still due. */
export function buildStatementHtml({ customer, summary, date, settings, lang }: StatementInput): string {
  const t = (key: StringKey, vars?: Vars) => translate(lang, key, vars);
  const issued = summary.invoices.filter((d) => d.status !== 'draft').sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq);

  const rows = issued
    .map((doc) => {
      const paid = doc.status === 'paid';
      const status = paid ? t('paidOn', { date: formatDate(doc.paidOn || doc.date, lang) }) : t('unpaid');
      return `<tr>
<td class="small" style="white-space:nowrap">${escapeHtml(formatDate(doc.date, lang))}</td>
<td class="num">${escapeHtml(doc.number)}</td>
<td class="small ${paid ? 'muted' : 'red'}">${escapeHtml(status)}</td>
<td class="r num amount">${formatAmount(docTotals(doc).total)}</td>
</tr>`;
    })
    .join('\n');

  return pageHtml({
    lang,
    title: `${t('statement')} ${customer.name}`,
    template: settings.template,
    css: REPORT_CSS,
    body: `${shopHeadHtml(settings, lang, t('docStatement'), escapeHtml(date))}
<div class="report-meta">
  <div>
    <div class="label muted">${escapeHtml(t('statementFor'))}</div>
    <div class="strong" dir="auto">${escapeHtml(customer.name)}</div>
    ${customer.phone ? `<div class="muted num">${escapeHtml(customer.phone)}</div>` : ''}
    ${customer.address ? `<div class="muted small" dir="auto">${escapeHtml(customer.address)}</div>` : ''}
  </div>
  <div class="end">
    <div class="label muted">${escapeHtml(t('balanceDue'))}</div>
    <div class="strong num${summary.due > 0 ? ' red' : ''}">${escapeHtml(money(summary.due, settings.currency))}</div>
  </div>
</div>
${
  issued.length
    ? `<table>
<thead><tr><th>${escapeHtml(t('date'))}</th><th>${escapeHtml(t('invoice'))}</th><th>${escapeHtml(t('colStatus'))}</th><th class="r">${escapeHtml(t('colAmount'))}</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<div class="totals"><div class="totals-box">
<div class="trow"><span class="muted">${escapeHtml(t('totalInvoiced'))}</span><span class="num">${formatAmount(summary.invoiced)}</span></div>
<div class="trow"><span class="muted">${escapeHtml(t('totalPaid'))}</span><span class="num">− ${formatAmount(summary.paid)}</span></div>
<div class="trow grand"><span class="k">${escapeHtml(t('balanceDue'))}</span><span class="v display num">${escapeHtml(money(summary.due, settings.currency))}</span></div>
</div></div>`
    : `<div class="empty">${escapeHtml(t('noCustomerDocs'))}</div>`
}
${foot(lang)}`,
  });
}

/** A file name safe on every phone: "Cash In October 2026". */
export function reportFileName(...parts: string[]): string {
  return parts
    .join(' ')
    .replace(/[^\p{L}\p{N} -]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}
