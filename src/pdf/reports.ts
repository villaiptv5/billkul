import type { Customer, Lang, Settings } from '../data/types';
import { translate, type StringKey, type Vars } from '../i18n';
import { cashDetail, cashTitle } from '../logic/cashLabels';
import { formatDate, formatDateTime, formatNow } from '../logic/dates';
import type { CashRow } from '../logic/ledger';
import { formatAmount, money, round2 } from '../logic/money';
import type { SalesReport } from '../logic/sales';
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

/** The foot of every report: when it was made, and the BillKul mark. */
export function reportFoot(lang: Lang): string {
  return `<div class="foot"><div class="small muted">${escapeHtml(translate(lang, 'reportMadeAt', { when: formatNow(lang) }))}</div><div class="mark">${escapeHtml(translate(lang, 'madeWith'))}</div></div>`;
}
const foot = reportFoot;

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
      const date = `<td class="small" style="white-space:nowrap">${escapeHtml(formatDateTime(row.date, row.createdAt, lang))}</td>`;
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
  const issued = summary.invoices.filter((d) => d.status !== 'draft' && d.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq);

  const rows = issued
    .map((doc) => {
      const paid = doc.status === 'paid';
      const status = paid ? t('paidOn', { date: formatDate(doc.paidOn || doc.date, lang) }) : t('unpaid');
      return `<tr>
<td class="small" style="white-space:nowrap">${escapeHtml(formatDateTime(doc.date, doc.issuedAt || doc.createdAt, lang))}</td>
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

export interface SalesReportInput {
  report: SalesReport;
  /** 'month' lists the month day by day; 'day' lists that day's invoices. */
  mode: 'day' | 'month';
  /** "October 2026" or "6 Oct 2026", as it should print. */
  period: string;
  settings: Settings;
  lang: Lang;
}

/** The sales report for a day or a month: the totals, each day (or each invoice), and each item. Paid invoices only. */
export function buildSalesReportHtml({ report, mode, period, settings, lang }: SalesReportInput): string {
  const t = (key: StringKey, vars?: Vars) => translate(lang, key, vars);
  const signed = (n: number) => (n < 0 ? `− ${formatAmount(Math.abs(n))}` : formatAmount(n));
  const rowsBy = mode === 'month' ? [...report.byDay].sort((a, b) => a.label.localeCompare(b.label)) : report.byInvoice;
  const firstCol = mode === 'month' ? t('date') : t('invoice');
  const lines = rowsBy
    .map((r) => {
      const label = mode === 'month' ? formatDate(r.label, lang) : r.label;
      const detail = mode === 'month' ? t('soldCount', { n: formatAmount(r.qty) }) : r.detail;
      return `<tr><td><div class="num">${escapeHtml(label)}</div>${detail ? `<div class="unit muted" dir="auto">${escapeHtml(detail)}</div>` : ''}</td><td class="r num">${formatAmount(r.qty)}</td><td class="r num">${formatAmount(r.sales)}</td><td class="r num ${r.profit < 0 ? 'red' : 'green'}">${signed(r.profit)}</td></tr>`;
    })
    .join('\n');
  const items = report.byItem
    .map((r) => `<tr><td dir="auto">${escapeHtml(r.label)}</td><td class="r num">${formatAmount(r.qty)}</td><td class="r num">${formatAmount(r.sales)}</td><td class="r num ${r.profit < 0 ? 'red' : 'green'}">${signed(r.profit)}</td></tr>`)
    .join('\n');
  const head = (first: string) => `<thead><tr><th>${escapeHtml(first)}</th><th class="r">${escapeHtml(t('colSold'))}</th><th class="r">${escapeHtml(t('sales'))}</th><th class="r">${escapeHtml(t('profit'))}</th></tr></thead>`;
  const tile = (label: string, value: string, cls = '') => `<div class="tile"><div class="label muted">${escapeHtml(label)}</div><div class="strong num ${cls}">${value}</div></div>`;

  return pageHtml({
    lang,
    title: `${t('salesReport')} ${period}`,
    template: settings.template,
    css: `${REPORT_CSS}
.tiles { display: flex; gap: 12px; margin-top: 20px; }
.tile { flex: 1; padding: 10px 12px; border: 1px solid #DCE5E0; border-radius: 8px; }
.tile .label { font-size: 12px; }
.tile .strong { font-size: 17px; font-weight: 700; margin-top: 2px; }
h3 { font-size: 14px; margin: 22px 0 0; }`,
    body: `${shopHeadHtml(settings, lang, t('docSalesReport'), escapeHtml(period))}
${
  report.invoices
    ? `<div class="tiles">
${tile(t('invoices'), formatAmount(report.invoices))}
${tile(t('itemsSold'), formatAmount(report.qty))}
${tile(t('sales'), escapeHtml(money(report.sales, settings.currency)))}
${tile(t(report.profit < 0 ? 'loss' : 'profit'), escapeHtml(money(Math.abs(report.profit), settings.currency)), report.profit < 0 ? 'red' : 'green')}
</div>
<h3>${escapeHtml(t(mode === 'month' ? 'dayByDay' : 'invoices'))}</h3>
<table>${head(firstCol)}<tbody>
${lines}
</tbody></table>
<h3>${escapeHtml(t('byItem'))}</h3>
<table>${head(t('colItem'))}<tbody>
${items}
</tbody></table>
${report.missingCost.length ? `<div class="small muted" style="margin-top:12px">${escapeHtml(t('missingCost', { names: report.missingCost.join(', ') }))}</div>` : ''}`
    : `<div class="empty">${escapeHtml(t(mode === 'day' ? 'noSalesOn' : 'noSalesIn', { day: period, month: period }))}</div>`
}
${foot(lang)}`,
  });
}
