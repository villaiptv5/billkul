import type { Doc, Item, StockMove } from '../data/types';
import { round2 } from './money';

/** An invoice takes stock once it has gone to the customer. Drafts and quotes never do. */
function takesStock(doc: Doc): boolean {
  return doc.type === 'invoice' && doc.status !== 'draft';
}

/** How many of each tracked item are in stock: what was put in, less what the invoices sold. */
export function stockLevels(items: Item[], moves: StockMove[], docs: Doc[]): Map<string, number> {
  const levels = new Map<string, number>();
  for (const item of items) if (item.trackStock) levels.set(item.id, 0);
  for (const move of moves) {
    const now = levels.get(move.itemId);
    if (now !== undefined) levels.set(move.itemId, now + move.qty);
  }
  for (const doc of docs) {
    if (!takesStock(doc)) continue;
    for (const line of doc.lines) {
      const now = levels.get(line.itemId);
      if (now !== undefined) levels.set(line.itemId, now - line.qty);
    }
  }
  for (const [id, qty] of levels) levels.set(id, round2(qty));
  return levels;
}

export type StockState = 'ok' | 'low' | 'out';

export function stockState(item: Item, qty: number): StockState {
  if (qty <= 0) return 'out';
  return item.lowStock > 0 && qty <= item.lowStock ? 'low' : 'ok';
}

/** Tracked items that have run out or are at their warning level, emptiest first. */
export function lowStockItems(items: Item[], levels: Map<string, number>): Item[] {
  return items
    .filter((item) => item.trackStock && stockState(item, levels.get(item.id) ?? 0) !== 'ok')
    .sort((a, b) => (levels.get(a.id) ?? 0) - (levels.get(b.id) ?? 0) || a.name.localeCompare(b.name));
}

/** One change to an item's stock, for the history under the item. */
export interface StockEvent {
  key: string;
  date: string;
  /** Positive came in, negative went out. */
  qty: number;
  kind: 'open' | 'add' | 'correct' | 'invoice';
  /** Invoice: the customer. Otherwise the note. */
  note: string;
  /** Invoice number, for invoice lines. */
  label: string;
  /** The invoice to open, for invoice lines. */
  docId: string;
  createdAt: string;
}

/** Newest first. */
export function stockHistory(itemId: string, moves: StockMove[], docs: Doc[]): StockEvent[] {
  const events: StockEvent[] = [];
  for (const move of moves) {
    if (move.itemId !== itemId) continue;
    events.push({ key: `m:${move.id}`, date: move.date, qty: move.qty, kind: move.kind, note: move.note, label: '', docId: '', createdAt: move.createdAt });
  }
  for (const doc of docs) {
    if (!takesStock(doc)) continue;
    const qty = doc.lines.filter((l) => l.itemId === itemId).reduce((sum, l) => sum + l.qty, 0);
    if (qty) events.push({ key: `d:${doc.id}`, date: doc.date, qty: -qty, kind: 'invoice', note: doc.customerName, label: doc.number, docId: doc.id, createdAt: doc.createdAt });
  }
  return events.sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}
