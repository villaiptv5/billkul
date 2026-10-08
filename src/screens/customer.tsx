import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { store, useAppState } from '../data/app';
import type { Customer, Doc, DocType } from '../data/types';
import { formatDate } from '../logic/dates';
import { formatAmount, money } from '../logic/money';
import { customerSummary, dueReport } from '../logic/stats';
import { isoDate } from '../logic/dates';
import { docTotals } from '../logic/totals';
import type { RootNav, RootParams } from '../nav';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Avatar, Card, Empty, Screen, StatusPill, TopBar } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { openDoc } from './shared';
import { useLimits } from './limits';

/** Starts a quote or invoice already made out to this customer. */
export function newDocFor(type: DocType, customer: Customer): Doc {
  const doc = store.createDoc(type);
  return store.patchDoc(doc.id, { customerId: customer.id, customerName: customer.name, customerPhone: customer.phone }) ?? doc;
}

export function useCustomerSummary(customerId: string) {
  const { docs } = useAppState();
  return useMemo(() => customerSummary(docs, customerId), [docs, customerId]);
}

/** Everything still owed, and the quotes still waiting, as of today. */
export function useDue() {
  const { docs } = useAppState();
  const today = isoDate();
  return useMemo(() => dueReport(docs, today), [docs, today]);
}

/** "6 days" or "1 day"; nothing for an invoice written today. */
export function useDaysText() {
  const { t } = useLocale();
  return (days: number) => (days <= 0 ? '' : days === 1 ? t('daysOne') : t('daysMany', { n: days }));
}

/** Under an invoice in a list: "Paid on 6 Oct 2026", or "Unpaid since 6 Oct 2026" in bold red. */
export function PaidLine({ doc, size = 13 }: { doc: Doc; size?: number }) {
  const { t, lang } = useLocale();
  if (doc.type !== 'invoice' || doc.status === 'draft') return null;
  if (doc.status === 'paid') {
    return (
      <T size={size} color={C.muted}>
        {t('paidOn', { date: formatDate(doc.paidOn || doc.date, lang) })}
      </T>
    );
  }
  return (
    <T size={size} w="bold" head color={C.danger} testID={`unpaid-${doc.number}`}>
      {t('unpaidSince', { date: formatDate(doc.date, lang) })}
    </T>
  );
}

function Tile({ label, value, color = C.ink, testID }: { label: string; value: number; color?: string; testID: string }) {
  const { rtl } = useLocale();
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 10, gap: 2 }}>
      <T size={13} color={C.muted}>
        {label}
      </T>
      <T size={18} w="semibold" head latin color={color} end={rtl} testID={testID}>
        {formatAmount(value)}
      </T>
    </View>
  );
}

