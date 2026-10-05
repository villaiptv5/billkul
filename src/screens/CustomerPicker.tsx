import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { store, useAppState } from '../data/app';
import type { Customer } from '../data/types';
import { CAN_PICK_CONTACT, pickContact } from '../platform/contacts';
import { C } from '../theme';
import { Icon } from '../ui/Icon';
import { SearchBox } from '../ui/Input';
import { Avatar, Empty, Sheet, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';

export function matchCustomers(customers: Customer[], query: string): Customer[] {
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const sorted = [...customers].sort((a, b) => a.name.localeCompare(b.name));
  if (!q) return sorted;
  return sorted.filter((c) => c.name.toLowerCase().includes(q) || (digits.length > 2 && c.phone.replace(/\D/g, '').includes(digits)));
}

/** Choose an existing customer, or type a new name and add them on the spot. */
export function CustomerPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (c: Customer) => void }) {
  const { t } = useLocale();
  const { notify } = useDialogs();
  const customers = useAppState().customers;
  const [query, setQuery] = useState('');
  const matches = useMemo(() => matchCustomers(customers, query), [customers, query]);
  const name = query.trim();
  const exact = customers.some((c) => c.name.toLowerCase() === name.toLowerCase());

  const choose = (c: Customer) => {
    setQuery('');
    onPick(c);
  };

  const fromContacts = async () => {
    try {
      const picked = await pickContact();
      if (picked === 'denied') return notify(t('contactsDenied'));
      if (picked && picked.name) choose(store.saveCustomer(picked));
    } catch {
      notify(t('contactsDenied'));
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('chooseCustomer')} full>
      <View style={{ paddingHorizontal: 20, paddingBottom: 10, gap: 10 }}>
        <SearchBox value={query} onChangeText={setQuery} placeholder={t('searchOrNewCustomer')} autoFocus testID="customer-search" />
        {name && !exact ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => choose(store.saveCustomer({ name }))}
            testID="customer-add-new"
            style={{ minHeight: 52, borderRadius: 12, backgroundColor: C.tintGreen, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}
          >
            <Icon name="plus" size={20} color={C.greenDark} stroke={2.2} />
            <View style={{ flex: 1 }}>
              <T size={15} w="semibold" color={C.greenDark}>
                {t('addAsNewCustomer', { name })}
              </T>
            </View>
          </Pressable>
        ) : null}
        {CAN_PICK_CONTACT && !name ? (
          <Pressable
            accessibilityRole="button"
            onPress={fromContacts}
            testID="customer-from-contacts"
            style={{ minHeight: 52, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.borderStrong, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}
          >
            <Icon name="download" size={20} color={C.greenText} />
            <T size={15} w="semibold" color={C.greenText}>
              {t('importContacts')}
            </T>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={matches}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
        ListEmptyComponent={
          customers.length === 0 ? <Empty title={t('noCustomersYet')} hint={t('noCustomersHint')} /> : name ? <Empty title={t('noMatch', { q: name })} /> : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => choose(item)}
            testID={`pick-${item.name}`}
            style={({ pressed }) => ({ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.lineSoft, opacity: pressed ? 0.6 : 1 })}
          >
            <Avatar name={item.name} />
            <View style={{ flex: 1 }}>
              <T size={15} w="semibold" numberOfLines={1}>
                {item.name}
              </T>
              {item.phone ? (
                <T size={13} color={C.muted} latin>
                  {item.phone}
                </T>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </Sheet>
  );
}
