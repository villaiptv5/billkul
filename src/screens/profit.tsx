import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppState } from '../data/app';
import { formatMonth, isoDate, monthKey } from '../logic/dates';
import { shiftMonth } from '../logic/ledger';
import { formatAmount, money } from '../logic/money';
import { profitReport, stockValue, type ProfitReport } from '../logic/profit';
import type { RootNav } from '../nav';
import { C } from '../theme';
import { Icon } from '../ui/Icon';
import { Card, Screen, TopBar } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { Stepper, useCashBook, useStock } from './books';

/** Profit and loss for a month the reader can step through, with what the stock on the shelf is worth. */
export function useProfit() {
  const { docs, items } = useAppState();
  const { rows } = useCashBook();
  const { levels } = useStock();
  const thisMonth = monthKey(isoDate());
  const [month, setMonth] = useState(thisMonth);
  const report = useMemo(() => profitReport(docs, items, rows, month), [docs, items, rows, month]);
  const shelf = useMemo(() => stockValue(items, levels), [items, levels]);
  return { report, shelf, month, thisMonth, previous: () => setMonth(shiftMonth(month, -1)), next: () => setMonth(shiftMonth(month, 1)) };
}

/** This month's profit on sales, for the Home screen. */
export function useMonthProfit(): ProfitReport {
  const { docs, items } = useAppState();
  const { rows } = useCashBook();
  return useMemo(() => profitReport(docs, items, rows, monthKey(isoDate())), [docs, items, rows]);
}

/** Green for a profit, red for a loss. */
export function profitColor(amount: number): string {
  return amount < 0 ? C.danger : C.greenText;
}

function Line({ label, amount, minus, strong, color, testID }: { label: string; amount: number; minus?: boolean; strong?: boolean; color?: string; testID?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, minHeight: strong ? 40 : 32 }}>
      <View style={{ flex: 1 }}>
        <T size={strong ? 15.5 : 14.5} w={strong ? 'semibold' : 'regular'} color={strong ? C.ink : C.muted}>
          {label}
        </T>
      </View>
      <T size={strong ? 19 : 14.5} w="semibold" head={strong} latin color={color ?? C.ink} testID={testID}>
        {`${minus && amount > 0 ? '− ' : ''}${formatAmount(Math.abs(amount))}`}
      </T>
    </View>
  );
}

/** Sales, cost, profit on sales, expenses and the net result, as a short statement. */
export function ProfitStatement({ report }: { report: ProfitReport }) {
  const { t } = useLocale();
  return (
    <View>
      <Line label={t('sales')} amount={report.sales} testID="pl-sales" />
      <Line label={t('costOfSold')} amount={report.cost} minus testID="pl-cost" />
      <View style={{ height: 1, backgroundColor: C.line, marginVertical: 4 }} />
      <Line label={t(report.gross < 0 ? 'lossOnSales' : 'profitOnSales')} amount={report.gross} strong color={profitColor(report.gross)} testID="pl-gross" />
      <Line label={t('shopExpenses')} amount={report.expenses} minus testID="pl-expenses" />
      <View style={{ height: 2, backgroundColor: C.ink, marginVertical: 4 }} />
      <Line label={t(report.net < 0 ? 'netLoss' : 'netProfit')} amount={report.net} strong color={profitColor(report.net)} testID="pl-net" />
      <T size={12.5} color={C.muted} style={{ marginTop: 4 }}>
        {t('expensesNote')}
      </T>
    </View>
  );
}

/** A warning when goods sold without a purchase price, since their profit is overstated. */
export function MissingCostNote({ names }: { names: string[] }) {
  const { t } = useLocale();
  if (!names.length) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: '#F3C9A4', backgroundColor: '#FFF4E8', padding: 12 }} testID="pl-missing">
      <Icon name="alert" size={18} color={C.orange} />
      <View style={{ flex: 1 }}>
        <T size={13.5} color={C.orange}>
          {t('missingCost', { names: names.slice(0, 6).join(', ') })}
        </T>
      </View>
    </View>
  );
}

/** The whole report for the phone: month, statement, each item's profit, and the stock value. */
export function ProfitPanel() {
  const { t, lang } = useLocale();
  const currency = useAppState().settings.currency;
  const { report, shelf, month, thisMonth, previous, next } = useProfit();
  const monthName = formatMonth(`${month}-01`, lang);

  return (
    <View style={{ gap: 14 }}>
      <Card style={{ padding: 14, gap: 8 }}>
        <Stepper label={monthName} onPrev={previous} onNext={next} canNext={month < thisMonth} prevLabel={t('previousMonth')} nextLabel={t('nextMonth')} testID="profit-month" />
        <ProfitStatement report={report} />
      </Card>

      <MissingCostNote names={report.missingCost} />

      <View style={{ gap: 6 }}>
        <T size={13} w="semibold" color={C.muted} style={{ paddingHorizontal: 4 }}>
          {t('byItem')}
        </T>
        <Card>
          {report.byItem.length ? (
            report.byItem.map((row, i) => (
              <View key={row.key} testID={`pl-item-${row.name}`} style={{ minHeight: 58, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: i === report.byItem.length - 1 ? 0 : 1, borderBottomColor: C.lineSoft }}>
                <View style={{ flex: 1, gap: 1 }}>
                  <T size={15} w="semibold" numberOfLines={1}>
                    {row.name}
                  </T>
                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    <T size={13} color={C.muted}>
                      {`${t('soldCount', { n: formatAmount(row.qty) })} ·`}
                    </T>
                    <T size={13} color={C.muted} latin>
                      {formatAmount(Math.round(row.sales))}
                    </T>
                  </View>
                </View>
                <T size={15} w="semibold" latin color={profitColor(row.profit)}>
                  {`${row.profit < 0 ? '− ' : '+ '}${formatAmount(Math.round(Math.abs(row.profit)))}`}
                </T>
              </View>
            ))
          ) : (
            <View style={{ padding: 22 }}>
              <T size={14} color={C.muted} center>
                {t('noSalesIn', { month: monthName })}
              </T>
            </View>
          )}
        </Card>
      </View>

      {shelf > 0 ? (
        <Card style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T size={14} color={C.muted}>
              {t('stockValue')}
            </T>
          </View>
          <T size={16} w="semibold" head latin testID="pl-shelf">
            {money(shelf, currency)}
          </T>
        </Card>
      ) : null}
    </View>
  );
}

/** The report as its own screen, opened from Home. */
export function ProfitScreen() {
  const nav = useNavigation<RootNav>();
  const { t } = useLocale();
  return (
    <Screen>
      <TopBar title={t('profitAndLoss')} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <ProfitPanel />
      </ScrollView>
    </Screen>
  );
}