/** One quote or invoice in a customer's history: number and date, amount and status. */
export function HistoryRow({ doc, onPress, last }: { doc: Doc; onPress: () => void; last?: boolean }) {
  const { lang } = useLocale();
  const currency = useAppState().settings.currency;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} testID={`history-${doc.number}`} style={({ pressed }) => ({ minHeight: 62, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.lineSoft, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={15} w="semibold" latin>
          {doc.number}
        </T>
        {doc.type === 'invoice' && doc.status !== 'draft' ? (
          <PaidLine doc={doc} />
        ) : (
          <T size={13} color={C.muted}>
            {formatDate(doc.date, lang)}
          </T>
        )}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <T size={15} w="semibold" latin>
          {money(docTotals(doc).total, currency)}
        </T>
        <StatusPill status={doc.status} />
      </View>
      <Icon name="chevron" size={18} color={C.muted} stroke={2} />
    </Pressable>
  );
}

/** A customer's page on the phone: what they owe, their statement, and every quote and invoice written for them. */
export function CustomerScreen() {
  const limits = useLimits();
  const nav = useNavigation<RootNav>();
  const { id } = useRoute<RouteProp<RootParams, 'Customer'>>().params;
  const { t } = useLocale();
  const customer = useAppState().customers.find((c) => c.id === id);
  const summary = useCustomerSummary(id);

  useEffect(() => {
    if (!customer) nav.goBack();
  }, [customer, nav]);
  if (!customer) return null;

  const start = (type: DocType) => {
    if (limits.allowDoc()) nav.navigate('Editor', { docId: newDocFor(type, customer).id });
  };
  const section = (title: string, docs: Doc[]) =>
    docs.length ? (
      <View style={{ gap: 6 }}>
        <T size={13} w="semibold" color={C.muted} style={{ paddingHorizontal: 4 }}>
          {title}
        </T>
        <Card>
          {docs.map((doc, i) => (
            <HistoryRow key={doc.id} doc={doc} last={i === docs.length - 1} onPress={() => openDoc(nav, doc)} />
          ))}
        </Card>
      </View>
    ) : null;

  return (
    <Screen>
      <TopBar title={customer.name} subtitle={customer.phone || undefined} latinSubtitle onBack={() => nav.goBack()} right={<Button label={t('edit')} variant="ghost" size="sm" onPress={() => nav.navigate('CustomerEdit', { id })} testID="customer-edit" style={{ paddingHorizontal: 12 }} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {customer.address ? (
          <T size={13.5} color={C.muted} numberOfLines={2}>
            {customer.address}
          </T>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Tile label={t('quoted')} value={summary.quoted} testID="cust-quoted" />
          <Tile label={t('invoiced')} value={summary.invoiced} testID="cust-invoiced" />
          <Tile label={t('received')} value={summary.paid} color={C.greenText} testID="cust-paid" />
          <Tile label={t('due')} value={summary.due} color={summary.due > 0 ? C.danger : C.ink} testID="cust-due" />
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label={t('newQuote')} variant="secondary" onPress={() => start('quote')} style={{ flex: 1 }} testID="cust-new-quote" />
            <Button label={t('newInvoice')} head onPress={() => start('invoice')} style={{ flex: 1 }} testID="cust-new-invoice" />
          </View>
          <Button label={t('statement')} icon="printer" variant="secondary" onPress={() => nav.navigate('Statement', { id })} testID="cust-statement" />
        </View>

        {summary.invoices.length + summary.quotes.length === 0 ? (
          <Card>
            <Empty title={t('noCustomerDocs')} />
          </Card>
        ) : (
          <>
            {section(t('invoices'), summary.invoices)}
            {section(t('quotes'), summary.quotes)}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Who owes what, on the phone. */
export function DueScreen() {
  const nav = useNavigation<RootNav>();
  const { t, lang, rtl } = useLocale();
  const { settings } = useAppState();
  const due = useDue();
  const daysText = useDaysText();

  return (
    <Screen>
      <TopBar title={t('dueFromCustomers')} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ backgroundColor: C.ink, borderRadius: 18, padding: 16, gap: 2 }}>
          <T size={13.5} color={C.onInkMuted}>
            {due.count === 1 ? t('invoiceCountOne') : t('invoiceCountMany', { n: due.count })}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, direction: 'ltr', justifyContent: rtl ? 'flex-end' : 'flex-start' }}>
            <T size={15} w="medium" latin color={C.onInkMuted}>
              {settings.currency.symbol}
            </T>
            <T size={30} w="bold" head latin color={due.total > 0 ? C.orangeOnInk : C.onInk} testID="due-total">
              {formatAmount(due.total)}
            </T>
          </View>
        </View>

        {due.groups.length === 0 ? (
          <Card>
            <Empty title={t('nothingDueTitle')} hint={t('nothingDueHint')} />
          </Card>
        ) : (
          due.groups.map((group) => (
            <Card key={group.key}>
              <Pressable accessibilityRole="button" disabled={!group.customerId} onPress={() => nav.navigate('Customer', { id: group.customerId })} testID={`due-customer-${group.name}`} style={{ minHeight: 60, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
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
                <T size={16} w="semibold" head latin color={C.danger}>
                  {money(group.total, settings.currency)}
                </T>
              </Pressable>
              {group.invoices.map(({ doc, amount, days }, i) => (
                <View key={doc.id} style={{ paddingStart: 14, paddingEnd: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: i === group.invoices.length - 1 ? 0 : 1, borderBottomColor: C.lineSoft }}>
                  <Pressable accessibilityRole="button" onPress={() => nav.navigate('Preview', { docId: doc.id })} testID={`due-${doc.number}`} style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'baseline' }}>
                      <T size={14.5} w="semibold" latin>
                        {doc.number}
                      </T>
                      <T size={14.5} w="semibold" latin>
                        {formatAmount(amount)}
                      </T>
                    </View>
                    <T size={13} color={C.muted}>
                      {[formatDate(doc.date, lang), daysText(days)].filter(Boolean).join(' · ')}
                    </T>
                  </Pressable>
                  <PaidLine doc={doc} size={13} />
                </View>
              ))}
            </Card>
          ))
        )}

        {due.openQuotes.length ? (
          <View style={{ gap: 6 }}>
            <T size={13} w="semibold" color={C.muted} style={{ paddingHorizontal: 4 }}>
              {t('openQuotes')}
            </T>
            <Card>
              {due.openQuotes.map(({ doc, amount }, i) => (
                <Pressable key={doc.id} accessibilityRole="button" onPress={() => nav.navigate('Preview', { docId: doc.id })} testID={`open-${doc.number}`} style={{ minHeight: 58, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: i === due.openQuotes.length - 1 ? 0 : 1, borderBottomColor: C.lineSoft }}>
                  <View style={{ flex: 1, gap: 1 }}>
                    <T size={15} w="semibold" numberOfLines={1}>
                      {doc.customerName || t('noCustomer')}
                    </T>
                    <View style={{ flexDirection: 'row', gap: 5 }}>
                      <T size={13} color={C.muted} latin>
                        {doc.number}
                      </T>
                      <T size={13} color={C.muted}>
                        {`· ${formatDate(doc.date, lang)}`}
                      </T>
                    </View>
                  </View>
                  <T size={15} w="semibold" latin>
                    {money(amount, settings.currency)}
                  </T>
                  <Icon name="chevron" size={18} color={C.muted} stroke={2} />
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
