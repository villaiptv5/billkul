export type Lang = 'en' | 'ur';
export type DocType = 'quote' | 'invoice';
// Quotes move draft -> sent -> accepted. Invoices move draft -> due -> paid.
export type DocStatus = 'draft' | 'sent' | 'accepted' | 'due' | 'paid';
export type TemplateId = 'classic' | 'simple';
/** Roll width of a thermal (POS) receipt printer: 80 mm or 58 mm. */
export type ReceiptPaper = 'r80' | 'r58';
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
  /** The roll width last used for a thermal receipt. */
  receiptPaper: ReceiptPaper;
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
  /** Sale price: what the customer pays for one. */
  price: number;
  /** Purchase price: what the shop pays for one. 0 when not known, or for a service that costs nothing to supply. */
  cost: number;
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
  /** Purchase price of one at the time it was put on the document, for the profit report. Never printed. */
  cost?: number;
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

/** How much of the free allowance has been used. Counts what was ever made, so deleting gives nothing back. */
export interface Usage {
  docs: number;
  cash: number;
}

/** The signed-in BillKul account, as last heard from the account server. Kept on the device, never in a backup. */
export interface Account {
  /** International form, "+923001234567". */
  phone: string;
  token: string;
  plan: 'free' | 'pro';
  /** Last day of Pro as "2027-10-07", or '' when Pro has no end date. */
  proUntil: string;
  /** How many documents and cash book entries a free account may make. */
  limits: Usage;
  /** The owner's WhatsApp number for customers who want Pro, or ''. */
  supportWhatsapp: string;
}

export interface AppData {
  settings: Settings;
  customers: Customer[];
  items: Item[];
  docs: Doc[];
  cash: CashEntry[];
  stockMoves: StockMove[];
}
