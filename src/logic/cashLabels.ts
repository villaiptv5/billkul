import type { StringKey, Vars } from '../i18n';
import type { CashRow, ExpenseCategory } from './ledger';

export type Translate = (key: StringKey, vars?: Vars) => string;

const CATEGORY_KEYS: Record<ExpenseCategory, StringKey> = {
  rent: 'catRent',
  salaries: 'catSalaries',
  bills: 'catBills',
  stock: 'catStock',
  transport: 'catTransport',
  food: 'catFood',
  repairs: 'catRepairs',
  personal: 'catPersonal',
  other: 'catOther',
};

export function categoryKey(category: ExpenseCategory): StringKey {
  return CATEGORY_KEYS[category];
}

/** First line of a cash book row: what it was. */
export function cashTitle(row: CashRow, t: Translate): string {
  if (row.source === 'invoice') return t('cashFromInvoice', { number: row.label });
  if (row.kind === 'out' && row.category) return t(categoryKey(row.category));
  return row.note || t('moneyIn');
}

/** Second line of a cash book row: who or what for. Empty when the title already says it. */
export function cashDetail(row: CashRow): string {
  return row.source === 'manual' && row.kind === 'in' ? '' : row.note;
}
