import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAppState } from '../data/app';
import type { Customer } from '../data/types';
import { money } from '../logic/money';
import { customerDocCount, customerDue } from '../logic/stats';
import { matchCustomers } from '../screens/CustomerPicker';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { SearchBox } from '../ui/Input';
import { Avatar, Empty } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { CustomerDialog, PageHeader, Panel, TableHead, TableRow, type Col } from './parts';
import { useDesk } from './route';

const COLS: Col[] = [{ flex: 1.6 }, { width: 170 }, { width: 140 }, { width: 170, end: true }];

export function CustomersPage() {
  const { t } = useLocale();
  const { go } = useDesk();
  const { customers, docs, settings } = useAppState();
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<{ customer?: Customer } | null>(null);
  const list = useMemo(() => matchCustomers(customers, query), [customers, query]);

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title={t('tabCustomers')}>
        <Button label={t('newCustomer')} icon="plus" head onPress={() => setDialog({})} testID="add-customer" />
      </PageHeader>

      <View style={{ maxWidth: 420 }}>
        <SearchBox value={query} onChangeText={setQuery} placeholder={t('searchCustomers')} testID="customers-search" />
      </View>

      <Panel>
        {list.length ? (
          <>
            <TableHead cols={COLS} labels={[t('name'), t('phone'), t('colDocuments'), t('due')]} />
            {list.map((customer, i) => {
              const due = customerDue(docs, customer.id);
              const count = customerDocCount(docs, customer.id);
              return (
                <TableRow
                  key={customer.id}
                  cols={COLS}
                  last={i === list.length - 1}
                  onPress={() => go({ page: 'customer', id: customer.id })}
                  testID={`customer-${customer.name}`}
                  cells={[
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' }}>
                      <Avatar name={customer.name} size={36} />
                      <View style={{ flex: 1 }}>
                        <T size={14.5} w="semibold" numberOfLines={1}>{customer.name}</T>
                      </View>
                    </View>,
                    <T size={14} color={C.muted} latin>{customer.phone}</T>,
                    <T size={14} color={C.muted}>{count === 1 ? t('docCountOne') : t('docCountMany', { n: count })}</T>,
                    due > 0 ? (
                      <T size={14.5} w="semibold" latin color={C.orange}>{money(due, settings.currency)}</T>
                    ) : (
                      <T size={13.5} color={C.muted}>{t('nothingDue')}</T>
                    ),
                  ]}
                />
              );
            })}
          </>
        ) : (
          <Empty title={query.trim() ? t('noMatch', { q: query.trim() }) : t('noCustomersYet')} />
        )}
      </Panel>

      <CustomerDialog visible={!!dialog} customer={dialog?.customer} onClose={() => setDialog(null)} />
    </View>
  );
}
