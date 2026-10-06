import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppState } from '../data/app';
import { addDays, formatDate, formatDay, formatMonth, isoDate, monthKey } from '../logic/dates';
import { shiftMonth } from '../logic/ledger';
import { formatAmount } from '../logic/money';
import { salesReport, type SalesReport, type SalesRow } from '../logic/sales';
import type { RootNav } from '../nav';
import { C } from '../theme';
import { Icon } from '../ui/Icon';
import { Card, Screen, Segmented, TopBar } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { Stepper } from './books';

export type SalesMode = 'day' | 'month';

/** The sales report for a day or a month the reader can step through. */
export function useSales() {
  const { docs, items } = useAppState();
  const { t, lang } = useLocale();
  const today = isoDate();
  const [mode, setMode] = useState<SalesMode>('month');
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(monthKey(today));
  const period = mode === 'day' ? day : month;
  const report = useMemo(() => salesReport(docs, items, period), [docs, items, period]);
  const monthName = formatMonth(`${month}-01`, lang);

  return {
    mode,
    setMode,
    report,
    /** "Today", "5 Oct" or "October 2026", for the stepper. */
    label: mode === 'day' ? formatDay(day, lang) : monthName,
    empty: mode === 'day' ? t('noSalesOn', { day: formatDate(day, lang) }) : t('noSalesIn', { month: monthName }),
    canNext: mode === 'day' ? day < today : month < monthKey(today),
    previous: () => (mode === 'day' ? setDay(addDays(day, -1)) : setMonth(shiftMonth(month, -1))),
    next: () => (mode === 'day' ? setDay(addDays(day, 1)) : setMonth(shiftMonth(month, 1))),
    /** Opens one day of the month being shown. */
    openDay: (date: string) => {
      setDay(date);
      setMode('day');
    },
  };
}

/** This month's sales, for the Home screen. */
export function useMonthSales(): SalesReport {
  const { docs, items } = useAppState();
  return useMemo(() => salesReport(docs, items, monthKey(isoDate())), [docs, items]);
}

/** Green for a profit, red for a loss. */
export function profitColor(amount: number): string {
  return amount < 0 ? C.danger : C.greenText;
}

/** "+ 1,500" or "− 500", in whole rupees: a shared discount would otherwise leave paisas on every row. */
export function profitText(amount: number, sign = true): string {
  const figure = formatAmount(Math.round(Math.abs(amount)));
  return amount < 0 ? `− ${figure}` : sign ? `+ ${figure}` : figure;
}

export function wholeAmount(amount: number): string {
  return formatAmount(Math.round(amount));
}

/** A warning when goods sold without a purchase price, since their profit is overstated. */
export function MissingCostNote({ names }: { names: string[] }) {
  const { t } = useLocale();
  if (!names.length) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: '#F3C9A4', backgroundColor: '#FFF4E8', padding: 12 }} testID="sales-missing">
      <Icon name="alert" size={18} color={C.orange} />
      <View style={{ flex: 1 }}>
        <T size={13.5} color={C.orange}>
          {t('missingCost', { names: names.slice(0, 6).join(', ') })}
        </T>
      </View>
    </View>
  );
}

function Tile({ label, value, color = C.ink, testID }: { label: string; value: string; color?: string; testID: string }) {
  const { rtl } = useLocale();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, gap: 2 }}>
      <T size={12.5} color={C.muted} numberOfLines={1}>
        {label}
      </T>
      <T size={17} w="semibold" head latin color={color} numberOfLines={1} end={rtl} testID={testID}>
        {value}
      </T>
    </View>
  );
}

function Rows({ title, rows, name, onPress, testPrefix }: { title: string; rows: SalesRow[]; name: (row: SalesRow) => string; onPress?: (row: SalesRow) => void; testPrefix: string }) {
  const { t } = useLocale();
  if (!rows.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <T size={13} w="semibold" color={C.muted} style={{ paddingHorizontal: 4 }}>
        {title}
      </T>
      <Card>
        {rows.map((row, i) => (
          <Pressable
            key={row.key}
            accessibilityRole={onPress ? 'button' : undefined}
            disabled={!onPress}
            onPress={() => onPress?.(row)}
            testID={`${testPrefix}-${row.label}`}
            style={({ pressed }) => ({ minHeight: 58, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: C.lineSoft, opacity: pressed ? 0.6 : 1 })}
          >
            <View style={{ flex: 1, gap: 1 }}>
              <T size={15} w="semibold" numberOfLines={1}>
                {name(row)}
              </T>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                <T size={13} color={C.muted}>
                  {`${t('soldCount', { n: formatAmount(row.qty) })} ·`}
                </T>
                <T size={13} color={C.muted} latin>
                  {wholeAmount(row.sales)}
                </T>
              </View>
            </View>
            <T size={15} w="semibold" latin color={profitColor(row.profit)}>
              {profitText(row.profit)}
            </T>
            {onPress ? <Icon name="chevron" size={18} color={C.muted} stroke={2} /> : null}
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

/** The sales report for the phone: day or month, the three totals, then the breakdowns. */
export function SalesPanel({ onOpenInvoice }: { onOpenInvoice: (docId: string) => void }) {
  const { t, lang } = useLocale();
  const sales = useSales();
  const { report, mode } = sales;

  return (
    <View style={{ gap: 14 }}>
      <Segmented
        value={mode}
        onChange={sales.setMode}
        options={[
          { value: 'day', label: t('day'), testID: 'sales-day' },
          { value: 'month', label: t('month'), testID: 'sales-month' },
        ]}
      />
      <Card style={{ padding: 12, gap: 10 }}>
        <Stepper label={sales.label} onPrev={sales.previous} onNext={sales.next} canNext={sales.canNext} prevLabel={t(mode === 'day' ? 'previousDay' : 'previousMonth')} nextLabel={t(mode === 'day' ? 'nextDay' : 'nextMonth')} testID="sales-period" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Tile label={t('itemsSold')} value={formatAmount(report.qty)} testID="sales-qty" />
          <Tile label={t('sales')} value={wholeAmount(report.sales)} testID="sales-total" />
          <Tile label={t(report.profit < 0 ? 'loss' : 'profit')} value={profitText(report.profit, false)} color={profitColor(report.profit)} testID="sales-profit" />
        </View>
        {report.invoices === 0 ? (
          <T size={14} color={C.muted} center style={{ paddingVertical: 10 }}>
            {sales.empty}
          </T>
        ) : null}
      </Card>

      <MissingCostNote names={report.missingCost} />

      {mode === 'month' ? (
        <Rows title={t('dayByDay')} rows={report.byDay} name={(row) => formatDay(row.label, lang)} onPress={(row) => sales.openDay(row.label)} testPrefix="sales-on" />
      ) : (
        <Rows title={t('invoices')} rows={report.byInvoice} name={(row) => (row.detail ? `${row.label} · ${row.detail}` : row.label)} onPress={(row) => onOpenInvoice(row.key)} testPrefix="sales-invoice" />
      )}
      <Rows title={t('byItem')} rows={report.byItem} name={(row) => row.label} testPrefix="sales-item" />
    </View>
  );
}

/** The report as its own screen, opened from Home. */
export function SalesScreen() {
  const nav = useNavigation<RootNav>();
  const { t } = useLocale();
  return (
    <Screen>
      <TopBar title={t('salesReport')} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <SalesPanel onOpenInvoice={(docId) => nav.navigate('Preview', { docId })} />
      </ScrollView>
    </Screen>
  );
}
