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
import { Chip, Empty, Screen, TopBar } from '../ui/kit';
import { ImportItemsSheet } from './ImportItems';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { stockText, useStock } from './books';

export function ItemsScreen() {
  const nav = useNavigation<RootNav>();
  const { t } = useLocale();
  const { items, settings } = useAppState();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ id: string; price: number } | null>(null);
  const [lowOnly, setLowOnly] = useState(false);
  const [importing, setImporting] = useState(false);
  const { levels, low } = useStock();
  const counted = items.some((i) => i.trackStock);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = (lowOnly ? low : [...items].sort((a, b) => a.name.localeCompare(b.name)));
    return q ? sorted.filter((i) => i.name.toLowerCase().includes(q)) : sorted;
  }, [items, query, lowOnly, low]);

  const savePrice = (item: Item) => {
    if (editing) store.saveItem({ id: item.id, name: item.name, price: editing.price });
    setEditing(null);
  };

  return (
    <Screen bottom={false}>
      <TopBar
        title={t('tabItems')}
        big
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginEnd: 4 }}>
            <IconButton icon="upload" label={t('importItems')} onPress={() => setImporting(true)} testID="import-items" />
            <Button label={t('add')} icon="plus" size="sm" onPress={() => nav.navigate('ItemEdit')} testID="add-item" />
          </View>
        }
      />
      <View style={{ backgroundColor: C.surface, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <SearchBox value={query} onChangeText={setQuery} placeholder={t('searchItems')} tone="sunken" testID="items-search" />
      </View>
      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        extraData={[editing, levels]}
        contentContainerStyle={{ padding: 16, paddingTop: 14 }}
        ListHeaderComponent={
          items.length ? (
            <>
            {counted ? (
              <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 12 }}>
                <Chip label={t('all')} selected={!lowOnly} onPress={() => setLowOnly(false)} testID="items-all" />
                <Chip label={low.length ? `${t('lowStock')} (${low.length})` : t('lowStock')} selected={lowOnly} onPress={() => setLowOnly(true)} testID="items-low" />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 10 }}>
              <T size={13} color={C.muted}>
                {items.length === 1 ? t('itemCountOne') : t('itemCountMany', { n: items.length })}
              </T>
              <T size={13} color={C.muted}>
                {t('priceIn', { code: settings.currency.code })}
              </T>
            </View>
            </>
          ) : null
        }
        ListEmptyComponent={query.trim() ? <Empty title={t('noMatch', { q: query.trim() })} /> : lowOnly ? <Empty title={t('noLowStock')} /> : <Empty title={t('noItemsYet')} hint={t('noItemsHint')} />}
        renderItem={({ item, index }) => {
          const isEditing = editing?.id === item.id;
          const stock = item.trackStock ? stockText(item, levels.get(item.id) ?? 0, t) : null;
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
                {item.unit || stock ? (
                  <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
                    {item.unit ? (
                      <T size={13} color={C.muted}>
                        {stock ? `${t('per', { unit: item.unit })} ·` : t('per', { unit: item.unit })}
                      </T>
                    ) : null}
                    {stock ? (
                      <T size={13} w={stock.state === 'ok' ? 'regular' : 'semibold'} color={stock.color} testID={`stock-${item.name}`}>
                        {stock.text}
                      </T>
                    ) : null}
                  </View>
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
      <ImportItemsSheet visible={importing} onClose={() => setImporting(false)} />
    </Screen>
  );
}
