import type { Currency } from '../data/types';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** 155000 -> "155,000"; 1234.5 -> "1,234.50". Whole numbers show no decimals. */
export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const v = round2(Math.abs(n));
  const whole = Math.floor(v);
  const cents = Math.round((v - whole) * 100);
  const wholeStr = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = n < 0 && v > 0 ? '-' : '';
  return cents === 0 ? sign + wholeStr : `${sign}${wholeStr}.${String(cents).padStart(2, '0')}`;
}

const EASTERN_DIGITS = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';

/** Reads what a shopkeeper types: commas, spaces, and Urdu or Arabic digits are all accepted. */
export function parseAmount(text: string): number {
  if (!text) return 0;
  let s = '';
  for (const ch of text) {
    const i = EASTERN_DIGITS.indexOf(ch);
    if (i >= 0) s += String(i % 10);
    else if (ch === '٫') s += '.';
    else s += ch;
  }
  s = s.replace(/[^0-9.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot >= 0) s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? round2(n) : 0;
}

export function money(n: number, currency: Currency): string {
  return `${currency.symbol} ${formatAmount(n)}`;
}

export const CURRENCIES: Currency[] = [
  { code: 'PKR', symbol: 'Rs' },
  { code: 'INR', symbol: '₹' },
  { code: 'BDT', symbol: '৳' },
  { code: 'AED', symbol: 'AED' },
  { code: 'SAR', symbol: 'SAR' },
  { code: 'QAR', symbol: 'QAR' },
  { code: 'OMR', symbol: 'OMR' },
  { code: 'KWD', symbol: 'KWD' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'EUR', symbol: '€' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'MYR', symbol: 'RM' },
  { code: 'LKR', symbol: 'LKR' },
  { code: 'NPR', symbol: 'NPR' },
];
