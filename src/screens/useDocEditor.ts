import { useRef } from 'react';
import { store, useAppState } from '../data/app';
import { uid } from '../data/store';
import type { Customer, Doc, DocLine, Item } from '../data/types';
import { docTotals, type DocTotals } from '../logic/totals';

export function matchItems(items: Item[], query: string, limit = 6): Item[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: Item[] = [];
  const contains: Item[] = [];
  for (const item of items) {
    const name = item.name.toLowerCase();
    if (name.startsWith(q)) starts.push(item);
    else if (name.includes(q)) contains.push(item);
  }
  return [...starts, ...contains].slice(0, limit);
}

export interface DocEditor {
  doc: Doc;
  totals: DocTotals;
  save: (patch: Partial<Doc>) => void;
  addItem: (item: Item) => void;
  /**
   * Adds a line for a name that is not in the items list yet. With `keep`, the item is saved to the
   * list too; without, it is a one-off line on this document only.
   */
  addNewItem: (input: { name: string; unit: string; price: number; cost: number; keep: boolean }) => void;
  changeLine: (line: DocLine, patch: Partial<DocLine>) => void;
  removeLine: (line: DocLine) => void;
  pickCustomer: (c: Customer) => void;
}

/** Everything the quote and invoice editor does to a document, shared by the phone and desktop layouts. */
export function useDocEditor(docId: string): DocEditor | null {
  const { docs, items } = useAppState();
  // Items that had no price when editing began: the price typed here is saved to the price list too.
  const pricing = useRef(new Set<string>());
  const doc = docs.find((d) => d.id === docId);
  if (!doc) return null;

  const save = (patch: Partial<Doc>) => void store.saveDoc({ ...doc, ...patch });

  const addItem = (item: Item) => {
    const existing = doc.lines.find((l) => l.itemId === item.id);
    const lines = existing
      ? doc.lines.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l))
      : [...doc.lines, { id: uid(), itemId: item.id, name: item.name, unit: item.unit, qty: 1, price: item.price, cost: item.cost }];
    save({ lines });
  };

  const changeLine = (line: DocLine, patch: Partial<DocLine>) => {
    save({ lines: doc.lines.map((l) => (l.id === line.id ? { ...l, ...patch } : l)) });
    if (patch.price !== undefined && line.itemId) {
      const item = items.find((i) => i.id === line.itemId);
      if (item && (!item.price || pricing.current.has(item.id))) {
        pricing.current.add(item.id);
        store.saveItem({ id: item.id, name: item.name, price: patch.price });
      }
    }
  };

  return {
    doc,
    totals: docTotals(doc),
    save,
    addItem,
    addNewItem: ({ name, unit, price, cost, keep }) => {
      if (keep) return addItem(store.saveItem({ name, unit, price, cost }));
      save({ lines: [...doc.lines, { id: uid(), itemId: '', name: name.trim(), unit: unit.trim(), qty: 1, price, cost }] });
    },
    changeLine,
    removeLine: (line) => save({ lines: doc.lines.filter((l) => l.id !== line.id) }),
    pickCustomer: (c) => save({ customerId: c.id, customerName: c.name, customerPhone: c.phone }),
  };
}
