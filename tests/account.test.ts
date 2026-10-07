import { describe, expect, it } from 'vitest';
import { memoryKV } from '../src/data/storage';
import { createStore } from '../src/data/store';
import type { Account } from '../src/data/types';
import { joinPhone, localPhone, normalizePhone, showPhone } from '../src/logic/phone';
import { allowance, isPro } from '../src/logic/plan';

const account: Account = { phone: '+923001234567', token: 'a'.repeat(64), plan: 'free', proUntil: '', limits: { docs: 10, cash: 10 }, supportWhatsapp: '+923318222236' };

function fresh(seed: Record<string, string> = {}) {
  const kv = memoryKV(seed);
  const store = createStore(kv);
  store.load();
  return { kv, store };
}

describe('phone numbers', () => {
  it('turns the ways a Pakistani number is typed into one international form', () => {
    for (const typed of ['0300 1234567', '0300-1234567', '3001234567', '+92 300 1234567', '0092 300 1234567', '923001234567']) {
      expect(normalizePhone(typed)).toBe('+923001234567');
    }
  });
  it('refuses what cannot be a mobile number', () => {
    for (const typed of ['', 'hello', '12345', '+92 21 1234567', '0300 123456', '+92 300 12345678']) expect(normalizePhone(typed)).toBeNull();
  });
  it('accepts mobile numbers of other countries in international form', () => {
    expect(normalizePhone('+971 50 123 4567')).toBe('+971501234567');
    expect(normalizePhone('+1 (415) 555-0100')).toBe('+14155550100');
  });
  it('joins the country code and the number from the sign-in form', () => {
    expect(joinPhone('+92', '300 1234567')).toBe('+923001234567');
    expect(joinPhone('+92', '0300 1234567')).toBe('+923001234567');
    expect(joinPhone('92', '3001234567')).toBe('+923001234567');
    expect(joinPhone('+92', '')).toBeNull();
    expect(joinPhone('', '3001234567')).toBeNull();
  });
  it('shows a number so it can be checked by eye', () => {
    expect(showPhone('+923001234567')).toBe('+92 300 1234567');
    expect(localPhone('+923001234567')).toBe('0300 1234567');
    expect(localPhone('+971501234567')).toBe('+971501234567');
  });
});

describe('free allowance', () => {
  it('lets a free account make 10 documents and 10 cash entries', () => {
    const a = allowance(account, { docs: 7, cash: 10 }, '2026-10-07');
    expect(a.pro).toBe(false);
    expect(a.docs).toEqual({ limit: 10, used: 7, left: 3, full: false });
    expect(a.cash).toEqual({ limit: 10, used: 10, left: 0, full: true });
  });
  it('never limits Pro, until its last day has passed', () => {
    const pro: Account = { ...account, plan: 'pro', proUntil: '2026-12-31' };
    expect(isPro(pro, '2026-12-31')).toBe(true);
    expect(allowance(pro, { docs: 500, cash: 500 }, '2026-12-31').docs.full).toBe(false);
    expect(isPro(pro, '2027-01-01')).toBe(false);
    expect(allowance(pro, { docs: 500, cash: 500 }, '2027-01-01').docs.full).toBe(true);
    expect(isPro({ ...account, plan: 'pro', proUntil: '' }, '2099-01-01')).toBe(true);
  });
  it('follows limits changed on the account server', () => {
    expect(allowance({ ...account, limits: { docs: 25, cash: 5 } }, { docs: 12, cash: 5 }, '2026-10-07')).toMatchObject({ docs: { left: 13, full: false }, cash: { left: 0, full: true } });
  });
  it('treats someone not signed in as a free account', () => {
    expect(allowance(null, { docs: 10, cash: 0 }, '2026-10-07').docs.full).toBe(true);
  });
});

describe('usage on the device', () => {
  it('counts every document made, quotations and invoices together', () => {
    const { store } = fresh();
    const quote = store.createDoc('quote');
    store.saveDoc({ ...quote, lines: [{ id: 'l', itemId: '', name: 'Fan', unit: 'piece', qty: 1, price: 4500 }], status: 'sent' });
    store.createDoc('invoice');
    store.convertToInvoice(quote.id);
    expect(store.getState().usage.docs).toBe(3);
  });
  it('does not count a document that was left empty', () => {
    const { store } = fresh();
    const doc = store.createDoc('quote');
    expect(store.getState().usage.docs).toBe(1);
    expect(store.discardIfEmpty(doc.id)).toBe(true);
    expect(store.getState().usage.docs).toBe(0);
  });
  it('gives nothing back when a document or a cash entry is deleted', () => {
    const { store } = fresh();
    const doc = store.createDoc('invoice');
    store.saveDoc({ ...doc, lines: [{ id: 'l', itemId: '', name: 'Fan', unit: 'piece', qty: 1, price: 4500 }] });
    store.deleteDoc(doc.id);
    const entry = store.saveCash({ kind: 'out', amount: 1200 });
    store.saveCash({ id: entry.id, kind: 'out', amount: 1500 });
    store.deleteCash(entry.id);
    expect(store.getState().docs).toHaveLength(0);
    expect(store.getState().usage).toEqual({ docs: 1, cash: 1 });
  });
  it('survives a restart, and starts from what is on the device when it was never counted', () => {
    const first = fresh();
    first.store.createDoc('quote');
    first.store.saveCash({ kind: 'in', amount: 500 });
    first.kv.removeItem('bk1:usage');
    const again = createStore(first.kv);
    again.load();
    expect(again.getState().usage).toEqual({ docs: 1, cash: 1 });
    again.createDoc('quote');
    const third = createStore(first.kv);
    third.load();
    expect(third.getState().usage.docs).toBe(2);
  });
  it('takes the larger count when the account server has seen more, and never a smaller one', () => {
    const { store } = fresh();
    store.createDoc('quote');
    store.raiseUsage({ docs: 9, cash: 4 });
    expect(store.getState().usage).toEqual({ docs: 9, cash: 4 });
    store.raiseUsage({ docs: 2, cash: 0 });
    expect(store.getState().usage).toEqual({ docs: 9, cash: 4 });
  });
  it('counts a restored backup as used', () => {
    const source = fresh();
    for (let i = 0; i < 4; i++) source.store.createDoc('quote');
    const backup = source.store.exportBackup();
    const { store } = fresh();
    expect(store.importBackup(backup)).toBe(true);
    expect(store.getState().usage.docs).toBe(4);
  });
});

describe('account on the device', () => {
  it('keeps the sign-in across restarts and forgets it on sign-out, leaving the data', () => {
    const { kv, store } = fresh();
    store.createDoc('quote');
    store.signIn(account);
    const again = createStore(kv);
    again.load();
    expect(again.getState().account?.phone).toBe('+923001234567');
    again.updateAccount({ plan: 'pro', proUntil: '2027-10-07' });
    expect(again.getState().account?.plan).toBe('pro');
    again.signOut();
    const third = createStore(kv);
    third.load();
    expect(third.getState().account).toBeNull();
    expect(third.getState().docs).toHaveLength(1);
    expect(third.getState().usage.docs).toBe(1);
  });
  it('never puts the account or its token in a backup file', () => {
    const { store } = fresh();
    store.signIn(account);
    const backup = store.exportBackup();
    expect(backup).not.toContain(account.token);
    expect(backup).not.toContain('+923001234567');
  });
});
