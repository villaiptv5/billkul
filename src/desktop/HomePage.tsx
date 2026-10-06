import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useAppState } from '../data/app';
import { sortDocs } from '../data/store';
import { formatDay, formatMonth, isoDate } from '../logic/dates';
import { formatAmount, money } from '../logic/money';
import { monthStats } from '../logic/stats';
import { docTotals } from '../logic/totals';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { useCashBook, useStock } from '../screens/books';
import { useMonthProfit } from '../screens/profit';
import { Icon } from '../ui/Icon';
import { Empty, StatusPill } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { PageHeader, Panel, TableHead, TableRow, type Col } from './parts';
import { useDesk } from './route';

const COLS: Col[] = [{ width: 110 }, { flex: 1 }, { width: 120 }, { width: 150, end: true }, { width: 120 }];

function Stat({ label, value, symbol, color = C.ink, onPress, testID }: { label: string; value: number; symbol: string; color?: string; onPress?: () => void; testID?: string }) {
  const { rtl } = useLocale();
  return (
    <Pressable accessibilityRole={onPress ? 'link' : undefined} disabled={!onPress} onPress={onPress} testID={testID} style={{ flexGrow: 1, flexBasis: 200 }}>
    <Panel style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 6 }}>
      <T size={13.5} color={C.muted}>
        {label}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, direction: 'ltr', justifyContent: rtl ? 'flex-end' : 'flex-start' }}>
        <T size={14} w="medium" latin color={C.muted}>
          {symbol}
        </T>
        <T size={26} w="semibold" head latin color={color} numberOfLines={1}>
          {formatAmount(value)}
        </T>
      </View>
    </Panel>
    </Pressable>
  );
}

export function HomePage({ onNew }: { onNew: (type: 'quote' | 'invoice') => void }) {
  const { t, lang } = useLocale();
  const { go } = useDesk();
  const { settings, docs } = useAppState();
  const today = isoDate();
  const stats = useMemo(() => monthStats(docs, today), [docs, today]);
  const recent = useMemo(() => sortDocs(docs).slice(0, 8), [docs]);
  const book = useCashBook();
  const { low } = useStock();
  const profit = useMonthProfit();

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title={t('tabHome')} subtitle={`${t('thisMonth')} · ${formatMonth(today, lang)}`} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Stat label={t('quoted')} value={stats.quoted} symbol={settings.currency.symbol} />
        <Stat label={t('invoiced')} value={stats.invoiced} symbol={settings.currency.symbol} />
        <Stat label={t('received')} value={stats.received} symbol={settings.currency.symbol} color={C.greenText} />
        <Stat label={t('due')} value={stats.due} symbol={settings.currency.symbol} color={C.orange} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Stat label={t('cashInHand')} value={book.inHand} symbol={settings.currency.symbol} color={book.inHand < 0 ? C.orange : C.ink} onPress={() => go({ page: 'cash' })} testID="home-cash" />
        <Stat label={`${t(profit.gross < 0 ? 'lossOnSales' : 'profitOnSales')} · ${t('thisMonth')}`} value={Math.abs(profit.gross)} symbol={settings.currency.symbol} color={profit.gross < 0 ? C.danger : C.greenText} onPress={() => go({ page: 'profit' })} testID="home-profit" />
        {low.length ? (
          <Pressable accessibilityRole="link" onPress={() => go({ page: 'items' })} testID="home-low-stock" style={{ flexGrow: 2, flexBasis: 416 }}>
            <View style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: '#F3C9A4', backgroundColor: '#FFF4E8', paddingHorizontal: 20, paddingVertical: 16, gap: 6, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name="alert" size={20} color={C.orange} />
                <T size={15.5} w="semibold" color={C.orange}>
                  {low.length === 1 ? t('lowStockOne') : t('lowStockMany', { n: low.length })}
                </T>
              </View>
              <T size={13.5} color={C.orange} numberOfLines={1}>
                {low.slice(0, 4).map((i) => i.name).join(', ')}
              </T>
            </View>
          </Pressable>
        ) : (
          <View style={{ flexGrow: 2, flexBasis: 416 }} />
        )}
      </View>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <T size={17} w="semibold" head accessibilityRole="header">
              {t('recentDocuments')}
            </T>
          </View>
          {recent.length ? <Button label={t('seeAll')} variant="ghost" size="sm" onPress={() => go({ page: 'documents', type: 'quote' })} testID="see-all" /> : null}
        </View>
        <Panel>
          {recent.length ? (
            <>
              <TableHead cols={COLS} labels={[t('colNumber'), t('customer'), t('date'), t('colAmount'), t('colStatus')]} />
              {recent.map((doc, i) => (
                <TableRow
                  key={doc.id}
                  cols={COLS}
                  last={i === recent.length - 1}
                  onPress={() => go({ page: 'editor', docId: doc.id })}
                  testID={`doc-${doc.number}`}
                  cells={[
                    <T size={14.5} w="semibold" latin>{doc.number}</T>,
                    <T size={14.5} numberOfLines={1}>{doc.customerName || t('noCustomer')}</T>,
                    <T size={14} color={C.muted}>{formatDay(doc.date, lang)}</T>,
                    <T size={14.5} w="semibold" latin>{money(docTotals(doc).total, settings.currency)}</T>,
                    <StatusPill status={doc.status} />,
                  ]}
                />
              ))}
            </>
          ) : (
            <Empty title={t('noDocsTitle')} hint={t('noDocsHint')} action={<Button label={t('newQuote')} icon="plus" head onPress={() => onNew('quote')} testID="first-quote" />} />
          )}
        </Panel>
      </View>
    </View>
  );
}
