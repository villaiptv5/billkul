import type { Doc, DocLine } from '../data/types';
import { round2 } from './money';

export function lineTotal(line: Pick<DocLine, 'qty' | 'price'>): number {
  return round2((line.qty || 0) * (line.price || 0));
}

export interface DocTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

/** Discount is an amount taken off before tax, and never more than the subtotal. */
export function docTotals(doc: Pick<Doc, 'lines' | 'discount' | 'taxPercent'>): DocTotals {
  const subtotal = round2(doc.lines.reduce((sum, l) => sum + lineTotal(l), 0));
  const discount = Math.min(Math.max(doc.discount || 0, 0), subtotal);
  const taxable = round2(subtotal - discount);
  const tax = round2((taxable * Math.max(doc.taxPercent || 0, 0)) / 100);
  return { subtotal, discount, tax, total: round2(taxable + tax) };
}

export function formatDocNumber(prefix: string, seq: number): string {
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export function isEmptyDoc(doc: Pick<Doc, 'lines' | 'customerName' | 'notes' | 'discount'>): boolean {
  return doc.lines.length === 0 && !doc.customerName.trim() && !doc.notes.trim() && !doc.discount;
}
