import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { store, useAppState } from '../data/app';
import type { CashEntry, CashKind, Doc, DocLine, Item } from '../data/types';
import { cashDetail, cashTitle, categoryKey, type Translate } from '../logic/cashLabels';
import { addDays, formatDay, formatMonth, isoDate, monthKey } from '../logic/dates';
import { cashInHand, cashRows, EXPENSE_CATEGORIES, expenseSummary, monthCash, shiftMonth, type CashRow, type ExpenseCategory } from '../logic/ledger';
import { formatAmount, money, round2 } from '../logic/money';
import { lowStockItems, stockHistory, stockLevels, stockState, type StockEvent, type StockState } from '../logic/stock';
import { C } from '../theme';
import { Button, IconButton } from '../ui/Button';
import { Field, NumberField } from '../ui/Input';
import { Chip, Segmented, Sheet, SheetScroll, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';

export { cashDetail, cashTitle, categoryKey };

/** The cash book as it stands now, with this month's money in and out. */
export function useCashBook() {
  const { cash, docs, stockMoves, items } = useAppState();
  return useMemo(() => {
    const rows = cashRows({ cash, docs, stockMoves, items });
    return { rows, inHand: cashInHand(rows), month: monthCash(rows, monthKey(isoDate())) };
  }, [cash, docs, stockMoves, items]);
}

/** How many of each counted item are in stock, and which are low. */
export function useStock() {
  const { items, stockMoves, docs } = useAppState();
  return useMemo(() => {
    const levels = stockLevels(items, stockMoves, docs);
    return { levels, low: lowStockItems(items, levels) };
  }, [items, stockMoves, docs]);
}

/** "12 in stock", "Low stock: 2" or "Out of stock", with its colour. */
export function stockText(item: Item, qty: number, t: Translate): { text: string; state: StockState; color: string } {
  const state = stockState(item, qty);
  if (state === 'out') return { text: t('outOfStock'), state, color: C.danger };
  return { text: t('inStock', { n: formatAmount(qty) }), state, color: state === 'low' ? C.orange : C.muted };
}

/** "‹ label ›" for stepping through days or months. */
export function Stepper({ label, onPrev, onNext, prevLabel, nextLabel, canNext = true, testID }: { label: string; onPrev: () => void; onNext: () => void; prevLabel: string; nextLabel: string; canNext?: boolean; testID?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <IconButton icon="back" label={prevLabel} size={40} onPress={onPrev} testID={testID ? `${testID}-prev` : undefined} />
      <View style={{ flex: 1 }}>
        <T size={15} w="semibold" center numberOfLines={1} testID={testID}>
          {label}
        </T>
      </View>
      <View style={{ opacity: canNext ? 1 : 0.3 }}>
        <IconButton icon="chevron" label={nextLabel} size={40} onPress={canNext ? onNext : undefined} testID={testID ? `${testID}-next` : undefined} />
      </View>
    </View>
  );
}

/** Add or edit a line of the cash book. */
export function CashEntrySheet({ visible, onClose, kind, entry }: { visible: boolean; onClose: () => void; kind: CashKind; entry?: CashEntry }) {
  const { t } = useLocale();
  // The form is made afresh each time the sheet opens, so it always starts from the entry given.
  const [side, setSide] = useState<CashKind>(kind);
  useEffect(() => {
    if (visible) setSide(entry?.kind ?? kind);
  }, [visible, entry, kind]);
  return (
    <Sheet visible={visible} onClose={onClose} title={entry ? t('editEntry') : t(side === 'in' ? 'moneyIn' : 'moneyOut')}>
      {visible ? <CashForm key={entry?.id ?? kind} onClose={onClose} side={side} setSide={setSide} entry={entry} /> : null}
    </Sheet>
  );
}

function CashForm({ onClose, side, setSide, entry }: { onClose: () => void; side: CashKind; setSide: (k: CashKind) => void; entry?: CashEntry }) {
  const { t, lang } = useLocale();
  const { confirm, notify } = useDialogs();
  const currency = useAppState().settings.currency;
  const today = isoDate();
  const [amount, setAmount] = useState(entry?.amount ?? 0);
  const [category, setCategory] = useState<string>(entry?.category || 'other');
  const [note, setNote] = useState(entry?.note ?? '');
  const [date, setDate] = useState(entry?.date ?? today);

  const save = () => {
    if (!(amount > 0)) return notify(t('amountRequired'));
    store.saveCash({ id: entry?.id, kind: side, amount, category, note, date });
    onClose();
  };

  const remove = async () => {
    if (!entry) return;
    onClose();
    if (await confirm({ title: t('deleteEntryTitle'), body: t('deleteWarning'), confirmLabel: t('delete'), danger: true })) store.deleteCash(entry.id);
  };

  return (
      <SheetScroll>
        <Segmented
          value={side}
          onChange={setSide}
          options={[
            { value: 'in', label: t('moneyIn'), testID: 'cash-kind-in' },
            { value: 'out', label: t('moneyOut'), testID: 'cash-kind-out' },
          ]}
        />
        {/* Amount and date share a row, so Save stays in reach on a small phone. */}
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
          <View style={{ gap: 6 }}>
            <T size={13} w="semibold" color={C.muted}>
              {`${t('amount')} (${currency.code})`}
            </T>
            <NumberField label={t('amount')} value={amount} onChange={setAmount} width={136} height={56} align="end" blankZero autoFocus={!entry} onSubmit={save} testID="cash-amount" />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <T size={13} w="semibold" color={C.muted} center>
              {t('date')}
            </T>
            <View style={{ height: 56, justifyContent: 'center' }}>
              <Stepper label={formatDay(date, lang)} onPrev={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} canNext={date < today} prevLabel={t('previousDay')} nextLabel={t('nextDay')} testID="cash-date" />
            </View>
          </View>
        </View>
        {side === 'out' ? (
          <View style={{ gap: 6 }}>
            <T size={13} w="semibold" color={C.muted}>
              {t('category')}
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {EXPENSE_CATEGORIES.map((c) => (
                <Chip key={c} label={t(categoryKey(c))} selected={category === c} onPress={() => setCategory(c)} testID={`cat-${c}`} />
              ))}
            </View>
          </View>
        ) : null}
        <Field label={`${t('note')} (${t('optional')})`} value={note} onChangeText={setNote} placeholder={t('cashNotePh')} onSubmitEditing={save} testID="cash-note" />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          {entry ? <Button label={t('delete')} icon="trash" variant="danger" onPress={remove} testID="cash-delete" /> : null}
          <View style={{ flex: 1 }}>
            <Button label={t('save')} head onPress={save} testID="cash-save" />
          </View>
        </View>
      </SheetScroll>
  );
}

/** Stock that arrived, or the count corrected after checking the shelf. */
export function StockSheet({ visible, onClose, item, mode }: { visible: boolean; onClose: () => void; item?: Item; mode: 'add' | 'correct' }) {
  const { t } = useLocale();
  return (
    <Sheet visible={visible && !!item} onClose={onClose} title={t(mode === 'add' ? 'addStock' : 'correctStock')}>
      {visible && item ? <StockForm key={`${item.id}:${mode}`} onClose={onClose} item={item} mode={mode} /> : null}
    </Sheet>
  );
}

function StockForm({ onClose, item, mode }: { onClose: () => void; item: Item; mode: 'add' | 'correct' }) {
  const { t } = useLocale();
  const { notify } = useDialogs();
  const currency = useAppState().settings.currency;
  const { levels } = useStock();
  const now = levels.get(item.id) ?? 0;
  const [qty, setQty] = useState(mode === 'correct' ? now : 0);
  const [unitCost, setUnitCost] = useState(item.cost);
  // The amount paid follows quantity x purchase price until it is typed over.
  const [typedPaid, setTypedPaid] = useState<number | null>(null);
  const paid = typedPaid ?? round2(qty * unitCost);

  const save = () => {
    if (mode === 'add') {
      if (!(qty > 0)) return notify(t('qtyRequired'));
      store.addStock(item.id, qty, { cost: paid, unitCost });
    } else {
      store.setStock(item.id, Math.max(0, qty));
    }
    onClose();
  };

  return (
      <SheetScroll>
        <View style={{ gap: 2 }}>
          <T size={16} w="semibold">
            {item.name}
          </T>
          {item.trackStock ? (
            <T size={13.5} color={C.muted}>
              {`${t('stockNow')}: ${formatAmount(now)}`}
            </T>
          ) : null}
        </View>
        <View style={{ gap: 6 }}>
          <T size={13} w="semibold" color={C.muted}>
            {t(mode === 'add' ? 'qtyArrived' : 'countedNow')}
          </T>
          <NumberField label={t(mode === 'add' ? 'qtyArrived' : 'countedNow')} value={qty} onChange={setQty} width={160} height={56} blankZero={mode === 'add'} autoFocus onSubmit={save} testID="stock-qty" />
        </View>
        {mode === 'add' ? (
          <>
            <View style={{ gap: 6 }}>
              <T size={13} w="semibold" color={C.muted}>
                {`${t('purchasePriceEach')} (${currency.code})`}
              </T>
              <NumberField label={t('purchasePriceEach')} value={unitCost} onChange={setUnitCost} width={200} height={52} align="end" blankZero onSubmit={save} testID="stock-unit-cost" />
            </View>
            <View style={{ gap: 6 }}>
              <T size={13} w="semibold" color={C.muted}>
                {`${t('amountPaidNow')} (${currency.code})`}
              </T>
              <NumberField label={t('amountPaidNow')} value={paid} onChange={setTypedPaid} width={200} height={52} align="end" blankZero onSubmit={save} testID="stock-cost" />
              <T size={12.5} color={C.muted}>
                {t('amountPaidHint')}
              </T>
            </View>
          </>
        ) : null}
        <Button label={t('save')} head onPress={save} testID="stock-save" />
      </SheetScroll>
  );
}

/** One month's expenses: a month stepper, the total, and a bar for each category. */
export function ExpensesPanel({ rows }: { rows: CashRow[] }) {
  const { t, lang } = useLocale();
  const currency = useAppState().settings.currency;
  const thisMonth = monthKey(isoDate());
  const [month, setMonth] = useState(thisMonth);
  const summary = useMemo(() => expenseSummary(rows, month), [rows, month]);
  const monthName = formatMonth(`${month}-01`, lang);
  const largest = summary.byCategory[0]?.amount ?? 0;

  return (
    <View style={{ gap: 12 }}>
      <Stepper label={monthName} onPrev={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} canNext={month < thisMonth} prevLabel={t('previousMonth')} nextLabel={t('nextMonth')} testID="expense-month" />
      {summary.byCategory.length ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4 }}>
            <T size={14} color={C.muted}>
              {t('totalExpenses')}
            </T>
            <T size={20} w="semibold" head latin testID="expense-total">
              {money(summary.total, currency)}
            </T>
          </View>
          <View style={{ gap: 12 }}>
            {summary.byCategory.map(({ category, amount }) => (
              <View key={category} style={{ gap: 5 }} testID={`expense-${category}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingHorizontal: 4 }}>
                  <T size={14.5} w="medium">
                    {t(categoryKey(category))}
                  </T>
                  <T size={14.5} w="semibold" latin>
                    {formatAmount(amount)}
                  </T>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: C.bgDeep, overflow: 'hidden' }}>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: C.greenDeep, width: `${Math.max(3, Math.round((amount / largest) * 100))}%` }} />
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={{ paddingVertical: 22 }}>
          <T size={14} color={C.muted} center>
            {t('noExpenses', { month: monthName })}
          </T>
        </View>
      )}
    </View>
  );
}

/** Under a line in a quote or invoice: how many are in stock, and a warning when the line asks for more. */
export function lineStockNote(doc: Doc, line: DocLine, items: Item[], levels: Map<string, number>, t: Translate): { text: string; warn: boolean } | null {
  const item = items.find((i) => i.id === line.itemId);
  if (!item || !item.trackStock) return null;
  // An issued invoice has already taken its own lines out of the count, so they are put back first.
  const taken = doc.type === 'invoice' && doc.status !== 'draft' ? doc.lines.filter((l) => l.itemId === item.id).reduce((sum, l) => sum + l.qty, 0) : 0;
  const available = (levels.get(item.id) ?? 0) + taken;
  const wanted = doc.lines.filter((l) => l.itemId === item.id).reduce((sum, l) => sum + l.qty, 0);
  if (wanted > available) return { text: available > 0 ? t('onlyInStock', { n: formatAmount(available) }) : t('outOfStock'), warn: true };
  return { text: t('inStock', { n: formatAmount(available) }), warn: false };
}

function historyText(event: StockEvent, t: Translate): string {
  if (event.kind === 'invoice') return t('stSold', { number: event.label });
  return t(event.kind === 'open' ? 'stOpen' : event.kind === 'add' ? 'stAdded' : 'stCorrected');
}

/**
 * The stock part of the item form. For a new item it asks how many there are now; for an item
 * already counted it shows the number, the buttons to change it, and what happened to it.
 */
export function StockFields({ item, track, setTrack, opening, setOpening, lowAt, setLowAt }: { item?: Item; track: boolean; setTrack: (on: boolean) => void; opening: number; setOpening: (n: number) => void; lowAt: number; setLowAt: (n: number) => void }) {
  const { t, lang } = useLocale();
  const { stockMoves, docs } = useAppState();
  const { levels } = useStock();
  const [sheet, setSheet] = useState<'add' | 'correct' | null>(null);
  const counted = !!item?.trackStock;
  const now = item ? levels.get(item.id) ?? 0 : 0;
  const history = useMemo(() => (item && counted ? stockHistory(item.id, stockMoves, docs).slice(0, 8) : []), [item, counted, stockMoves, docs]);
  const look = item && counted ? stockText(item, now, t) : null;

  return (
    <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 }}>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: track }} onPress={() => setTrack(!track)} testID="track-stock" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
        <View style={{ flex: 1, gap: 1 }}>
          <T size={15.5} w="semibold">
            {t('trackStock')}
          </T>
          <T size={13} color={C.muted}>
            {t('trackStockHint')}
          </T>
        </View>
        {/* The switch is drawn left to right in every language; mirrored, its thumb comes loose from its track. */}
        <View style={{ direction: 'ltr' }}>
          <Switch value={track} onValueChange={setTrack} trackColor={{ false: C.border, true: C.greenDeep }} thumbColor={C.surface} accessibilityLabel={t('trackStock')} />
        </View>
      </Pressable>

      {track ? (
        <>
          {item && counted ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <T size={13} w="semibold" color={C.muted}>
                  {t('stockNow')}
                </T>
                <T size={22} w="semibold" head latin color={look && look.state !== 'ok' ? look.color : C.ink} testID="stock-now">
                  {formatAmount(now)}
                </T>
                {look && look.state === 'low' ? (
                  <T size={13} w="semibold" color={C.orange}>
                    {t('lowStock')}
                  </T>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Button label={t('addStock')} icon="plus" variant="secondary" onPress={() => setSheet('add')} testID="add-stock" style={{ flexGrow: 1, flexBasis: 190 }} />
                <Button label={t('correctStock')} variant="secondary" onPress={() => setSheet('correct')} testID="correct-stock" style={{ flexGrow: 1, flexBasis: 190 }} />
              </View>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <T size={13} w="semibold" color={C.muted}>
                {t('stockNow')}
              </T>
              <NumberField label={t('stockNow')} value={opening} onChange={setOpening} width={140} height={52} blankZero testID="stock-opening" />
            </View>
          )}
          <View style={{ gap: 6 }}>
            <T size={13} w="semibold" color={C.muted}>
              {`${t('warnAt')} (${t('optional')})`}
            </T>
            <NumberField label={t('warnAt')} value={lowAt} onChange={setLowAt} width={140} height={52} blankZero testID="stock-low-at" />
          </View>
          {history.length ? (
            <View style={{ gap: 4 }}>
              <T size={13} w="semibold" color={C.muted}>
                {t('stockHistory')}
              </T>
              {history.map((event) => (
                <View key={event.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36, borderBottomWidth: 1, borderBottomColor: C.lineSoft }}>
                  <View style={{ width: 84 }}>
                    <T size={13} color={C.muted}>
                      {formatDay(event.date, lang)}
                    </T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T size={14} numberOfLines={1}>
                      {historyText(event, t)}
                    </T>
                  </View>
                  <T size={14} w="semibold" latin color={event.qty > 0 ? C.greenText : C.ink}>
                    {`${event.qty > 0 ? '+' : '−'} ${formatAmount(Math.abs(event.qty))}`}
                  </T>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      <StockSheet visible={!!sheet} mode={sheet ?? 'add'} item={item} onClose={() => setSheet(null)} />
    </View>
  );
}

/** Saves the item form, stock settings included. Returns false when the name is missing. */
export function saveItemForm(input: { id?: string; name: string; unit: string; price: number; cost: number; track: boolean; opening: number; lowAt: number }): boolean {
  if (!input.name.trim()) return false;
  const item = store.saveItem({ id: input.id, name: input.name, unit: input.unit, price: input.price, cost: input.cost, trackStock: input.track, lowStock: input.track ? input.lowAt : 0 });
  const firstCount = input.track && input.opening > 0 && !store.getState().stockMoves.some((m) => m.itemId === item.id);
  if (firstCount) store.addStock(item.id, input.opening);
  return true;
}

/** The stock line under an item in a quote or invoice. Shows nothing for items that are not counted. */
export function LineStock({ doc, line, levels }: { doc: Doc; line: DocLine; levels: Map<string, number> }) {
  const { t } = useLocale();
  const items = useAppState().items;
  const note = lineStockNote(doc, line, items, levels, t);
  if (!note) return null;
  return (
    <T size={12.5} w={note.warn ? 'semibold' : 'regular'} color={note.warn ? C.orange : C.muted} testID={`line-stock-${line.name}`}>
      {note.text}
    </T>
  );
}

/** Sale price and purchase price side by side, for the item form. */
export function PriceFields({ price, setPrice, cost, setCost, onSubmit }: { price: number; setPrice: (n: number) => void; cost: number; setCost: (n: number) => void; onSubmit?: () => void }) {
  const { t } = useLocale();
  const currency = useAppState().settings.currency;
  const margin = price > 0 && cost > 0 ? round2(price - cost) : null;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <T size={13} w="semibold" color={C.muted}>
            {`${t('salePrice')} (${currency.code})`}
          </T>
          <NumberField label={t('salePrice')} value={price} onChange={setPrice} width={140} height={52} align="end" blankZero onSubmit={onSubmit} testID="item-price" />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <T size={13} w="semibold" color={C.muted}>
            {`${t('purchasePrice')} (${currency.code})`}
          </T>
          <NumberField label={t('purchasePrice')} value={cost} onChange={setCost} width={140} height={52} align="end" blankZero onSubmit={onSubmit} testID="item-cost" />
        </View>
      </View>
      {margin === null ? (
        <T size={12.5} color={C.muted}>
          {t('purchasePriceHint')}
        </T>
      ) : (
        <View style={{ flexDirection: 'row', gap: 5 }} testID="item-margin">
          <T size={13} w="semibold" color={margin < 0 ? C.danger : C.greenText}>
            {`${t(margin < 0 ? 'loss' : 'profit')}:`}
          </T>
          <T size={13} w="semibold" latin color={margin < 0 ? C.danger : C.greenText}>
            {formatAmount(Math.abs(margin))}
          </T>
        </View>
      )}
    </View>
  );
}
