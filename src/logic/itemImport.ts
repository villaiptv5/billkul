import { buildXlsx, type Cell } from './sheet';

/** One item read from a sheet. Numbers left empty are undefined, so an existing item keeps its own. */
export interface ItemRow {
  name: string;
  unit?: string;
  price?: number;
  cost?: number;
  track?: boolean;
  opening?: number;
  lowAt?: number;
}

export interface ItemSheet {
  rows: ItemRow[];
  /** Spreadsheet row numbers (1 = first) that had something in them but no name. */
  noName: number[];
}

type Field = keyof ItemRow;

/** The template's columns, in order, with the words that name each column in English and Urdu. */
const COLUMNS: { field: Field; en: string; ur: string; words: string[]; width: number }[] = [
  { field: 'name', en: 'Item name', ur: 'آئٹم کا نام', words: ['name', 'item', 'product', 'نام', 'آئٹم'], width: 32 },
  { field: 'unit', en: 'Unit', ur: 'یونٹ', words: ['unit', 'یونٹ'], width: 12 },
  { field: 'price', en: 'Sale price', ur: 'فروخت قیمت', words: ['sale', 'selling', 'price', 'rate', 'فروخت'], width: 14 },
  { field: 'cost', en: 'Purchase price', ur: 'خرید قیمت', words: ['purchase', 'cost', 'buying', 'خرید'], width: 16 },
  { field: 'track', en: 'Count stock (yes/no)', ur: 'اسٹاک گنیں (ہاں/نہیں)', words: ['count', 'track', 'گنیں'], width: 20 },
  { field: 'opening', en: 'Stock now', ur: 'موجودہ اسٹاک', words: ['opening', 'stock now', 'in stock', 'quantity', 'qty', 'موجودہ'], width: 12 },
  { field: 'lowAt', en: 'Low stock alert at', ur: 'کم اسٹاک کی وارننگ', words: ['low', 'alert', 'warn', 'وارننگ', 'کم'], width: 18 },
];

/** The template to download: column names in English, then in Urdu, then two example rows to write over. */
export function itemTemplate(): Uint8Array {
  const rows: Cell[][] = [
    COLUMNS.map((c) => c.en),
    COLUMNS.map((c) => c.ur),
    ['USB Mouse', 'piece', 950, 700, 'yes', 25, 5],
    ['Laptop repair', 'job', 3000, '', 'no', '', ''],
  ];
  return buildXlsx(rows, 'Items', COLUMNS.map((c) => c.width));
}

function number(text: string): number | undefined {
  // Urdu and Arabic digits count as numbers too.
  const digits = text.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const clean = digits.replace(/[,\s]|rs\.?|pkr|₨/gi, '');
  if (clean === '') return undefined;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
}

function yes(text: string): boolean | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  if (['yes', 'y', 'true', '1', 'ہاں', 'han', 'haan'].includes(t)) return true;
  if (['no', 'n', 'false', '0', 'نہیں', 'nahi', 'nahin'].includes(t)) return false;
  return undefined;
}

/** Which column holds which field: from a heading row when there is one, otherwise the template's order. */
function headingMap(row: string[]): Map<Field, number> | null {
  const map = new Map<Field, number>();
  row.forEach((cell, i) => {
    const text = cell.trim().toLowerCase();
    if (!text) return;
    // The most specific words first, so "Purchase price" is not taken for the sale price.
    const order: Field[] = ['cost', 'track', 'lowAt', 'opening', 'unit', 'price', 'name'];
    for (const field of order) {
      const column = COLUMNS.find((c) => c.field === field)!;
      if (!map.has(field) && column.words.some((w) => text.includes(w))) {
        map.set(field, i);
        return;
      }
    }
  });
  return map.has('name') ? map : null;
}

/**
 * Turns a sheet into items. Heading rows (in English or Urdu) are recognised and skipped; the template's
 * example rows are skipped too, unless they were changed.
 */
export function itemsFromSheet(table: string[][]): ItemSheet {
  let columns = new Map<Field, number>(COLUMNS.map((c, i) => [c.field, i]));
  const rows: ItemRow[] = [];
  const noName: number[] = [];
  const seen = new Map<string, number>();
  table.forEach((raw, index) => {
    const cells = raw.map((c) => String(c ?? '').trim());
    if (!cells.some(Boolean)) return;
    const heading = headingMap(cells);
    if (heading && number(cells[heading.get('price') ?? -1] ?? '') === undefined) {
      columns = heading;
      return;
    }
    const get = (field: Field) => cells[columns.get(field) ?? -1] ?? '';
    const name = get('name').replace(/\s+/g, ' ');
    if (!name) {
      noName.push(index + 1);
      return;
    }
    if ((name === 'USB Mouse' && get('price') === '950' && get('cost') === '700') || (name === 'Laptop repair' && get('price') === '3000')) return;
    const row: ItemRow = { name };
    const unit = get('unit');
    if (unit) row.unit = unit;
    const price = number(get('price'));
    if (price !== undefined) row.price = price;
    const cost = number(get('cost'));
    if (cost !== undefined) row.cost = cost;
    const opening = number(get('opening'));
    const track = yes(get('track')) ?? (opening !== undefined && opening > 0 ? true : undefined);
    if (track !== undefined) row.track = track;
    if (opening !== undefined) row.opening = opening;
    const lowAt = number(get('lowAt'));
    if (lowAt !== undefined) row.lowAt = lowAt;
    // The same name twice in one sheet: the later row wins.
    const key = name.toLowerCase();
    if (seen.has(key)) rows[seen.get(key)!] = row;
    else {
      seen.set(key, rows.length);
      rows.push(row);
    }
  });
  return { rows, noName };
}
