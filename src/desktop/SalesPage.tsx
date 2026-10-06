import React from 'react';
import { View } from 'react-native';
import { useAppState } from '../data/app';
import { formatDay } from '../logic/dates';
import { formatAmount } from '../logic/money';
import type { SalesRow } from '../logic/sales';
import { Stepper } from '../screens/books';
import { MissingCostNote, profitColor, profitText, useSales, wholeAmount } from '../screens/sales';
import { C } from '../theme';
import { Empty, Segmented } from '../ui/kit';
import { useDeskSize } from '../ui/layout';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { PageHeader, Panel, TableHead, TableRow, type Col } from './parts';
import { useDesk } from './route';

const ITEM_COLS: Col[] = [{ flex: 1 }, { width: 60, end: true }, { width: 100, end: true }, { width: 100, end: true }];
const DAY_COLS: Col[] = [{ flex: 1 }, { width: 70, end: true }, { width: 60, end: true }, { width: 100, end: true }, { width: 100, end: true }];
const INVOICE_COLS: Col[] = [{ flex: 1 }, { width: 60, end: true }, { width: 100, end: true }, { width: 100, end: true }];

function Stat({ label, value, symbol, color = C.ink, testID }: { label: string; value: string; symbol?: string; color?: string; testID: string }) {
  const { rtl } = useLocale();
  return (
    <Panel style={{ flexGrow: 1, flexBasis: 180, paddingHorizontal: 20, paddingVertical: 16, gap: 6 }}>
      <T size={13.5} color={C.muted}>
        {label}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, direction: 'ltr', justifyContent: rtl ? 'flex-end' : 'flex-start' }}>
        {symbol ? (
          <T size={14} w="medium" latin color={C.muted}>
            {symbol}
          </T>
        ) : null}
        <T size={26} w="semibold" head latin color={color} numberOfLines={1} testID={testID}>
          {value}
        </T>
      </View>
    </Panel>
  );
}

function figures(row: SalesRow) {
  return [
    <T size={14.5} latin color={C.muted}>{formatAmount(row.qty)}</T>,
    <T size={14.5} latin>{wholeAmount(row.sales)}</T>,
    <T size={14.5} w="semibold" latin color={profitColor(row.profit)}>{profitText(row.profit, false)}</T>,
  ];
}

export function SalesPage() {
  const { t, lang } = useLocale();
  const { go } = useDesk();
  const symbol = useAppState().settings.currency.symbol;
  const { snug } = useDeskSize();
  const sales = useSales();
  const { report, mode } = sales;
  const numbers = [t('colSold'), t('sales'), t('profit')];

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title={t('salesReport')}>
        <View style={{ width: 190 }}>
          <Segmented
            value={mode}
            onChange={sales.setMode}
            options={[
              { value: 'day', label: t('day'), testID: 'sales-day' },
              { value: 'month', label: t('month'), testID: 'sales-month' },
            ]}
          />
        </View>
        <View style={{ width: 230 }}>
          <Stepper label={sales.label} onPrev={sales.previous} onNext={sales.next} canNext={sales.canNext} prevLabel={t(mode === 'day' ? 'previousDay' : 'previousMonth')} nextLabel={t(mode === 'day' ? 'nextDay' : 'nextMonth')} testID="sales-period" />
        </View>
      </PageHeader>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Stat label={t('invoices')} value={formatAmount(report.invoices)} testID="sales-invoices" />
        <Stat label={t('itemsSold')} value={formatAmount(report.qty)} testID="sales-qty" />
        <Stat label={t('sales')} value={wholeAmount(report.sales)} symbol={symbol} testID="sales-total" />
        <Stat label={t(report.profit < 0 ? 'loss' : 'profit')} value={profitText(report.profit, false)} symbol={symbol} color={profitColor(report.profit)} testID="sales-profit" />
      </View>

      <MissingCostNote names={report.missingCost} />

      {report.invoices === 0 ? (
        <Panel>
          <Empty title={sales.empty} />
        </Panel>
      ) : (
        <View style={snug ? { gap: 20 } : { flexDirection: 'row', alignItems: 'flex-start', gap: 24 }}>
          <View style={[{ gap: 10, minWidth: 0 }, snug ? null : { flex: 1 }]}>
            <T size={17} w="semibold" head accessibilityRole="header">
              {t(mode === 'month' ? 'dayByDay' : 'invoices')}
            </T>
            <Panel>
              {mode === 'month' ? (
                <>
                  <TableHead cols={DAY_COLS} labels={[t('date'), t('invoices'), ...numbers]} />
                  {report.byDay.map((row, i) => (
                    <TableRow
                      key={row.key}
                      cols={DAY_COLS}
                      last={i === report.byDay.length - 1}
                      onPress={() => sales.openDay(row.label)}
                      testID={`sales-on-${row.label}`}
                      cells={[<T size={14.5} w="semibold">{formatDay(row.label, lang)}</T>, <T size={14.5} latin color={C.muted}>{formatAmount(row.invoices)}</T>, ...figures(row)]}
                    />
                  ))}
                </>
              ) : (
                <>
                  <TableHead cols={INVOICE_COLS} labels={[t('invoice'), ...numbers]} />
                  {report.byInvoice.map((row, i) => (
                    <TableRow
                      key={row.key}
                      cols={INVOICE_COLS}
                      last={i === report.byInvoice.length - 1}
                      onPress={() => go({ page: 'editor', docId: row.key })}
                      testID={`sales-invoice-${row.label}`}
                      cells={[
                        <View style={{ alignSelf: 'stretch' }}>
                          <T size={14.5} w="semibold" latin>{row.label}</T>
                          <T size={13} color={C.muted} numberOfLines={1}>{row.detail || t('noCustomer')}</T>
                        </View>,
                        ...figures(row),
                      ]}
                    />
                  ))}
                </>
              )}
            </Panel>
          </View>

          <View style={[{ gap: 10, minWidth: 0 }, snug ? null : { flex: 1 }]}>
            <T size={17} w="semibold" head accessibilityRole="header">
              {t('byItem')}
            </T>
            <Panel>
              <TableHead cols={ITEM_COLS} labels={[t('colItem'), ...numbers]} />
              {report.byItem.map((row, i) => (
                <TableRow key={row.key} cols={ITEM_COLS} last={i === report.byItem.length - 1} testID={`sales-item-${row.label}`} cells={[<T size={14.5} w="semibold" numberOfLines={2}>{row.label}</T>, ...figures(row)]} />
              ))}
            </Panel>
          </View>
        </View>
      )}
    </View>
  );
}
