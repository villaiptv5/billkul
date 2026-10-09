import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/**
 * Reading and writing the simple spreadsheets used to bring items in: the first sheet of an Excel
 * file (.xlsx), or a CSV file. Only cell values are read; formulas give their last saved result.
 */

export type Cell = string | number;

/** A CSV file as rows of text. Handles quotes, a byte-order mark, and comma, semicolon or tab separators. */
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, '');
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length] as const);
  const sep = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && body[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** All the text runs inside one shared string or inline string, joined. */
function textOf(xml: string): string {
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out += m[1] ?? '';
  return unescapeXml(out);
}

/** "B12" → column 1 (A is 0). */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** The first sheet of an Excel (.xlsx) file as rows of text. Throws when the file is not one. */
export function readXlsx(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes, { filter: (f) => (f.name.startsWith('xl/') && f.name.endsWith('.xml')) || f.name.endsWith('.rels') });
  const read = (name: string) => (files[name] ? strFromU8(files[name]) : '');

  // The first sheet in the workbook's order, found through the relationships file.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const firstSheet = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(read('xl/workbook.xml'));
  if (firstSheet) {
    const rel = new RegExp(`<Relationship\\b[^>]*\\bId="${firstSheet[1]}"[^>]*\\bTarget="([^"]+)"`).exec(read('xl/_rels/workbook.xml.rels')) ?? new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${firstSheet[1]}"`).exec(read('xl/_rels/workbook.xml.rels'));
    if (rel) sheetPath = rel[1].startsWith('/') ? rel[1].slice(1) : `xl/${rel[1].replace(/^\.\//, '')}`;
  }
  const sheet = read(sheetPath);
  if (!sheet) throw new Error('not a spreadsheet');

  const shared: string[] = [];
  const sst = read('xl/sharedStrings.xml');
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let si: RegExpExecArray | null;
  while ((si = siRe.exec(sst))) shared.push(textOf(si[1]));

  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(sheet))) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let c: RegExpExecArray | null;
    let next = 0;
    while ((c = cellRe.exec(rowMatch[1] ?? ''))) {
      const attrs = c[1];
      const inner = c[2] ?? '';
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const col = ref ? columnIndex(ref) : next;
      next = col + 1;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? 'n';
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textOf(inner);
      else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
      else value = raw !== undefined ? unescapeXml(raw) : '';
      while (cells.length < col) cells.push('');
      cells[col] = value;
    }
    rows.push(cells);
  }
  return rows;
}

/** A one-sheet Excel file. The first row is bold, as headings. */
export function buildXlsx(rows: Cell[][], sheetName = 'Sheet1', widths: number[] = []): Uint8Array {
  const col = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const ref = `${col(c)}${r + 1}`;
          const style = r === 0 ? ' s="1"' : '';
          if (typeof value === 'number') return `<c r="${ref}"${style}><v>${value}</v></c>`;
          if (value === '') return '';
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
    'xl/styles.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${body}</sheetData></worksheet>`,
    ),
  };
  return zipSync(files);
}

/** Reads a chosen file: Excel by its zip signature, anything else as CSV text. */
export function readSheet(bytes: Uint8Array): string[][] {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return readXlsx(bytes);
  return parseCsv(strFromU8(bytes));
}
