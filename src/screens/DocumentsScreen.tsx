import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { store, useAppState } from '../data/app';
import { sortDocs } from '../data/store';
import type { Doc, DocStatus, DocType } from '../data/types';
import { formatDate } from '../logic/dates';
import type { RootNav, TabParams } from '../nav';
import { C } from '../theme';
import { Button, IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { SearchBox } from '../ui/Input';
import { Card, Chip, Empty, Screen, Segmented, Sheet, SheetScroll, TopBar, statusLabelKey, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { PaidLine } from './customer';
import { DocSummary, openDoc } from './shared';

const FILTERS: Record<DocType, DocStatus[]> = {
  quote: ['draft', 'sent', 'accepted'],
  invoice: ['draft', 'due', 'paid'],
};

export function DocumentsScreen() {
  const nav = useNavigation<RootNav>();
  const route = useRoute<RouteProp<TabParams, 'Documents'>>();
  const { t, lang } = useLocale();
  const { confirm } = useDialogs();
  const { docs } = useAppState();
  const [type, setType] = useState<DocType>(route.params?.type ?? 'quote');
  const [status, setStatus] = useState<DocStatus | 'all'>('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<Doc | null>(null);

  useEffect(() => {
    if (route.params?.type) {
      setType(route.params.type);
      setStatus('all');
    }
  }, [route.params]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortDocs(docs).filter(
      (d) =>
        d.type === type &&
        (status === 'all' || d.status === status) &&
        (!q || d.customerName.toLowerCase().includes(q) || d.number.toLowerCase().includes(q)),
    );
  }, [docs, type, status, query]);

  const changeType = (next: DocType) => {
    setType(next);
    setStatus('all');
  };

  const convert = (quote: Doc) => {
    const invoice = store.convertToInvoice(quote.id);
    if (invoice) {
      changeType('invoice');
      nav.navigate('Preview', { docId: invoice.id });
    }
  };

  const remove = async (doc: Doc) => {
    setMenuFor(null);
    if (await confirm({ title: t('deleteDocTitle', { number: doc.number }), body: t('deleteWarning'), confirmLabel: t('delete'), danger: true })) store.deleteDoc(doc.id);
  };

  const invoiceOf = (quote: Doc) => (quote.invoiceId ? docs.find((d) => d.id === quote.invoiceId) : undefined);
  const quoteOf = (invoice: Doc) => (invoice.quoteId ? docs.find((d) => d.id === invoice.quoteId) : undefined);

  const renderDoc = ({ item: doc }: { item: Doc }) => {
    const madeInvoice = doc.type === 'quote' ? invoiceOf(doc) : undefined;
    return (
      <Card style={{ paddingStart: 14, paddingEnd: 4, paddingVertical: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Pressable accessibilityRole="button" onPress={() => openDoc(nav, doc)} testID={`doc-${doc.number}`} style={{ flex: 1, paddingEnd: 2 }}>
            <DocSummary doc={doc} />
          </Pressable>
          <IconButton icon="more" label={t('moreActions', { number: doc.number })} color={C.muted} onPress={() => setMenuFor(doc)} testID={`more-${doc.number}`} />
        </View>
        <View style={{ paddingEnd: 10 }}>
          {doc.status === 'draft' ? (
            <Button label={t('continueEditing')} variant="secondary" size="sm" onPress={() => nav.navigate('Editor', { docId: doc.id })} testID={`continue-${doc.number}`} />
          ) : doc.type === 'quote' ? (
            madeInvoice ? (
              <Pressable accessibilityRole="button" onPress={() => openDoc(nav, madeInvoice)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 }}>
                <Icon name="check" size={16} color={C.muted} stroke={2.2} />
                <T size={13} color={C.muted}>
                  {t('invoiceMade', { number: madeInvoice.number })}
                </T>
              </Pressable>
            ) : (
              <Button label={t('convertToInvoice')} size="sm" onPress={() => convert(doc)} testID={`convert-${doc.number}`} />
            )
          ) : doc.status === 'due' ? (
            <View style={{ minHeight: 24, justifyContent: 'center' }}>
              <PaidLine doc={doc} />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 }}>
              <Icon name="check" size={16} color={C.greenText} stroke={2.2} />
              <T size={13} color={C.muted}>
                {t('paidOn', { date: formatDate(doc.paidOn || doc.date, lang) })}
              </T>
            </View>
          )}
        </View>
      </Card>
    );
  };

  const menuQuote = menuFor && menuFor.type === 'invoice' ? quoteOf(menuFor) : undefined;

  return (
    <Screen bottom={false}>
      <TopBar
        title={t('tabDocuments')}
        big
        right={<IconButton icon={searching ? 'close' : 'search'} label={t('searchDocs')} onPress={() => { setSearching(!searching); setQuery(''); }} testID="docs-search-toggle" />}
      />
      <View style={{ backgroundColor: C.surface, paddingHorizontal: 20, paddingBottom: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
        {searching ? <SearchBox value={query} onChangeText={setQuery} placeholder={t('searchDocs')} autoFocus tone="sunken" testID="docs-search" /> : null}
        <Segmented
          value={type}
          onChange={changeType}
          options={[
            { value: 'quote', label: t('quotes'), testID: 'tab-quotes' },
            { value: 'invoice', label: t('invoices'), testID: 'tab-invoices' },
          ]}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(d) => d.id}
        renderItem={renderDoc}
        contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 10 }}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
            <Chip label={t('all')} selected={status === 'all'} onPress={() => setStatus('all')} testID="filter-all" />
            {FILTERS[type].map((s) => (
              <Chip key={s} label={t(statusLabelKey(s))} selected={status === s} onPress={() => setStatus(s)} testID={`filter-${s}`} />
            ))}
          </ScrollView>
        }
        ListEmptyComponent={
          <Empty title={status === 'all' && !query ? t(type === 'quote' ? 'noQuotes' : 'noInvoices') : t('noneWithStatus')} />
        }
      />

      <Sheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor ? menuFor.number : ''}>
        {menuFor ? (
          <SheetScroll>
            {menuQuote ? (
              <T size={13.5} color={C.muted}>
                {t('fromQuote', { number: menuQuote.number })}
              </T>
            ) : null}
            <Button label={t('open')} variant="secondary" onPress={() => { const d = menuFor; setMenuFor(null); nav.navigate('Preview', { docId: d.id }); }} testID="menu-open" />
            <Button label={t('edit')} icon="pencil" variant="secondary" onPress={() => { const d = menuFor; setMenuFor(null); nav.navigate('Editor', { docId: d.id }); }} testID="menu-edit" />
            {menuFor.type === 'quote' && menuFor.status === 'sent' ? (
              <Button label={t('markAccepted')} variant="secondary" onPress={() => { store.markAccepted(menuFor.id); setMenuFor(null); }} testID="menu-accept" />
            ) : null}
            {menuFor.type === 'invoice' && menuFor.status === 'due' ? (
              <Button label={t('markPaid')} onPress={() => { store.markPaid(menuFor.id); setMenuFor(null); }} testID="menu-paid" />
            ) : null}
            {menuFor.type === 'invoice' && menuFor.status === 'paid' ? (
              <Button label={t('markUnpaid')} variant="secondary" onPress={() => { store.markUnpaid(menuFor.id); setMenuFor(null); }} testID="menu-unpaid" />
            ) : null}
            <Button label={t('delete')} icon="trash" variant="danger" onPress={() => remove(menuFor)} testID="menu-delete" />
          </SheetScroll>
        ) : null}
      </Sheet>
    </Screen>
  );
}
