import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { store, useAppState } from '../data/app';
import type { Item } from '../data/types';
import { formatAmount } from '../logic/money';
import type { RootNav } from '../nav';
import { C } from '../theme';
import { Button, IconButton } from '../ui/Button';
import { NumberField, SearchBox } from '../ui/Input';
import { Empty, Screen, TopBar } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';

export function ItemsScreen() {
  const nav = useNavigation<RootNav>();
  const { t } = useLocale();
  const { items, settings } = useAppState();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ id: string; price: number } | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
    return q ? sorted.filter((i) => i.name.toLowerCase().includes(q)) : sorted;
  }, [items, query]);

  const savePrice = (item: Item) => {
    if (editing) store.saveItem({ id: item.id, name: item.name, price: editing.price });
    setEditing(null);
  };

  return (
    <Screen bottom={false}>
      <TopBar title={t('tabItems')} big right={<Button label={t('add')} icon="plus" size="sm" onPress={() => nav.navigate('ItemEdit')} testID="add-item" style={{ marginEnd: 4 }} />} />
      <View style={{ backgroundColor: C.surface, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <SearchBox value={query} onChangeText={setQuery} placeholder={t('searchItems')} tone="sunken" testID="items-search" />
      </View>
      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        extraData={editing}
        contentContainerStyle={{ padding: 16, paddingTop: 14 }}
        ListHeaderComponent={
          items.length ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 10 }}>
              <T size={13} color={C.muted}>
                {items.length === 1 ? t('itemCountOne') : t('itemCountMany', { n: items.length })}
              </T>
              <T size={13} color={C.muted}>
                {t('priceIn', { code: settings.currency.code })}
              </T>
            </View>
          ) : null
        }
        ListEmptyComponent={query.trim() ? <Empty title={t('noMatch', { q: query.trim() })} /> : <Empty title={t('noItemsYet')} hint={t('noItemsHint')} />}
        renderItem={({ item, index }) => {
          const isEditing = editing?.id === item.id;
          return (
            <View
              style={{
                minHeight: isEditing ? 72 : 64,
                paddingStart: 14,
                paddingEnd: 6,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: isEditing ? '#F1FBF6' : C.surface,
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
              }}
            >
              <Pressable accessibilityRole="button" onPress={() => nav.navigate('ItemEdit', { id: item.id })} testID={`item-${item.name}`} style={{ flex: 1, gap: 2, minHeight: 44, justifyContent: 'center' }}>
                <T size={15} w="semibold">
                  {item.name}
                </T>
                {item.unit ? (
                  <T size={13} color={C.muted}>
                    {t('per', { unit: item.unit })}
                  </T>
                ) : null}
              </Pressable>
              {isEditing ? (
                <>
                  <NumberField label={t('editPriceOf', { name: item.name })} value={editing.price} onChange={(price) => setEditing({ id: item.id, price })} width={96} align="end" blankZero highlight autoFocus onSubmit={() => savePrice(item)} testID="quick-price" />
                  <IconButton icon="check" label={t('savePrice')} bg={C.green} onPress={() => savePrice(item)} testID="quick-price-save" />
                </>
              ) : (
                <>
                  {item.price ? (
                    <T size={15} w="semibold" latin>
                      {formatAmount(item.price)}
                    </T>
                  ) : (
                    <T size={13.5} w="semibold" color={C.greenText}>
                      {t('setPrice')}
                    </T>
                  )}
                  <IconButton icon="pencil" label={t('editPriceOf', { name: item.name })} color={C.muted} onPress={() => setEditing({ id: item.id, price: item.price })} testID={`edit-price-${item.name}`} />
                </>
              )}
            </View>
          );
        }}
      />
    </Screen>
  );
}
