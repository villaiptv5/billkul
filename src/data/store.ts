import { isoDate } from '../logic/dates';
import { formatDocNumber, isEmptyDoc } from '../logic/totals';
import { SAMPLE_ITEMS } from './seed';
import type { KV } from './storage';
import { stockLevels } from '../logic/stock';
import type { AppData, BusinessType, CashEntry, CashKind, Customer, Doc, DocLine, DocType, Item, Lang, Settings, StockMove, StockMoveKind } from './types';

const K = {
  settings: 'bk1:settings',
  customers: 'bk1:customers',
  items: 'bk1:items',
  docIndex: 'bk1:docIndex',
  cash: 'bk1:cash',
  stock: 'bk1:stock',
  doc: (id: string) => `bk1:doc:${id}`,
};

export const DEFAULT_SETTINGS: Settings = {
  setupDone: false,
  language: 'en',
  businessType: 'other',
  shopName: '',
  phone: '',
  address: '',
  logo: '',
  currency: { code: 'PKR', symbol: 'Rs' },
  taxLabel: '',
  taxPercent: 0,
  quotePrefix: 'Q-',
  invoicePrefix: 'INV-',
  nextQuote: 1,
  nextInvoice: 1,
  template: 'classic',
  footerNote: '',
  lastBackupAt: '',
};

export interface State extends AppData {
  ready: boolean;
}

let counter = 0;
export function uid(): string {
  counter = (counter + 1) % 1296;
  return Date.now().toString(36) + counter.toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 6);
}

