import React from 'react';
import { View } from 'react-native';
import { useAppState } from '../data/app';
import { formatMonth } from '../logic/dates';
import { formatAmount, money } from '../logic/money';
import { Stepper } from '../screens/books';
import { MissingCostNote, profitColor, ProfitStatement, useProfit } from '../screens/profit';
import { C } from '../theme';
import { Empty } from '../ui/kit';
import { useDeskSize } from '../ui/layout';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { PageHeader, Panel, TableHead, TableRow, type Col } from './parts';

const COLS: Col[] = [{ flex: 1 }, { width: 56, end: true }, { width: 96, end: true }, { width: 96, end: true }, { width: 96, end: true }];

/** Rows are shown in whole rupees: a shared discount would otherwise leave paisas on every line. */
const whole = (n: number) => formatAmount(Math.round(n));

export function ProfitPage() {
  const { t, lang } = useLocale();
  const currency = useAppState().settings.currency;
  const { snug } = useDeskSize();
  const { report, shelf, month, thisMonth, previous, next } = useProfit();
  const monthName = formatMonth(`${month}-01`, lang);

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title={t('profitAndLoss')}>
        <View style={{ width: 240 }}>
          <Stepper label={monthName} onPrev={previous} onNext={next} canNext={month < thisMonth} prevLabel={t('previousMonth')} nextLabel={t('nextMonth')} testID="profit-month" />
        </View>
      </PageHeader>

      <View style={snug ? { gap: 20 } : { flexDirection: 'row', alignItems: 'flex-start', gap: 24 }}>
        <View style={[{ gap: 16, minWidth: 0 }, snug ? null : { flex: 1 }]}>
          <Panel style={{ padding: 20 }}>
            <ProfitStatement report={report} />
          </Panel>
          <MissingCostNote names={report.missingCost} />
          {shelf > 0 ? (
            <Panel style={{ paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <T size={14} color={C.muted}>
                  {t('stockValue')}
                </T>
              </View>
              <T size={17} w="semibold" head latin testID="pl-shelf">
                {money(shelf, currency)}
              </T>
            </Panel>
          ) : null}
        </View>

        <View style={[{ gap: 10, minWidth: 0 }, snug ? null : { flex: 1.8 }]}>
          <T size={17} w="semibold" head accessibilityRole="header">
            {t('byItem')}
          </T>
          <Panel>
            {report.byItem.length ? (
              <>
                <TableHead cols={COLS} labels={[t('colItem'), t('colSold'), t('sales'), t('colCost'), t('profit')]} />
                {report.byItem.map((row, i) => (
                  <TableRow
                    key={row.key}
                    cols={COLS}
                    last={i === report.byItem.length - 1}
                    testID={`pl-item-${row.name}`}
                    cells={[
                      <T size={14.5} w="semibold" numberOfLines={2}>{row.name}</T>,
                      <T size={14.5} latin color={C.muted}>{formatAmount(row.qty)}</T>,
                      <T size={14.5} latin>{whole(row.sales)}</T>,
                      <T size={14.5} latin color={C.muted}>{whole(row.cost)}</T>,
                      <T size={14.5} w="semibold" latin color={profitColor(row.profit)}>{`${row.profit < 0 ? '− ' : ''}${whole(Math.abs(row.profit))}`}</T>,
                    ]}
                  />
                ))}
              </>
            ) : (
              <Empty title={t('noSalesIn', { month: monthName })} />
            )}
          </Panel>
        </View>
      </View>
    </View>
  );
}
