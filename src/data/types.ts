export type Lang = 'en' | 'ur';
export type DocType = 'quote' | 'invoice';
// Quotes move draft -> sent -> accepted. Invoices move draft -> due -> paid.
export type DocStatus = 'draft' | 'sent' | 'accepted' | 'due' | 'paid';
export type TemplateId = 'classic' | 'simple';
export type BusinessType = 'computer' | 'general' | 'services' | 'freelancer' | 'wholesale' | 'other';

export interface Currency {
  code: string;
  symbol: string;
}

export interface Settings {
  setupDone: boolean;
  language: Lang;
  businessType: BusinessType;
  shopName: string;
  phone: string;
  address: string;
  /** Logo as a data URI so it survives backup and works inside the PDF. */
  logo: string;
  currency: Currency;
  taxLabel: string;
  /** Default tax percent for new documents. 0 means no tax line. */
  taxPercent: number;
  quotePrefix: string;
  invoicePrefix: string;
  nextQuote: number;
  nextInvoice: number;
  template: TemplateId;
  footerNote: string;
  /** ISO timestamp of the last successful backup, or '' if never. */
  lastBackupAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface Item {
  id: string;
  name: string;
  unit: string;
  price: number;
  /** True when BillKul counts how many of this item are in stock. Services are left untracked. */
  trackStock: boolean;
  /** Warn when the stock falls to this number or below. 0 means no warning. */
  lowStock: number;
  createdAt: string;
}

/** Stock put in or corrected by hand. Stock sold is not stored: it is read from the invoices. */
export type StockMoveKind = 'open' | 'add' | 'correct';

export interface StockMove {
  id: string;
  itemId: string;
  kind: StockMoveKind;
  /** Local date, yyyy-mm-dd. */
  date: string;
  /** Positive adds stock, negative removes it. */
  qty: number;
  /** What was paid for this stock, or 0. It shows in the cash book as money out. */
  cost: number;
  note: string;
  createdAt: string;
}

export type CashKind = 'in' | 'out';

/** Money in or out typed by hand. Paid invoices and stock purchases reach the cash book on their own. */
export interface CashEntry {
  id: string;
  /** Local date, yyyy-mm-dd. */
  date: string;
  kind: CashKind;
  amount: number;
  /** For money out, one of the expense categories. Empty for money in. */
  category: string;
  note: string;
  createdAt: string;
}

export interface DocLine {
  id: string;
  itemId: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
}

export interface Doc {
  id: string;
  type: DocType;
  seq: number;
  number: string;
  /** Local date, yyyy-mm-dd. */
  date: string;
  customerId: string;
  /** Name and phone are copied in, so old documents never change when a customer is edited. */
  customerName: string;
  customerPhone: string;
  lines: DocLine[];
  discount: number;
  taxPercent: number;
  notes: string;
  status: DocStatus;
  /** Set on a quote once an invoice has been made from it. */
  invoiceId: string;
  /** Set on an invoice that came from a quote. */
  quoteId: string;
  /** Local date the invoice was marked as paid, yyyy-mm-dd, or ''. */
  paidOn: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  settings: Settings;
  customers: Customer[];
  items: Item[];
  docs: Doc[];
  cash: CashEntry[];
  stockMoves: StockMove[];
}
