import type { Lang } from '../data/types';

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_EN_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_UR = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar date as yyyy-mm-dd. */
export function isoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
  return { y: y || 1970, m: (m || 1) - 1, d: d || 1 };
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parts(iso);
  return isoDate(new Date(y, m, d + days));
}

/** Whole days from one date to a later one. */
export function daysBetween(from: string, to: string): number {
  const a = parts(from);
  const b = parts(to);
  return Math.round((Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d)) / 86_400_000);
}

/** "5 Oct 2026" or "5 اکتوبر 2026". */
export function formatDate(iso: string, lang: Lang): string {
  if (!iso) return '';
  const { y, m, d } = parts(iso);
  return `${d} ${(lang === 'ur' ? MONTHS_UR : MONTHS_EN)[m]} ${y}`;
}

/** "October 2026" or "اکتوبر 2026". */
export function formatMonth(iso: string, lang: Lang): string {
  const { y, m } = parts(iso);
  return `${(lang === 'ur' ? MONTHS_UR : MONTHS_EN_LONG)[m]} ${y}`;
}

/** Today and yesterday are named; older dates in this year drop the year. */
export function formatDay(iso: string, lang: Lang, today: string = isoDate()): string {
  if (iso === today) return lang === 'ur' ? 'آج' : 'Today';
  if (iso === addDays(today, -1)) return lang === 'ur' ? 'کل' : 'Yesterday';
  const { y, m, d } = parts(iso);
  const month = (lang === 'ur' ? MONTHS_UR : MONTHS_EN)[m];
  return y === parts(today).y ? `${d} ${month}` : `${d} ${month} ${y}`;
}

/** Same as formatDay, for the middle of a sentence: "today", "yesterday", "2 Oct". */
export function formatDayInline(iso: string, lang: Lang, today: string = isoDate()): string {
  const text = formatDay(iso, lang, today);
  return lang === 'en' && (iso === today || iso === addDays(today, -1)) ? text.toLowerCase() : text;
}

/** "5:40 pm" from an ISO timestamp, in local time. */
export function formatTime(isoTimestamp: string, lang: Lang): string {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return '';
  const h24 = d.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = lang === 'ur' ? (h24 < 12 ? 'صبح' : 'شام') : h24 < 12 ? 'am' : 'pm';
  const clock = `${h}:${pad(d.getMinutes())}`;
  return lang === 'ur' ? `${suffix} ${clock}` : `${clock} ${suffix}`;
}

/** A month's name for a month picker: "Oct" or "اکتوبر". `index` is 0 for January. */
export function shortMonthName(index: number, lang: Lang): string {
  return (lang === 'ur' ? MONTHS_UR : MONTHS_EN)[index] ?? '';
}

/**
 * The days of a month laid out in weeks from Monday, for a calendar: each week has 7 places,
 * '' where the place belongs to the month before or after. `month` is "2026-10".
 */
export function monthGrid(month: string): string[][] {
  const { y, m } = parts(`${month}-01`);
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const cells: string[] = [...Array<string>(lead).fill('')];
  for (let d = 1; d <= days; d++) cells.push(`${month}-${pad(d)}`);
  while (cells.length % 7) cells.push('');
  const weeks: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
