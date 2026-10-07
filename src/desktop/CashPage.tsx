import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAppState } from '../data/app';
import type { CashEntry, CashKind } from '../data/types';
import { formatDay } from '../logic/dates';
import type { CashRow } from '../logic/ledger';
import { formatAmount } from '../logic/money';
import { CashEntrySheet, cashDetail, cashTitle, ExpensesPanel, useCashBook } from '../screens/books';
import { useDue } from '../screens/customer';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Empty } from '../ui/kit';
import { useDeskSize } from '../ui/layout';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { ItemDialog, PageHeader, Panel, TableHead, TableRow, type Col } from './parts';
import { useDesk } from './route';
import { useLimits } from '../screens/limits';

const COLS: Col[] = [{ width: 100 }, { flex: 1 }, { width: 120, end: true }, { width: 120, end: true }];
const PAGE = 100;

function Stat({ label, value, symbol, color = C.ink, testID }: { label: string; value: number; symbol: string; color?: string; testID?: string }) {
  const { rtl } = useLocale();
  return (
    <Panel style={{ flexGrow: 1, flexBasis: 200, paddingHorizontal: 20, paddingVertical: 16, gap: 6 }}>
      <T size={13.5} color={C.muted}>
        {label}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, direction: 'ltr', justifyContent: rtl ? 'flex-end' : 'flex-start' }}>
        <T size={14} w="medium" latin color={C.muted}>
          {symbol}
        </T>
        <T size={26} w="semibold" head latin color={color} numberOfLines={1} testID={testID}>
          {formatAmount(value)}
        </T>
      </View>
    </Panel>
  );
}

export function CashPage() {
  const limits = useLimits();
  const { t, lang } = useLocale();
  const { go } = useDesk();
  const { settings, cash, items } = useAppState();
  const { snug } = useDeskSize();
  const book = useCashBook();
  const due = useDue();
  const [sheet, setSheet] = useState<{ kind: CashKind; entry?: CashEntry } | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const rows = book.rows.slice(0, shown);
  const symbol = settings.currency.symbol;

  const open = (row: CashRow) => {
    if (row.source === 'invoice') return go({ page: 'editor', docId: row.refId });
    if (row.source === 'stock') return setItemId(row.refId);
    const entry = cash.find((e) => e.id === row.refId);
    if (entry) setSheet({ kind: entry.kind, entry });
  };

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title={t('cashBook')}>
        <Button label={t('printReport')} icon="printer" variant="secondary" onPress={() => go({ page: 'cashReport' })} testID="cash-print" />
        <Button label={t('moneyOut')} icon="moneyOut" variant="secondary" onPress={() => limits.allowCash() && setSheet({ kind: 'out' })} testID="money-out" />
        <Button label={t('moneyIn')} icon="moneyIn" head onPress={() => limits.allowCash() && setSheet({ kind: 'in' })} testID="money-in" />
      </PageHeader>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Stat label={t('cashInHand')} value={book.inHand} symbol={symbol} color={book.inHand < 0 ? C.orange : C.ink} testID="cash-in-hand" />
        <Stat label={t('inThisMonth')} value={book.month.in} symbol={symbol} color={C.greenText} testID="cash-month-in" />
        <Stat label={t('outThisMonth')} value={book.month.out} symbol={symbol} color={C.orange} testID="cash-month-out" />
        <Pressable accessibilityRole="link" onPress={() => go({ page: 'due' })} testID="cash-due" style={{ flexGrow: 1, flexBasis: 200, flexDirection: 'row' }}>
          <Stat label={t('dueFromCustomers')} value={due.total} symbol={symbol} color={due.total > 0 ? C.danger : C.ink} testID="cash-due-total" />
        </Pressable>
      </View>

      <View style={snug ? { gap: 20 } : { flexDirection: 'row', alignItems: 'flex-start', gap: 24 }}>
        <View style={[{ gap: 10, minWidth: 0 }, snug ? null : { flex: 1.6 }]}>
          <T size={17} w="semibold" head accessibilityRole="header">
            {t('entries')}
          </T>
          <Panel>
            {rows.length ? (
              <>
                <TableHead cols={COLS} labels={[t('date'), '', t('moneyIn'), t('moneyOut')]} />
                {rows.map((row, i) => {
                  const detail = cashDetail(row);
                  return (
                    <TableRow
                      key={row.key}
                      cols={COLS}
                      last={i === rows.length - 1}
                      onPress={() => open(row)}
                      testID={`cash-row-${row.key}`}
                      cells={[
                        <T size={14} color={C.muted}>{formatDay(row.date, lang)}</T>,
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' }}>
                          <Icon name={row.kind === 'in' ? 'moneyIn' : 'moneyOut'} size={18} color={row.kind === 'in' ? C.greenDark : C.muted} stroke={2.2} />
                          <View style={{ flex: 1 }}>
                            <T size={14.5} w="semibold" numberOfLines={1}>{cashTitle(row, t)}</T>
                            {detail ? <T size={13} color={C.muted} numberOfLines={1}>{detail}</T> : null}
                          </View>
                        </View>,
                        row.kind === 'in' ? <T size={14.5} w="semibold" latin color={C.greenText}>{formatAmount(row.amount)}</T> : null,
                        row.kind === 'out' ? <T size={14.5} w="semibold" latin>{formatAmount(row.amount)}</T> : null,
                      ]}
                    />
                  );
                })}
              </>
            ) : (
              <Empty title={t('noCashTitle')} hint={t('noCashHint')} />
            )}
          </Panel>
          {book.rows.length > shown ? <Button label={t('showMore')} variant="ghost" onPress={() => setShown(shown + PAGE)} testID="cash-more" /> : null}
        </View>

        <View style={[{ gap: 10, minWidth: 0 }, snug ? null : { flex: 1 }]}>
          <T size={17} w="semibold" head accessibilityRole="header">
            {t('expenses')}
          </T>
          <Panel style={{ padding: 16 }}>
            <ExpensesPanel rows={book.rows} />
          </Panel>
        </View>
      </View>

      <CashEntrySheet visible={!!sheet} kind={sheet?.kind ?? 'in'} entry={sheet?.entry} onClose={() => setSheet(null)} />
      <ItemDialog visible={!!itemId} item={items.find((i) => i.id === itemId)} onClose={() => setItemId(null)} />
    </View>
  );
}
