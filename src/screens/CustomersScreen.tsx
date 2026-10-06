import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { store, useAppState } from '../data/app';
import { money } from '../logic/money';
import { customerDocCount, customerDue } from '../logic/stats';
import type { RootNav } from '../nav';
import { pickContact } from '../platform/contacts';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { SearchBox } from '../ui/Input';
import { Avatar, Empty, Screen, TopBar, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { matchCustomers } from './CustomerPicker';

export function CustomersScreen() {
  const nav = useNavigation<RootNav>();
  const { t } = useLocale();
  const { notify } = useDialogs();
  const { customers, docs, settings } = useAppState();
  const [query, setQuery] = useState('');
  const list = useMemo(() => matchCustomers(customers, query), [customers, query]);

  const importContact = async () => {
    try {
      const picked = await pickContact();
      if (picked === 'denied') return notify(t('contactsDenied'));
      if (picked === null) return;
      if (!picked.name) return;
      const added = store.saveCustomers([picked]);
      notify(added ? t('contactsAdded', { n: added }) : t('contactsNone'));
    } catch {
      notify(t('contactsDenied'));
    }
  };

  return (
    <Screen bottom={false}>
      <TopBar title={t('tabCustomers')} big right={<Button label={t('add')} icon="plus" size="sm" onPress={() => nav.navigate('CustomerEdit')} testID="add-customer" style={{ marginEnd: 4 }} />} />
      <View style={{ backgroundColor: C.surface, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <SearchBox value={query} onChangeText={setQuery} placeholder={t('searchCustomers')} tone="sunken" testID="customers-search" />
      </View>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 14 }}
        ListHeaderComponent={
          <Pressable
            accessibilityRole="button"
            onPress={importContact}
            testID="import-contacts"
            style={{ minHeight: 52, paddingHorizontal: 14, marginBottom: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.borderStrong, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Icon name="download" color={C.greenText} stroke={2} />
            <T size={15} w="semibold" color={C.greenText}>
              {t('importContacts')}
            </T>
          </Pressable>
        }
        ListEmptyComponent={<Empty title={query.trim() ? t('noMatch', { q: query.trim() }) : t('noCustomersYet')} />}
        renderItem={({ item, index }) => {
          const due = customerDue(docs, item.id);
          const count = customerDocCount(docs, item.id);
          const countText = count === 1 ? t('docCountOne') : t('docCountMany', { n: count });
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.navigate('CustomerEdit', { id: item.id })}
              testID={`customer-${item.name}`}
              style={({ pressed }) => ({
                minHeight: 66,
                paddingHorizontal: 14,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: C.surface,
                borderColor: C.line,
                borderStartWidth: 1,
                borderEndWidth: 1,
                borderTopWidth: index === 0 ? 1 : 0,
                borderBottomWidth: 1,
                borderBottomColor: index === list.length - 1 ? C.line : C.lineSoft,
                borderTopLeftRadius: index === 0 ? 16 : 0,
                borderTopRightRadius: index === 0 ? 16 : 0,
                borderBottomLeftRadius: index === list.length - 1 ? 16 : 0,
                borderBottomRightRadius: index === list.length - 1 ? 16 : 0,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Avatar name={item.name} />
              <View style={{ flex: 1, gap: 2 }}>
                <T size={15} w="semibold" numberOfLines={1}>
                  {item.name}
                </T>
                <T size={13} color={C.muted} latin={!!item.phone} numberOfLines={1}>
                  {item.phone || countText}
                </T>
              </View>
              {/* The count sits on the right so the phone number is never squeezed on a narrow phone. */}
              <View style={{ alignItems: 'flex-end', gap: 1 }}>
                {item.phone ? (
                  <T size={13} color={C.muted}>
                    {countText}
                  </T>
                ) : null}
                {due > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                    <T size={12.5} w="semibold" color={C.orange}>
                      {t('due')}
                    </T>
                    <T size={14.5} w="semibold" latin color={C.orange}>
                      {money(due, settings.currency)}
                    </T>
                  </View>
                ) : (
                  <T size={12.5} color={C.muted}>
                    {t('nothingDue')}
                  </T>
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
