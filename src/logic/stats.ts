import type { Doc } from '../data/types';
import { daysBetween, monthKey } from './dates';
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

/** One unpaid invoice, with how long it has been waiting. */
export interface DueInvoice {
  doc: Doc;
  amount: number;
  /** Days since the invoice date. */
  days: number;
}

/** Everything one customer still owes. */
export interface DueGroup {
  key: string;
  customerId: string;
  name: string;
  phone: string;
  total: number;
  /** Oldest first. */
  invoices: DueInvoice[];
}

export interface DueReport {
  total: number;
  count: number;
  /** The customer who owes most comes first. */
  groups: DueGroup[];
  /** Quotes sent and not yet answered, newest first. */
  openQuotes: { doc: Doc; amount: number }[];
  openQuotesTotal: number;
}

/** Who owes what: every issued invoice not yet paid, grouped by customer. */
export function dueReport(docs: Doc[], today: string): DueReport {
  const groups = new Map<string, DueGroup>();
  const openQuotes: { doc: Doc; amount: number }[] = [];
  for (const doc of docs) {
    const amount = docTotals(doc).total;
    if (doc.type === 'quote') {
      if (doc.status === 'sent') openQuotes.push({ doc, amount });
      continue;
    }
    if (doc.status !== 'due') continue;
    const key = doc.customerId || `name:${doc.customerName.trim().toLowerCase()}`;
    const group = groups.get(key) ?? { key, customerId: doc.customerId, name: doc.customerName, phone: doc.customerPhone, total: 0, invoices: [] };
    group.total += amount;
    group.invoices.push({ doc, amount, days: Math.max(0, daysBetween(doc.date, today)) });
    groups.set(key, group);
  }
  const list = [...groups.values()].map((g) => ({ ...g, total: round2(g.total), invoices: g.invoices.sort((a, b) => a.doc.date.localeCompare(b.doc.date) || a.doc.seq - b.doc.seq) }));
  list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  openQuotes.sort((a, b) => b.doc.date.localeCompare(a.doc.date) || b.doc.seq - a.doc.seq);
  return {
    total: round2(list.reduce((sum, g) => sum + g.total, 0)),
    count: list.reduce((sum, g) => sum + g.invoices.length, 0),
    groups: list,
    openQuotes,
    openQuotesTotal: round2(openQuotes.reduce((sum, q) => sum + q.amount, 0)),
  };
}

/** One customer's history: every quote and invoice written for them, and the money side of it. */
export interface CustomerSummary {
  /** Newest first. Drafts are included so they can be found and finished. */
  quotes: Doc[];
  invoices: Doc[];
  /** Quotes sent or accepted. */
  quoted: number;
  /** Invoices issued. */
  invoiced: number;
  paid: number;
  due: number;
}

export function customerSummary(docs: Doc[], customerId: string): CustomerSummary {
  const mine = docs.filter((d) => d.customerId === customerId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const s: CustomerSummary = { quotes: [], invoices: [], quoted: 0, invoiced: 0, paid: 0, due: 0 };
  for (const doc of mine) {
    const total = docTotals(doc).total;
    if (doc.type === 'quote') {
      s.quotes.push(doc);
      if (doc.status !== 'draft') s.quoted += total;
      continue;
    }
    s.invoices.push(doc);
    if (doc.status === 'draft') continue;
    s.invoiced += total;
    if (doc.status === 'paid') s.paid += total;
    else s.due += total;
  }
  return { ...s, quoted: round2(s.quoted), invoiced: round2(s.invoiced), paid: round2(s.paid), due: round2(s.due) };
}

/** The paid invoices behind the Received figure: paid in the period ("2026-10" or a day), newest first. */
export function receivedIn(docs: Doc[], period: string): { docs: Doc[]; total: number } {
  const paid = docs.filter((d) => d.type === 'invoice' && d.status === 'paid' && (d.paidOn || d.date).startsWith(period));
  paid.sort((a, b) => (b.paidOn || b.date).localeCompare(a.paidOn || a.date) || b.seq - a.seq);
  return { docs: paid, total: round2(paid.reduce((sum, d) => sum + docTotals(d).total, 0)) };
}
