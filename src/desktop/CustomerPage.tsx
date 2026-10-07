import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { store, useAppState } from '../data/app';
import type { Doc, DocType } from '../data/types';
import { formatDate } from '../logic/dates';
import { formatAmount, money } from '../logic/money';
import { docTotals } from '../logic/totals';
import { newDocFor, PaidLine, useCustomerSummary, useDaysText, useDue } from '../screens/customer';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Avatar, Empty, StatusPill } from '../ui/kit';
import { useDeskSize } from '../ui/layout';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { CustomerDialog, PageHeader, Panel, TableHead, TableRow, type Col } from './parts';
import { useDesk } from './route';
import { useLimits } from '../screens/limits';

const QUOTE_HISTORY: Col[] = [{ width: 100 }, { flex: 1 }, { width: 120, end: true }, { width: 100 }];
// An invoice's own line says paid or unpaid, so it needs no status column.
const INVOICE_HISTORY: Col[] = [{ width: 100 }, { flex: 1 }, { width: 130, end: true }];
const DUE_COLS: Col[] = [{ width: 110 }, { flex: 1 }, { width: 130, end: true }, { width: 140, end: true }];
const QUOTE_COLS: Col[] = [{ width: 110 }, { flex: 1 }, { width: 130 }, { width: 140, end: true }];

