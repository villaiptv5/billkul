import { beforeEach, describe, expect, it } from 'vitest';
import { strToU8 } from 'fflate';
import { memoryKV } from '../src/data/storage';
import { createStore, type Store } from '../src/data/store';
import { itemsFromSheet, itemTemplate } from '../src/logic/itemImport';
import { buildXlsx, parseCsv, readSheet } from '../src/logic/sheet';
import { stockLevels } from '../src/logic/stock';

let store: Store;
beforeEach(() => {
  store = createStore(memoryKV());
  store.load();
});

describe('reading sheets', () => {
  it('reads CSV with quotes, commas inside quotes and a byte-order mark', () => {
    expect(parseCsv('﻿Name,Price\n"Cable, 2m",450\r\nFan,"5,000"\n')).toEqual([
      ['Name', 'Price'],
      ['Cable, 2m', '450'],
      ['Fan', '5,000'],
    ]);
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('writes an Excel file and reads it back, Urdu included', () => {
    const bytes = buildXlsx([['Name', 'قیمت'], ['پنکھا', 5000], ['A & B <x>', 1.5]]);
    expect(readSheet(bytes)).toEqual([['Name', 'قیمت'], ['پنکھا', '5000'], ['A & B <x>', '1.5']]);
  });

  it('reads the template as no items: headings and untouched examples are skipped', () => {
    expect(itemsFromSheet(readSheet(itemTemplate()))).toEqual({ rows: [], noName: [] });
  });
});

describe('items from a sheet', () => {
  it('takes the template columns, with Rs, commas and yes/no', () => {
    const table = readSheet(itemTemplate());
    table.push(['SSD 256 GB', 'piece', 'Rs 7,800', '6,000', 'yes', '12', '3'], ['', '', '100'], ['Fitting', '', '500', '', 'no', '', '']);
    const sheet = itemsFromSheet(table);
    expect(sheet.rows).toEqual([
      { name: 'SSD 256 GB', unit: 'piece', price: 7800, cost: 6000, track: true, opening: 12, lowAt: 3 },
      { name: 'Fitting', price: 500, track: false },
    ]);
    expect(sheet.noName).toEqual([6]);
  });

  it('finds columns by their headings in any order, in English or Urdu', () => {
    expect(itemsFromSheet(parseCsv('Purchase price,Product,Selling price\n700,Mouse,950')).rows).toEqual([{ name: 'Mouse', price: 950, cost: 700 }]);
    expect(itemsFromSheet([['نام', 'فروخت قیمت', 'خرید قیمت'], ['چارجر', '۱۲۰۰', '900']]).rows).toEqual([{ name: 'چارجر', price: 1200, cost: 900 }]);
  });

  it('reads a sheet without headings in the template order', () => {
    expect(itemsFromSheet([['Bulb', 'piece', '250', '180']]).rows).toEqual([{ name: 'Bulb', unit: 'piece', price: 250, cost: 180 }]);
  });
});

describe('importing items', () => {
  it('adds new items and updates ones with the same name, keeping what the sheet leaves empty', () => {
    const fan = store.saveItem({ name: 'Ceiling Fan', unit: 'piece', price: 9000, cost: 7000 });
    const result = store.importItems([
      { name: 'ceiling fan', price: 9500 },
      { name: 'LED Bulb', unit: 'piece', price: 300, cost: 220, track: true, opening: 40, lowAt: 10 },
    ]);
    expect(result).toEqual({ added: 1, updated: 1 });
    const items = store.getState().items;
    expect(items.find((i) => i.id === fan.id)).toMatchObject({ name: 'Ceiling Fan', unit: 'piece', price: 9500, cost: 7000 });
    const bulb = items.find((i) => i.name === 'LED Bulb')!;
    expect(bulb).toMatchObject({ price: 300, cost: 220, trackStock: true, lowStock: 10 });
    const { stockMoves, docs } = store.getState();
    expect(stockLevels(items, stockMoves, docs).get(bulb.id)).toBe(40);
  });

  it('sets the stock of an item already counted to the sheet number', () => {
    store.importItems([{ name: 'Cable', track: true, opening: 10 }]);
    store.importItems([{ name: 'Cable', opening: 7 }]);
    const { items, stockMoves, docs } = store.getState();
    expect(stockLevels(items, stockMoves, docs).get(items[0].id)).toBe(7);
  });

  it('does not change the cash in hand: stock from a sheet has no purchase recorded', () => {
    store.importItems([{ name: 'Cable', cost: 100, track: true, opening: 10 }]);
    expect(store.getState().stockMoves.every((m) => !(m.cost > 0))).toBe(true);
  });
});

it('treats a text file that is not CSV kindly', () => {
  expect(itemsFromSheet(readSheet(strToU8('just some words'))).rows).toEqual([{ name: 'just some words' }]);
});
