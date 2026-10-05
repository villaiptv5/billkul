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
}
