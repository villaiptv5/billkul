import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { store, useAppState } from '../data/app';
import type { Item } from '../data/types';
import { stockText, StockSheet, useStock } from '../screens/books';
import { ImportItemsSheet } from '../screens/ImportItems';
import { C } from '../theme';
import { Button, IconButton } from '../ui/Button';
import { NumberField, SearchBox } from '../ui/Input';
import { Chip, Empty } from '../ui/kit';
import { useDeskSize } from '../ui/layout';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { ItemDialog, PageHeader, Panel, TableHead, TableRow, type Col } from './parts';

const COLS: Col[] = [{ flex: 1 }, { width: 100 }, { width: 170 }, { width: 124, end: true }, { width: 124, end: true }, { width: 44 }];
// On a narrower window the unit column is left out.
const SNUG_COLS = COLS.filter((_, i) => i !== 1);

export function ItemsPage() {
  const { t } = useLocale();
  const { items, settings } = useAppState();
  const { levels, low } = useStock();
  const [query, setQuery] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [dialog, setDialog] = useState<{ item?: Item } | null>(null);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState<Item | null>(null);
  const counted = items.some((i) => i.trackStock);
  const { snug } = useDeskSize();
  const cols = snug ? SNUG_COLS : COLS;
  const pick = <V,>(cells: V[]) => (snug ? cells.filter((_, i) => i !== 1) : cells);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = lowOnly ? low : [...items].sort((a, b) => a.name.localeCompare(b.name));
    return q ? sorted.filter((i) => i.name.toLowerCase().includes(q)) : sorted;
  }, [items, query, lowOnly, low]);

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title={t('tabItems')} subtitle={items.length ? `${items.length === 1 ? t('itemCountOne') : t('itemCountMany', { n: items.length })} · ${t('priceIn', { code: settings.currency.code })}` : undefined}>
        <Button label={t('importItems')} icon="upload" variant="secondary" onPress={() => setImporting(true)} testID="import-items" />
        <Button label={t('newItem')} icon="plus" head onPress={() => setDialog({})} testID="add-item" />
      </PageHeader>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <View style={{ width: 420, maxWidth: '100%' }}>
          <SearchBox value={query} onChangeText={setQuery} placeholder={t('searchItems')} testID="items-search" />
        </View>
        {counted ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label={t('all')} selected={!lowOnly} onPress={() => setLowOnly(false)} testID="items-all" />
            <Chip label={low.length ? `${t('lowStock')} (${low.length})` : t('lowStock')} selected={lowOnly} onPress={() => setLowOnly(true)} testID="items-low" />
          </View>
        ) : null}
      </View>

      <Panel>
        {list.length ? (
          <>
            <TableHead cols={cols} labels={pick([t('itemName'), t('unit'), t('stock'), t('purchasePrice'), t('salePrice'), ''])} />
            {list.map((item, i) => {
              const stock = item.trackStock ? stockText(item, levels.get(item.id) ?? 0, t) : null;
              return (
                <TableRow
                  key={item.id}
                  cols={cols}
                  last={i === list.length - 1}
                  cells={pick([
                    <Pressable accessibilityRole="button" onPress={() => setDialog({ item })} testID={`item-${item.name}`} style={{ alignSelf: 'stretch', minHeight: 40, justifyContent: 'center' }}>
                      <T size={14.5} w="semibold" numberOfLines={1}>{item.name}</T>
                    </Pressable>,
                    <T size={14} color={C.muted}>{item.unit}</T>,
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'stretch' }}>
                      <View style={{ flex: 1 }}>
                        <T size={14} w={stock && stock.state !== 'ok' ? 'semibold' : 'regular'} color={stock ? stock.color : C.muted} testID={`stock-${item.name}`}>
                          {stock ? stock.text : t('notCounted')}
                        </T>
                      </View>
                      <IconButton icon="plus" label={`${t('addStock')}: ${item.name}`} color={C.greenText} size={36} onPress={() => setAdding(item)} testID={`add-stock-${item.name}`} />
                    </View>,
                    // Both prices are typed straight into the table and saved as they are typed.
                    <NumberField label={`${t('purchasePrice')}: ${item.name}`} value={item.cost} onChange={(cost) => store.saveItem({ id: item.id, name: item.name, cost })} width={116} height={40} align="end" blankZero testID={`cost-${item.name}`} />,
                    <NumberField label={t('editPriceOf', { name: item.name })} value={item.price} onChange={(price) => store.saveItem({ id: item.id, name: item.name, price })} width={116} height={40} align="end" blankZero testID={`price-${item.name}`} />,
                    <IconButton icon="pencil" label={`${t('editItem')}: ${item.name}`} color={C.muted} size={40} onPress={() => setDialog({ item })} testID={`edit-item-${item.name}`} />,
                  ])}
                />
              );
            })}
          </>
        ) : query.trim() ? (
          <Empty title={t('noMatch', { q: query.trim() })} />
        ) : lowOnly ? (
          <Empty title={t('noLowStock')} />
        ) : (
          <Empty title={t('noItemsYet')} hint={t('noItemsHint')} />
        )}
      </Panel>

      <ItemDialog visible={!!dialog} item={dialog?.item} onClose={() => setDialog(null)} />
      <StockSheet visible={!!adding} mode="add" item={adding ?? undefined} onClose={() => setAdding(null)} />
      <ImportItemsSheet visible={importing} onClose={() => setImporting(false)} />
    </View>
  );
}
