import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { store, useAppState } from '../data/app';
import type { Item } from '../data/types';
import { C } from '../theme';
import { Button, IconButton } from '../ui/Button';
import { NumberField, SearchBox } from '../ui/Input';
import { Empty } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { ItemDialog, PageHeader, Panel, TableHead, TableRow, type Col } from './parts';

const COLS: Col[] = [{ flex: 1 }, { width: 160 }, { width: 150, end: true }, { width: 44 }];

export function ItemsPage() {
  const { t } = useLocale();
  const { items, settings } = useAppState();
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<{ item?: Item } | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
    return q ? sorted.filter((i) => i.name.toLowerCase().includes(q)) : sorted;
  }, [items, query]);

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title={t('tabItems')} subtitle={items.length ? (items.length === 1 ? t('itemCountOne') : t('itemCountMany', { n: items.length })) : undefined}>
        <Button label={t('newItem')} icon="plus" head onPress={() => setDialog({})} testID="add-item" />
      </PageHeader>

      <View style={{ maxWidth: 420 }}>
        <SearchBox value={query} onChangeText={setQuery} placeholder={t('searchItems')} testID="items-search" />
      </View>

      <Panel>
        {list.length ? (
          <>
            <TableHead cols={COLS} labels={[t('itemName'), t('unit'), t('priceIn', { code: settings.currency.code }), '']} />
            {list.map((item, i) => (
              <TableRow
                key={item.id}
                cols={COLS}
                last={i === list.length - 1}
                cells={[
                  <Pressable accessibilityRole="button" onPress={() => setDialog({ item })} testID={`item-${item.name}`} style={{ alignSelf: 'stretch', minHeight: 40, justifyContent: 'center' }}>
                    <T size={14.5} w="semibold" numberOfLines={1}>{item.name}</T>
                  </Pressable>,
                  <T size={14} color={C.muted}>{item.unit}</T>,
                  // The price is typed straight into the table and saved as it is typed.
                  <NumberField label={t('editPriceOf', { name: item.name })} value={item.price} onChange={(price) => store.saveItem({ id: item.id, name: item.name, price })} width={130} height={40} align="end" blankZero testID={`price-${item.name}`} />,
                  <IconButton icon="pencil" label={`${t('editItem')}: ${item.name}`} color={C.muted} size={40} onPress={() => setDialog({ item })} testID={`edit-item-${item.name}`} />,
                ]}
              />
            ))}
          </>
        ) : query.trim() ? (
          <Empty title={t('noMatch', { q: query.trim() })} />
        ) : (
          <Empty title={t('noItemsYet')} hint={t('noItemsHint')} />
        )}
      </Panel>

      <ItemDialog visible={!!dialog} item={dialog?.item} onClose={() => setDialog(null)} />
    </View>
  );
}
