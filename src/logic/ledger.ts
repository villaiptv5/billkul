import type { CashEntry, CashKind, Doc, Item, StockMove } from '../data/types';
import { monthKey } from './dates';
import { round2 } from './money';
import { docTotals } from './totals';

/** What money out is spent on. The order is the order shown when choosing one. */
export const EXPENSE_CATEGORIES = ['rent', 'salaries', 'bills', 'stock', 'transport', 'food', 'repairs', 'personal', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

/** One line of the cash book. Some are typed by hand; the rest come from paid invoices and stock bought. */
export interface CashRow {
  key: string;
  date: string;
  kind: CashKind;
  amount: number;
  /** Expense category for money out, '' for money in. */
  category: ExpenseCategory | '';
  source: 'manual' | 'invoice' | 'stock';
  /** The cash entry, invoice or item this line belongs to. */
  refId: string;
  /** Manual: the note. Invoice: the customer. Stock: the item. */
  note: string;
  /** Invoice number, for invoice lines. */
  label: string;
  createdAt: string;
}

export interface CashSources {
  cash: CashEntry[];
  docs: Doc[];
  stockMoves: StockMove[];
  items: Item[];
}

/** The whole cash book, newest first. */
export function cashRows({ cash, docs, stockMoves, items }: CashSources): CashRow[] {
  const rows: CashRow[] = [];
  for (const e of cash) {
    if (!(e.amount > 0)) continue;
    rows.push({
      key: `c:${e.id}`,
      date: e.date,
      kind: e.kind,
      amount: round2(e.amount),
      category: e.kind === 'out' ? (isExpenseCategory(e.category) ? e.category : 'other') : '',
      source: 'manual',
      refId: e.id,
      note: e.note,
      label: '',
      createdAt: e.createdAt,
    });
  }
  for (const doc of docs) {
    if (doc.type !== 'invoice' || doc.status !== 'paid') continue;
    const amount = docTotals(doc).total;
    if (!(amount > 0)) continue;
    rows.push({ key: `d:${doc.id}`, date: doc.paidOn || doc.date, kind: 'in', amount, category: '', source: 'invoice', refId: doc.id, note: doc.customerName, label: doc.number, createdAt: doc.paidAt || doc.issuedAt || doc.updatedAt });
  }
  const names = new Map(items.map((i) => [i.id, i.name]));
  for (const move of stockMoves) {
    if (!(move.cost > 0)) continue;
    rows.push({ key: `s:${move.id}`, date: move.date, kind: 'out', amount: round2(move.cost), category: 'stock', source: 'stock', refId: move.itemId, note: names.get(move.itemId) ?? '', label: '', createdAt: move.createdAt });
  }
  return rows.sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

/** Everything that came in, less everything that went out. */
export function cashInHand(rows: CashRow[]): number {
  let total = 0;
  for (const row of rows) total += row.kind === 'in' ? row.amount : -row.amount;
  return round2(total);
}

export function monthCash(rows: CashRow[], month: string): { in: number; out: number } {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const row of rows) {
    if (monthKey(row.date) !== month) continue;
    if (row.kind === 'in') moneyIn += row.amount;
    else moneyOut += row.amount;
  }
  return { in: round2(moneyIn), out: round2(moneyOut) };
}

export interface ExpenseSummary {
  total: number;
  /** Largest first; categories with nothing spent are left out. */
  byCategory: { category: ExpenseCategory; amount: number }[];
}

export function expenseSummary(rows: CashRow[], month: string): ExpenseSummary {
  const sums = new Map<ExpenseCategory, number>();
  for (const row of rows) {
    if (row.kind !== 'out' || monthKey(row.date) !== month || row.category === '') continue;
    sums.set(row.category, (sums.get(row.category) ?? 0) + row.amount);
  }
  const byCategory = [...sums.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount);
  return { total: round2(byCategory.reduce((sum, c) => sum + c.amount, 0)), byCategory };
}

/** "2026-10" moved by a number of months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map((x) => parseInt(x, 10));
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
