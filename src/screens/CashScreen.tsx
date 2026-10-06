import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppState } from '../data/app';
import type { CashEntry, CashKind } from '../data/types';
import { formatDay } from '../logic/dates';
import type { CashRow } from '../logic/ledger';
import { formatAmount } from '../logic/money';
import type { RootNav } from '../nav';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Card, Empty, Screen, Segmented, TopBar } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { CashEntrySheet, cashDetail, cashTitle, ExpensesPanel, useCashBook } from './books';
import { ProfitPanel } from './profit';

const PAGE = 60;

/** A cash book line: what it was, who or what for, and the amount coming in or going out. */
export function CashLine({ row, onPress, last }: { row: CashRow; onPress: () => void; last?: boolean }) {
  const { t } = useLocale();
  const coming = row.kind === 'in';
  const detail = cashDetail(row);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={`cash-row-${row.key}`}
      style={({ pressed }) => ({ minHeight: 60, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.lineSoft, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: coming ? C.tintGreen : C.bgDeep, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={coming ? 'moneyIn' : 'moneyOut'} size={18} color={coming ? C.greenDark : C.muted} stroke={2.2} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <T size={15} w="semibold" numberOfLines={1}>
          {cashTitle(row, t)}
        </T>
        {detail ? (
          <T size={13} color={C.muted} numberOfLines={1}>
            {detail}
          </T>
        ) : null}
      </View>
      <T size={15} w="semibold" latin color={coming ? C.greenText : C.ink}>
        {`${coming ? '+' : '−'} ${formatAmount(row.amount)}`}
      </T>
    </Pressable>
  );
}

/** Groups rows that share a date, keeping their order. */
export function byDay(rows: CashRow[]): { date: string; rows: CashRow[] }[] {
  const days: { date: string; rows: CashRow[] }[] = [];
  for (const row of rows) {
    const last = days[days.length - 1];
    if (last && last.date === row.date) last.rows.push(row);
    else days.push({ date: row.date, rows: [row] });
  }
  return days;
}

export function CashScreen() {
  const nav = useNavigation<RootNav>();
  const { t, lang, rtl } = useLocale();
  const { settings, cash } = useAppState();
  const book = useCashBook();
  const [view, setView] = useState<'entries' | 'expenses' | 'profit'>('entries');
  const [sheet, setSheet] = useState<{ kind: CashKind; entry?: CashEntry } | null>(null);
  const [shown, setShown] = useState(PAGE);
  const days = useMemo(() => byDay(book.rows.slice(0, shown)), [book.rows, shown]);

  const open = (row: CashRow) => {
    if (row.source === 'invoice') return nav.navigate('Preview', { docId: row.refId });
    if (row.source === 'stock') return nav.navigate('ItemEdit', { id: row.refId });
    const entry = cash.find((e) => e.id === row.refId);
    if (entry) setSheet({ kind: entry.kind, entry });
  };

  return (
    <Screen bottom={false}>
      <TopBar title={t('cashBook')} big />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14 }}>
        <View style={{ backgroundColor: C.ink, borderRadius: 18, padding: 16, gap: 14 }}>
          <View style={{ gap: 2 }}>
            <T size={13.5} color={C.onInkMuted}>
              {t('cashInHand')}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, direction: 'ltr', justifyContent: rtl ? 'flex-end' : 'flex-start' }}>
              <T size={15} w="medium" latin color={C.onInkMuted}>
                {settings.currency.symbol}
              </T>
              <T size={30} w="bold" head latin color={book.inHand < 0 ? C.orangeOnInk : C.onInk} numberOfLines={1} testID="cash-in-hand">
                {formatAmount(book.inHand)}
              </T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: C.inkPanel, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 2 }}>
              <T size={12.5} color={C.onInkMuted}>
                {t('inThisMonth')}
              </T>
              <T size={16} w="semibold" head latin color={C.green} end={rtl} testID="cash-month-in">
                {formatAmount(book.month.in)}
              </T>
            </View>
            <View style={{ flex: 1, backgroundColor: C.inkPanel, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 2 }}>
              <T size={12.5} color={C.onInkMuted}>
                {t('outThisMonth')}
              </T>
              <T size={16} w="semibold" head latin color={C.orangeOnInk} end={rtl} testID="cash-month-out">
                {formatAmount(book.month.out)}
              </T>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label={t('moneyIn')} icon="moneyIn" head onPress={() => setSheet({ kind: 'in' })} testID="money-in" style={{ flex: 1, minHeight: 54, borderRadius: 14 }} />
          <Button label={t('moneyOut')} icon="moneyOut" variant="secondary" head onPress={() => setSheet({ kind: 'out' })} testID="money-out" style={{ flex: 1, minHeight: 54, borderRadius: 14 }} />
        </View>

        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'entries', label: t('entries'), testID: 'cash-entries' },
            { value: 'expenses', label: t('expenses'), testID: 'cash-expenses' },
            { value: 'profit', label: t('profit'), testID: 'cash-profit' },
          ]}
        />

        {view === 'profit' ? (
          <ProfitPanel />
        ) : view === 'expenses' ? (
          <Card style={{ padding: 14 }}>
            <ExpensesPanel rows={book.rows} />
          </Card>
        ) : book.rows.length === 0 ? (
          <Card>
            <Empty title={t('noCashTitle')} hint={t('noCashHint')} />
          </Card>
        ) : (
          <>
            {days.map((day) => (
              <View key={day.date} style={{ gap: 6 }}>
                <T size={13} w="semibold" color={C.muted} style={{ paddingHorizontal: 4 }}>
                  {formatDay(day.date, lang)}
                </T>
                <Card>
                  {day.rows.map((row, i) => (
                    <CashLine key={row.key} row={row} last={i === day.rows.length - 1} onPress={() => open(row)} />
                  ))}
                </Card>
              </View>
            ))}
            {book.rows.length > shown ? <Button label={t('showMore')} variant="ghost" onPress={() => setShown(shown + PAGE)} testID="cash-more" /> : null}
          </>
        )}
      </ScrollView>

      <CashEntrySheet visible={!!sheet} kind={sheet?.kind ?? 'in'} entry={sheet?.entry} onClose={() => setSheet(null)} />
    </Screen>
  );
}
