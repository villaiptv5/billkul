import type { Doc, Item } from '../data/types';
import { round2 } from './money';
import { lineTotal } from './totals';

/** One row of the sales report: an item, a day, or an invoice. */
export interface SalesRow {
  key: string;
  /** Item name, date (yyyy-mm-dd) or invoice number. */
  label: string;
  /** For an invoice row, the customer. */
  detail: string;
  /** How many pieces were sold. */
  qty: number;
  /** What they sold for, after the invoice discount and before tax. */
  sales: number;
  /** Sales less what the pieces cost the shop. Negative is a loss. */
  profit: number;
  /** How many invoices the row covers. */
  invoices: number;
}

export interface SalesReport {
  invoices: number;
  qty: number;
  sales: number;
  profit: number;
  /** Most profitable first. */
  byItem: SalesRow[];
  /** Newest first. */
  byDay: SalesRow[];
  /** Newest first; the key is the invoice to open. */
  byInvoice: SalesRow[];
  /** Stock-counted items that sold without a purchase price, so their whole sale shows as profit. */
  missingCost: string[];
}

/** The day an invoice's money came in: the day it was marked paid, or its own date. */
export function paidDate(doc: Doc): string {
  return doc.paidOn || doc.date;
}

function blank(key: string, label: string, detail = ''): SalesRow {
  return { key, label, detail, qty: 0, sales: 0, profit: 0, invoices: 0 };
}

function tidy(row: SalesRow): SalesRow {
  return { ...row, qty: round2(row.qty), sales: round2(row.sales), profit: round2(row.profit) };
}

/**
 * Sales and the profit on them for a day ("2026-10-06") or a month ("2026-10").
 * A sale counts only once it is paid, on the day the money came in: an unpaid invoice, a draft or a
 * quote is not a sale yet. (Stock still goes down when an unpaid invoice is issued: the goods have left.)
 * Profit is the sale price less the purchase price; tax collected is not income, so it is left out.
 */
export function salesReport(docs: Doc[], items: Item[], period: string): SalesReport {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const byItem = new Map<string, SalesRow>();
  const byDay = new Map<string, SalesRow>();
  const byInvoice: SalesRow[] = [];
  const missing = new Set<string>();
  const total = blank('total', '');

  for (const doc of docs) {
    const when = paidDate(doc);
    if (doc.type !== 'invoice' || doc.status !== 'paid' || !when.startsWith(period)) continue;
    const subtotal = doc.lines.reduce((sum, l) => sum + lineTotal(l), 0);
    if (!(subtotal > 0)) continue;
    // The discount is taken off the whole invoice, so each line gives up its share of it.
    const discount = Math.min(Math.max(doc.discount || 0, 0), subtotal);
    const kept = 1 - discount / subtotal;
    const invoice = blank(doc.id, doc.number, doc.customerName);
    invoice.invoices = 1;

    for (const line of doc.lines) {
      const item = itemById.get(line.itemId);
      // A line written before the item had a purchase price falls back to the price it has now.
      const unitCost = line.cost || item?.cost || 0;
      const sales = lineTotal(line) * kept;
      const profit = sales - line.qty * unitCost;
      const key = item ? item.id : `name:${line.name}`;
      const row = byItem.get(key) ?? blank(key, item?.name ?? line.name);
      row.qty += line.qty;
      row.sales += sales;
      row.profit += profit;
      byItem.set(key, row);
      invoice.qty += line.qty;
      invoice.profit += profit;
      if (!(unitCost > 0) && item?.trackStock) missing.add(item.name);
    }
    // Taken from the invoice itself, so sharing the discount between lines cannot leave it a paisa off.
    invoice.sales = subtotal - discount;
    byInvoice.push({ ...tidy(invoice), detail: doc.customerName, key: doc.id, label: doc.number });

    const day = byDay.get(when) ?? blank(when, when);
    for (const sum of [day, total]) {
      sum.qty += invoice.qty;
      sum.sales += invoice.sales;
      sum.profit += invoice.profit;
      sum.invoices += 1;
    }
    byDay.set(when, day);
  }

  const dates = new Map(docs.map((d) => [d.id, `${paidDate(d)}|${d.createdAt}`]));
  return {
    invoices: total.invoices,
    qty: round2(total.qty),
    sales: round2(total.sales),
    profit: round2(total.profit),
    byItem: [...byItem.values()].map(tidy).sort((a, b) => b.profit - a.profit || a.label.localeCompare(b.label)),
    byDay: [...byDay.values()].map(tidy).sort((a, b) => b.label.localeCompare(a.label)),
    byInvoice: byInvoice.sort((a, b) => (dates.get(b.key) ?? '').localeCompare(dates.get(a.key) ?? '')),
    missingCost: [...missing].sort(),
  };
}