function readJson<T>(kv: KV, key: string, fallback: T): T {
  try {
    const raw = kv.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export interface SetupInput {
  language: Lang;
  businessType: BusinessType;
  shopName: string;
  phone: string;
  logo: string;
}

export const BACKUP_APP = 'billkul';
export const BACKUP_VERSION = 2;

/** Items saved before stock existed have no stock fields; this fills them in. */
function normalItem(item: Item): Item {
  return { ...item, trackStock: !!item.trackStock, lowStock: Number(item.lowStock) || 0 };
}

export interface ItemInput extends Partial<Item> {
  name: string;
}

export interface CashInput {
  id?: string;
  kind: CashKind;
  amount: number;
  date?: string;
  category?: string;
  note?: string;
}

export function createStore(kv: KV) {
  let state: State = { ready: false, settings: DEFAULT_SETTINGS, customers: [], items: [], docs: [], cash: [], stockMoves: [] };
  const listeners = new Set<() => void>();

  function set(next: Partial<State>) {
    state = { ...state, ...next };
    listeners.forEach((fn) => fn());
  }

  function persistSettings(settings: Settings) {
    kv.setItem(K.settings, JSON.stringify(settings));
  }
  function persistDoc(doc: Doc) {
    kv.setItem(K.doc(doc.id), JSON.stringify(doc));
  }
  function persistDocIndex(docs: Doc[]) {
    kv.setItem(K.docIndex, JSON.stringify(docs.map((d) => d.id)));
  }

  function load() {
    const settings = { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(kv, K.settings, {}) };
    const customers = readJson<Customer[]>(kv, K.customers, []);
    const items = readJson<Item[]>(kv, K.items, []).map(normalItem);
    const cash = readJson<CashEntry[]>(kv, K.cash, []);
    const stockMoves = readJson<StockMove[]>(kv, K.stock, []);
    const ids = readJson<string[]>(kv, K.docIndex, []);
    const docs: Doc[] = [];
    for (const id of ids) {
      const doc = readJson<Doc | null>(kv, K.doc(id), null);
      if (doc && doc.id) docs.push(doc);
    }
    set({ ready: true, settings, customers, items, docs, cash, stockMoves });
  }

  function updateSettings(patch: Partial<Settings>) {
    const settings = { ...state.settings, ...patch };
    persistSettings(settings);
    set({ settings });
  }

  function completeSetup(input: SetupInput, withSampleItems: boolean) {
    updateSettings({ ...input, shopName: input.shopName.trim(), phone: input.phone.trim(), setupDone: true });
    if (withSampleItems && state.items.length === 0) {
      const now = new Date().toISOString();
      const items = SAMPLE_ITEMS[input.businessType][input.language].map((s) => ({
        id: uid(),
        name: s.name,
        unit: s.unit,
        price: 0,
        trackStock: false,
        lowStock: 0,
        createdAt: now,
      }));
      if (items.length) {
        kv.setItem(K.items, JSON.stringify(items));
        set({ items });
      }
    }
  }

  // ---- customers ----
  function saveCustomer(input: Partial<Customer> & { name: string }): Customer {
    const existing = input.id ? state.customers.find((c) => c.id === input.id) : undefined;
    const customer: Customer = {
      id: existing?.id ?? uid(),
      name: input.name.trim(),
      phone: (input.phone ?? existing?.phone ?? '').trim(),
      address: (input.address ?? existing?.address ?? '').trim(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const customers = existing
      ? state.customers.map((c) => (c.id === customer.id ? customer : c))
      : [...state.customers, customer];
    kv.setItem(K.customers, JSON.stringify(customers));
    set({ customers });
    return customer;
  }

  function saveCustomers(list: { name: string; phone: string }[]): number {
    const known = new Set(state.customers.map((c) => `${c.name.toLowerCase()}|${c.phone.replace(/\D/g, '')}`));
    const now = new Date().toISOString();
    const added: Customer[] = [];
    for (const entry of list) {
      const name = entry.name.trim();
      if (!name) continue;
      const key = `${name.toLowerCase()}|${entry.phone.replace(/\D/g, '')}`;
      if (known.has(key)) continue;
      known.add(key);
      added.push({ id: uid(), name, phone: entry.phone.trim(), address: '', createdAt: now });
    }
    if (added.length) {
      const customers = [...state.customers, ...added];
      kv.setItem(K.customers, JSON.stringify(customers));
      set({ customers });
    }
    return added.length;
  }

  function deleteCustomer(id: string) {
    const customers = state.customers.filter((c) => c.id !== id);
    kv.setItem(K.customers, JSON.stringify(customers));
    set({ customers });
  }

  // ---- items ----
  function saveItem(input: ItemInput): Item {
    const existing = input.id ? state.items.find((i) => i.id === input.id) : undefined;
    const item: Item = {
      id: existing?.id ?? uid(),
      name: input.name.trim(),
      unit: (input.unit ?? existing?.unit ?? '').trim(),
      price: input.price ?? existing?.price ?? 0,
      trackStock: input.trackStock ?? existing?.trackStock ?? false,
      lowStock: Math.max(0, input.lowStock ?? existing?.lowStock ?? 0),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const items = existing ? state.items.map((i) => (i.id === item.id ? item : i)) : [...state.items, item];
    kv.setItem(K.items, JSON.stringify(items));
    set({ items });
    return item;
  }

  function deleteItem(id: string) {
    const items = state.items.filter((i) => i.id !== id);
    kv.setItem(K.items, JSON.stringify(items));
    const stockMoves = state.stockMoves.filter((m) => m.itemId !== id);
    if (stockMoves.length !== state.stockMoves.length) kv.setItem(K.stock, JSON.stringify(stockMoves));
    set({ items, stockMoves });
  }

  // ---- stock ----
  function putStockMove(itemId: string, kind: StockMoveKind, qty: number, extra: { cost?: number; note?: string; date?: string } = {}): StockMove | undefined {
    if (!qty || !state.items.some((i) => i.id === itemId)) return undefined;
    const move: StockMove = {
      id: uid(),
      itemId,
      kind,
      date: extra.date ?? isoDate(),
      qty,
      cost: Math.max(0, extra.cost ?? 0),
      note: (extra.note ?? '').trim(),
      createdAt: new Date().toISOString(),
    };
    const stockMoves = [...state.stockMoves, move];
    kv.setItem(K.stock, JSON.stringify(stockMoves));
    set({ stockMoves });
    return move;
  }

  function hasMoves(itemId: string): boolean {
    return state.stockMoves.some((m) => m.itemId === itemId);
  }

  function stockOf(itemId: string): number {
    return stockLevels(state.items, state.stockMoves, state.docs).get(itemId) ?? 0;
  }

  /** Stock that arrived. Turns stock counting on for the item if it was off. */
  function addStock(itemId: string, qty: number, extra: { cost?: number; note?: string; date?: string } = {}): StockMove | undefined {
    if (!(qty > 0)) return undefined;
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return undefined;
    if (!item.trackStock) saveItem({ id: item.id, name: item.name, trackStock: true });
    return putStockMove(itemId, hasMoves(itemId) ? 'add' : 'open', qty, extra);
  }

  /** The shelf was counted and the number is different: stock is set to what was counted. */
  function setStock(itemId: string, counted: number, date?: string): StockMove | undefined {
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return undefined;
    if (!item.trackStock) saveItem({ id: item.id, name: item.name, trackStock: true });
    return putStockMove(itemId, hasMoves(itemId) ? 'correct' : 'open', counted - stockOf(itemId), { date });
  }

  // ---- cash book ----
  function saveCash(input: CashInput): CashEntry {
    const existing = input.id ? state.cash.find((e) => e.id === input.id) : undefined;
    const entry: CashEntry = {
      id: existing?.id ?? uid(),
      date: input.date ?? existing?.date ?? isoDate(),
      kind: input.kind,
      amount: Math.max(0, input.amount),
      category: input.kind === 'out' ? (input.category ?? existing?.category ?? 'other') : '',
      note: (input.note ?? existing?.note ?? '').trim(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const cash = existing ? state.cash.map((e) => (e.id === entry.id ? entry : e)) : [...state.cash, entry];
    kv.setItem(K.cash, JSON.stringify(cash));
    set({ cash });
    return entry;
  }

  function deleteCash(id: string) {
    const cash = state.cash.filter((e) => e.id !== id);
    kv.setItem(K.cash, JSON.stringify(cash));
    set({ cash });
  }

  // ---- documents ----
  function putDoc(doc: Doc, isNew: boolean) {
    persistDoc(doc);
    const docs = isNew ? [...state.docs, doc] : state.docs.map((d) => (d.id === doc.id ? doc : d));
    if (isNew) persistDocIndex(docs);
    set({ docs });
  }

  function createDoc(type: DocType, today: string = isoDate()): Doc {
    const s = state.settings;
    const seq = type === 'quote' ? s.nextQuote : s.nextInvoice;
    const now = new Date().toISOString();
    const doc: Doc = {
      id: uid(),
      type,
      seq,
      number: formatDocNumber(type === 'quote' ? s.quotePrefix : s.invoicePrefix, seq),
      date: today,
      customerId: '',
      customerName: '',
      customerPhone: '',
      lines: [],
      discount: 0,
      taxPercent: s.taxPercent,
      notes: '',
      status: 'draft',
      invoiceId: '',
      quoteId: '',
      paidOn: '',
      createdAt: now,
      updatedAt: now,
    };
    updateSettings(type === 'quote' ? { nextQuote: seq + 1 } : { nextInvoice: seq + 1 });
    putDoc(doc, true);
    return doc;
  }

  /** Autosave: called on every edit. */
  function saveDoc(doc: Doc): Doc {
    const saved = { ...doc, updatedAt: new Date().toISOString() };
    putDoc(saved, !state.docs.some((d) => d.id === doc.id));
    return saved;
  }

  function patchDoc(id: string, patch: Partial<Doc>): Doc | undefined {
    const doc = state.docs.find((d) => d.id === id);
    return doc ? saveDoc({ ...doc, ...patch }) : undefined;
  }

  function removeDocRecord(id: string) {
    kv.removeItem(K.doc(id));
    const docs = state.docs.filter((d) => d.id !== id);
    persistDocIndex(docs);
    set({ docs });
  }

  function deleteDoc(id: string) {
    const doc = state.docs.find((d) => d.id === id);
    if (!doc) return;
    if (doc.quoteId) patchDoc(doc.quoteId, { invoiceId: '' });
    if (doc.invoiceId) patchDoc(doc.invoiceId, { quoteId: '' });
    removeDocRecord(id);
  }

  /** A document opened and left blank is removed, and its number is given back. */
  function discardIfEmpty(id: string): boolean {
    const doc = state.docs.find((d) => d.id === id);
    if (!doc || doc.status !== 'draft' || !isEmptyDoc(doc)) return false;
    removeDocRecord(id);
    const s = state.settings;
    if (doc.type === 'quote' && s.nextQuote === doc.seq + 1) updateSettings({ nextQuote: doc.seq });
    if (doc.type === 'invoice' && s.nextInvoice === doc.seq + 1) updateSettings({ nextInvoice: doc.seq });
    return true;
  }

  /** Quote or invoice has gone to the customer: a quote becomes sent, an invoice becomes due. */
  function markSent(id: string) {
    const doc = state.docs.find((d) => d.id === id);
    if (doc && doc.status === 'draft') patchDoc(id, { status: doc.type === 'quote' ? 'sent' : 'due' });
  }

  function markAccepted(id: string) {
    const doc = state.docs.find((d) => d.id === id);
    if (doc && doc.type === 'quote') patchDoc(id, { status: 'accepted' });
  }

  function markPaid(id: string, today: string = isoDate()) {
    const doc = state.docs.find((d) => d.id === id);
    if (doc && doc.type === 'invoice') patchDoc(id, { status: 'paid', paidOn: today });
  }

  function markUnpaid(id: string) {
    const doc = state.docs.find((d) => d.id === id);
    if (doc && doc.type === 'invoice' && doc.status === 'paid') patchDoc(id, { status: 'due', paidOn: '' });
  }

  /** One tap from quote to invoice. Asking twice returns the invoice already made. */
  function convertToInvoice(quoteId: string, today: string = isoDate()): Doc | undefined {
    const quote = state.docs.find((d) => d.id === quoteId);
    if (!quote || quote.type !== 'quote') return undefined;
    const existing = quote.invoiceId ? state.docs.find((d) => d.id === quote.invoiceId) : undefined;
    if (existing) return existing;
    const blank = createDoc('invoice', today);
    const invoice = saveDoc({
      ...blank,
      customerId: quote.customerId,
      customerName: quote.customerName,
      customerPhone: quote.customerPhone,
      lines: quote.lines.map((l): DocLine => ({ ...l, id: uid() })),
      discount: quote.discount,
      taxPercent: quote.taxPercent,
      notes: quote.notes,
      status: 'due',
      quoteId: quote.id,
    });
    patchDoc(quote.id, { status: 'accepted', invoiceId: invoice.id });
    return invoice;
  }

  // ---- backup ----
  function exportBackup(): string {
    const data: AppData = {
      settings: state.settings,
      customers: state.customers,
      items: state.items,
      docs: state.docs,
      cash: state.cash,
      stockMoves: state.stockMoves,
    };
    return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data });
  }

  /** Replaces everything on this device with the backup. Returns false if the file is not a BillKul backup. */
  function importBackup(json: string): boolean {
    let parsed: { app?: string; version?: number; data?: Partial<AppData> };
    try {
      parsed = JSON.parse(json);
    } catch {
      return false;
    }
    const data = parsed?.data;
    if (parsed?.app !== BACKUP_APP || !data || !Array.isArray(data.docs) || !data.settings) return false;
    for (const doc of state.docs) kv.removeItem(K.doc(doc.id));
    const settings: Settings = { ...DEFAULT_SETTINGS, ...data.settings, setupDone: true };
    const customers = Array.isArray(data.customers) ? data.customers : [];
    const items = (Array.isArray(data.items) ? data.items : []).map(normalItem);
    // Backups made before the cash book and stock existed simply have none.
    const cash = Array.isArray(data.cash) ? data.cash.filter((e) => e && e.id) : [];
    const stockMoves = Array.isArray(data.stockMoves) ? data.stockMoves.filter((m) => m && m.id) : [];
    const docs = data.docs.filter((d) => d && d.id);
    persistSettings(settings);
    kv.setItem(K.customers, JSON.stringify(customers));
    kv.setItem(K.items, JSON.stringify(items));
    kv.setItem(K.cash, JSON.stringify(cash));
    kv.setItem(K.stock, JSON.stringify(stockMoves));
    docs.forEach(persistDoc);
    persistDocIndex(docs);
    set({ settings, customers, items, docs, cash, stockMoves });
    return true;
  }

  return {
    getState: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    load,
    updateSettings,
    completeSetup,
    saveCustomer,
    saveCustomers,
    deleteCustomer,
    saveItem,
    deleteItem,
    addStock,
    setStock,
    saveCash,
    deleteCash,
    createDoc,
    saveDoc,
    patchDoc,
    deleteDoc,
    discardIfEmpty,
    markSent,
    markAccepted,
    markPaid,
    markUnpaid,
    convertToInvoice,
    exportBackup,
    importBackup,
  };
}

export type Store = ReturnType<typeof createStore>;

/** Newest first: by document date, then by when it was created. */
export function sortDocs(docs: Doc[]): Doc[] {
  return [...docs].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}