function Stat({ label, value, symbol, color = C.ink, testID }: { label: string; value: number; symbol: string; color?: string; testID: string }) {
  const { rtl } = useLocale();
  return (
    <Panel style={{ flexGrow: 1, flexBasis: 180, paddingHorizontal: 20, paddingVertical: 16, gap: 6 }}>
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

/** One customer: what they were quoted and invoiced, what is paid and due, and every document written for them. */
export function CustomerPage({ id }: { id: string }) {
  const limits = useLimits();
  const { t, lang } = useLocale();
  const { go } = useDesk();
  const { customers, settings } = useAppState();
  const { snug } = useDeskSize();
  const customer = customers.find((c) => c.id === id);
  const summary = useCustomerSummary(id);
  const [editing, setEditing] = useState(false);
  if (!customer) return null;

  const symbol = settings.currency.symbol;
  const start = (type: DocType) => {
    if (limits.allowDoc()) go({ page: 'editor', docId: newDocFor(type, customer).id });
  };

  const table = (title: string, docs: Doc[], testID: string) => {
    const invoices = docs === summary.invoices;
    const cols = invoices ? INVOICE_HISTORY : QUOTE_HISTORY;
    return (
    <View style={[{ gap: 10, minWidth: 0 }, snug ? null : { flex: 1 }]}>
      <T size={17} w="semibold" head accessibilityRole="header">
        {title}
      </T>
      <Panel testID={testID}>
        {docs.length ? (
          <>
            <TableHead cols={cols} labels={invoices ? [t('colNumber'), t('colStatus'), t('colAmount')] : [t('colNumber'), t('date'), t('colAmount'), t('colStatus')]} />
            {docs.map((doc, i) => (
              <TableRow
                key={doc.id}
                cols={cols}
                last={i === docs.length - 1}
                onPress={() => go({ page: 'editor', docId: doc.id })}
                testID={`history-${doc.number}`}
                cells={
                  invoices
                    ? [
                        <T size={14.5} w="semibold" latin>{doc.number}</T>,
                        doc.status === 'draft' ? <StatusPill status={doc.status} /> : <PaidLine doc={doc} size={13.5} />,
                        <T size={14.5} w="semibold" latin>{money(docTotals(doc).total, settings.currency)}</T>,
                      ]
                    : [
                        <T size={14.5} w="semibold" latin>{doc.number}</T>,
                        <T size={14} color={C.muted}>{formatDate(doc.date, lang)}</T>,
                        <T size={14.5} w="semibold" latin>{money(docTotals(doc).total, settings.currency)}</T>,
                        <StatusPill status={doc.status} />,
                      ]
                }
              />
            ))}
          </>
        ) : (
          <Empty title={t(invoices ? 'noInvoices' : 'noQuotes')} />
        )}
      </Panel>
    </View>
    );
  };

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title={customer.name} subtitle={[customer.phone, customer.address].filter(Boolean).join(' · ') || undefined}>
        <Button label={t('edit')} icon="pencil" variant="secondary" onPress={() => setEditing(true)} testID="customer-edit" />
        <Button label={t('statement')} icon="printer" variant="secondary" onPress={() => go({ page: 'statement', id })} testID="cust-statement" />
        <Button label={t('newQuote')} variant="secondary" onPress={() => start('quote')} testID="cust-new-quote" />
        <Button label={t('newInvoice')} icon="plus" head onPress={() => start('invoice')} testID="cust-new-invoice" />
      </PageHeader>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Stat label={t('quoted')} value={summary.quoted} symbol={symbol} testID="cust-quoted" />
        <Stat label={t('invoiced')} value={summary.invoiced} symbol={symbol} testID="cust-invoiced" />
        <Stat label={t('received')} value={summary.paid} symbol={symbol} color={C.greenText} testID="cust-paid" />
        <Stat label={t('due')} value={summary.due} symbol={symbol} color={summary.due > 0 ? C.danger : C.ink} testID="cust-due" />
      </View>

      <View style={snug ? { gap: 20 } : { flexDirection: 'row', alignItems: 'flex-start', gap: 24 }}>
        {table(t('invoices'), summary.invoices, 'cust-invoices')}
        {table(t('quotes'), summary.quotes, 'cust-quotes')}
      </View>

      <CustomerDialog visible={editing} customer={customer} onClose={() => setEditing(false)} />
    </View>
  );
}

/** Who owes what: every unpaid invoice under its customer, then the quotes still waiting for an answer. */
export function DuePage() {
  const { t, lang } = useLocale();
  const { go } = useDesk();
  const { settings } = useAppState();
  const due = useDue();
  const daysText = useDaysText();
  const symbol = settings.currency.symbol;

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title={t('dueFromCustomers')} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Stat label={t('due')} value={due.total} symbol={symbol} color={due.total > 0 ? C.danger : C.ink} testID="due-total" />
        <Stat label={t('invoices')} value={due.count} symbol="" testID="due-count" />
        <Stat label={t('openQuotes')} value={due.openQuotesTotal} symbol={symbol} testID="due-open-quotes" />
      </View>

      {due.groups.length === 0 ? (
        <Panel>
          <Empty title={t('nothingDueTitle')} hint={t('nothingDueHint')} />
        </Panel>
      ) : (
        due.groups.map((group) => (
          <Panel key={group.key}>
            <Pressable
              accessibilityRole="link"
              disabled={!group.customerId}
              onPress={() => go({ page: 'customer', id: group.customerId })}
              testID={`due-customer-${group.name}`}
              style={{ minHeight: 64, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: '#F8FAF9', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
            >
              <Avatar name={group.name || '?'} size={36} />
              <View style={{ flex: 1 }}>
                <T size={15.5} w="semibold" numberOfLines={1}>
                  {group.name || t('noCustomer')}
                </T>
                {group.phone ? (
                  <T size={13} color={C.muted} latin>
                    {group.phone}
                  </T>
                ) : null}
              </View>
              <T size={18} w="semibold" head latin color={C.danger}>
                {money(group.total, settings.currency)}
              </T>
            </Pressable>
            {group.invoices.map(({ doc, amount, days }, i) => (
              <TableRow
                key={doc.id}
                cols={DUE_COLS}
                last={i === group.invoices.length - 1}
                onPress={() => go({ page: 'editor', docId: doc.id })}
                testID={`due-${doc.number}`}
                cells={[
                  <T size={14.5} w="semibold" latin>{doc.number}</T>,
                  <T size={14} color={C.muted}>{[formatDate(doc.date, lang), daysText(days)].filter(Boolean).join(' · ')}</T>,
                  <T size={14.5} w="semibold" latin>{money(amount, settings.currency)}</T>,
                  <Button label={t('markPaid')} size="sm" onPress={() => store.markPaid(doc.id)} testID={`paid-${doc.number}`} />,
                ]}
              />
            ))}
          </Panel>
        ))
      )}

      {due.openQuotes.length ? (
        <View style={{ gap: 10 }}>
          <T size={17} w="semibold" head accessibilityRole="header">
            {t('openQuotes')}
          </T>
          <Panel>
            <TableHead cols={QUOTE_COLS} labels={[t('colNumber'), t('customer'), t('date'), t('colAmount')]} />
            {due.openQuotes.map(({ doc, amount }, i) => (
              <TableRow
                key={doc.id}
                cols={QUOTE_COLS}
                last={i === due.openQuotes.length - 1}
                onPress={() => go({ page: 'editor', docId: doc.id })}
                testID={`open-${doc.number}`}
                cells={[
                  <T size={14.5} w="semibold" latin>{doc.number}</T>,
                  <T size={14.5} numberOfLines={1}>{doc.customerName || t('noCustomer')}</T>,
                  <T size={14} color={C.muted}>{formatDate(doc.date, lang)}</T>,
                  <T size={14.5} w="semibold" latin>{money(amount, settings.currency)}</T>,
                ]}
              />
            ))}
          </Panel>
        </View>
      ) : null}
    </View>
  );
}
