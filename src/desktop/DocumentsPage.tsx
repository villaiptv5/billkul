import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { store, useAppState } from '../data/app';
import { sortDocs } from '../data/store';
import type { Doc, DocStatus, DocType } from '../data/types';
import { formatDate, formatDay } from '../logic/dates';
import { money } from '../logic/money';
import { docTotals } from '../logic/totals';
import { C } from '../theme';
import { Button, IconButton } from '../ui/Button';
import { SearchBox } from '../ui/Input';
import { Chip, Empty, Segmented, StatusPill, statusLabelKey, useDialogs } from '../ui/kit';
import { PaidLine } from '../screens/customer';
import { useDeskSize } from '../ui/layout';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { PageHeader, Panel, TableHead, TableRow, type Col } from './parts';
import { useDesk } from './route';
import { useLimits } from '../screens/limits';

const FILTERS: Record<DocType, DocStatus[]> = {
  quote: ['draft', 'sent', 'accepted'],
  invoice: ['draft', 'due', 'paid'],
};

const COLS: Col[] = [{ width: 110 }, { flex: 1 }, { width: 110 }, { width: 140, end: true }, { width: 110 }, { width: 250, end: true }];
// On a narrower window the date column is left out.
const SNUG_COLS = COLS.filter((_, i) => i !== 2);

export function DocumentsPage({ type, onNew }: { type: DocType; onNew: (type: DocType) => void }) {
  const { t, lang } = useLocale();
  const { go } = useDesk();
  const { confirm } = useDialogs();
  const { snug } = useDeskSize();
  const cols = snug ? SNUG_COLS : COLS;
  const pick = <V,>(cells: V[]) => (snug ? cells.filter((_, i) => i !== 2) : cells);
  const { docs, settings } = useAppState();
  const [status, setStatus] = useState<DocStatus | 'all'>('all');
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortDocs(docs).filter(
      (d) => d.type === type && (status === 'all' || d.status === status) && (!q || d.customerName.toLowerCase().includes(q) || d.number.toLowerCase().includes(q)),
    );
  }, [docs, type, status, query]);

  const changeType = (next: DocType) => {
    setStatus('all');
    go({ page: 'documents', type: next });
  };

  const limits = useLimits();
  const convert = (quote: Doc) => {
    if (!quote.invoiceId && !limits.allowDoc()) return;
    const invoice = store.convertToInvoice(quote.id);
    if (invoice) go({ page: 'editor', docId: invoice.id });
  };

  const remove = async (doc: Doc) => {
    if (await confirm({ title: t('deleteDocTitle', { number: doc.number }), body: t('deleteWarning'), confirmLabel: t('delete'), danger: true })) store.deleteDoc(doc.id);
  };

  const action = (doc: Doc) => {
    if (doc.status === 'draft') return null;
    if (doc.type === 'quote') {
      const invoice = doc.invoiceId ? docs.find((d) => d.id === doc.invoiceId) : undefined;
      return invoice ? (
        <Button label={invoice.number} variant="ghost" size="sm" onPress={() => go({ page: 'editor', docId: invoice.id })} />
      ) : (
        <Button label={t('convertToInvoice')} size="sm" onPress={() => convert(doc)} testID={`convert-${doc.number}`} />
      );
    }
    return <PaidLine doc={doc} />;
  };

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title={t('tabDocuments')} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <View style={{ width: 280 }}>
          <Segmented
            value={type}
            onChange={changeType}
            options={[
              { value: 'quote', label: t('quotes'), testID: 'tab-quotes' },
              { value: 'invoice', label: t('invoices'), testID: 'tab-invoices' },
            ]}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={t('all')} selected={status === 'all'} onPress={() => setStatus('all')} testID="filter-all" />
          {FILTERS[type].map((s) => (
            <Chip key={s} label={t(statusLabelKey(s))} selected={status === s} onPress={() => setStatus(s)} testID={`filter-${s}`} />
          ))}
        </View>
        <View style={{ flex: 1, minWidth: 220 }}>
          <SearchBox value={query} onChangeText={setQuery} placeholder={t('searchDocs')} testID="docs-search" />
        </View>
      </View>

      <Panel>
        <TableHead cols={cols} labels={pick([t('colNumber'), t('customer'), t('date'), t('colAmount'), t('colStatus'), ''])} />
        {list.length ? (
          list.map((doc, i) => (
            <TableRow
              key={doc.id}
              cols={cols}
              last={i === list.length - 1}
              onPress={() => go({ page: 'editor', docId: doc.id })}
              testID={`doc-${doc.number}`}
              cells={pick([
                <T size={14.5} w="semibold" latin>{doc.number}</T>,
                <T size={14.5} numberOfLines={1}>{doc.customerName || t('noCustomer')}</T>,
                <T size={14} color={C.muted}>{formatDay(doc.date, lang)}</T>,
                <T size={14.5} w="semibold" latin>{money(docTotals(doc).total, settings.currency)}</T>,
                <StatusPill status={doc.status} />,
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {action(doc)}
                  <IconButton icon="trash" label={`${t('delete')} ${doc.number}`} color={C.muted} onPress={() => remove(doc)} testID={`delete-${doc.number}`} />
                </View>,
              ])}
            />
          ))
        ) : (
          status === 'all' && !query ? (
            <Empty title={t(type === 'quote' ? 'noQuotes' : 'noInvoices')} action={<Button label={t(type === 'quote' ? 'newQuote' : 'newInvoice')} icon="plus" head onPress={() => onNew(type)} testID="first-doc" />} />
          ) : (
            <Empty title={t('noneWithStatus')} />
          )
        )}
      </Panel>
    </View>
  );
}
