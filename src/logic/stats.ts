import type { Doc } from '../data/types';
import { monthKey } from './dates';
import { round2 } from './money';
import { docTotals } from './totals';

export interface MonthStats {
  quoted: number;
  invoiced: number;
  received: number;
  /** Everything customers still owe, from any month. */
  due: number;
}

/** Drafts are unfinished, so they never count. */
export function monthStats(docs: Doc[], today: string): MonthStats {
  const month = monthKey(today);
  const s: MonthStats = { quoted: 0, invoiced: 0, received: 0, due: 0 };
  for (const doc of docs) {
    if (doc.status === 'draft') continue;
    const total = docTotals(doc).total;
    if (doc.type === 'quote') {
      if (monthKey(doc.date) === month) s.quoted += total;
      continue;
    }
    if (monthKey(doc.date) === month) s.invoiced += total;
    if (doc.status === 'paid' && monthKey(doc.paidOn || doc.date) === month) s.received += total;
    if (doc.status === 'due') s.due += total;
  }
  return { quoted: round2(s.quoted), invoiced: round2(s.invoiced), received: round2(s.received), due: round2(s.due) };
}

export function customerDue(docs: Doc[], customerId: string): number {
  let due = 0;
  for (const doc of docs) {
    if (doc.customerId === customerId && doc.type === 'invoice' && doc.status === 'due') due += docTotals(doc).total;
  }
  return round2(due);
}

export function customerDocCount(docs: Doc[], customerId: string): number {
  return docs.filter((d) => d.customerId === customerId).length;
}
