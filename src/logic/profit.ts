import type { Doc, Item } from '../data/types';
import { monthKey } from './dates';
import type { CashRow } from './ledger';
import { round2 } from './money';
import { lineTotal } from './totals';

/** What one item earned in the month. */
export interface ItemProfit {
  key: string;
  name: string;
  qty: number;
  /** What it sold for, after the invoice discount and before tax. */
  sales: number;
  /** What those pieces cost the shop. */
  cost: number;
  profit: number;
}

export interface ProfitReport {
  sales: number;
  cost: number;
  /** Sales less what the items cost: the profit or loss on selling. */
  gross: number;
  /** Shop expenses for the month. Stock bought is not here: it is counted as cost when it sells. */
  expenses: number;
  /** Profit on sales less shop expenses. */
  net: number;
  /** Most profitable first. */
  byItem: ItemProfit[];
  /** Stock-counted items that sold without a purchase price, so their whole sale shows as profit. */
  missingCost: string[];
}

/** Money out that is not a running cost of the shop. */
const NOT_SHOP_EXPENSES = ['stock', 'personal'];

/**
 * Profit and loss for a month ("2026-10"). A sale counts on the invoice date once the invoice is issued;
 * drafts and quotes never count. Tax collected is not income, so it is left out.
 */
export function profitReport(docs: Doc[], items: Item[], cash: CashRow[], month: string): ProfitReport {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const sums = new Map<string, ItemProfit>();
  const missing = new Set<string>();
  let exactSales = 0;

  for (const doc of docs) {
    if (doc.type !== 'invoice' || doc.status === 'draft' || monthKey(doc.date) !== month) continue;
    const subtotal = doc.lines.reduce((sum, l) => sum + lineTotal(l), 0);
    if (!(subtotal > 0)) continue;
    // The discount is taken off the whole invoice, so each line gives up its share of it.
    const discount = Math.min(Math.max(doc.discount || 0, 0), subtotal);
    const kept = 1 - discount / subtotal;
    exactSales += subtotal - discount;
    for (const line of doc.lines) {
      const item = itemById.get(line.itemId);
      // A line written before the item had a purchase price falls back to the price it has now.
      const unitCost = line.cost || item?.cost || 0;
      const key = item ? item.id : `name:${line.name}`;
      const row = sums.get(key) ?? { key, name: item?.name ?? line.name, qty: 0, sales: 0, cost: 0, profit: 0 };
      row.qty += line.qty;
      row.sales += lineTotal(line) * kept;
      row.cost += line.qty * unitCost;
      sums.set(key, row);
      if (!(unitCost > 0) && item?.trackStock) missing.add(item.name);
    }
  }

  const byItem = [...sums.values()]
    .map((r) => ({ ...r, qty: round2(r.qty), sales: round2(r.sales), cost: round2(r.cost), profit: round2(r.sales - r.cost) }))
    .sort((a, b) => b.profit - a.profit || a.name.localeCompare(b.name));
  const sales = round2(exactSales);
  const cost = round2(byItem.reduce((sum, r) => sum + r.cost, 0));
  // Sharing a discount between lines can leave the rows a paisa off the true total; the biggest row takes it up.
  const drift = round2(sales - byItem.reduce((sum, r) => sum + r.sales, 0));
  if (drift && byItem.length) {
    const biggest = byItem.reduce((a, b) => (b.sales > a.sales ? b : a));
    biggest.sales = round2(biggest.sales + drift);
    biggest.profit = round2(biggest.sales - biggest.cost);
  }

  let expenses = 0;
  for (const row of cash) {
    if (row.kind === 'out' && monthKey(row.date) === month && !NOT_SHOP_EXPENSES.includes(row.category)) expenses += row.amount;
  }
  expenses = round2(expenses);
  const gross = round2(sales - cost);
  return { sales, cost, gross, expenses, net: round2(gross - expenses), byItem, missingCost: [...missing].sort() };
}

/** What the stock on the shelf cost: each counted item's stock at its purchase price. */
export function stockValue(items: Item[], levels: Map<string, number>): number {
  let value = 0;
  for (const item of items) {
    if (item.trackStock) value += Math.max(0, levels.get(item.id) ?? 0) * item.cost;
  }
  return round2(value);
}
