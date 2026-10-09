import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Field } from '../ui/Input';
import { Sheet, SheetScroll } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { PriceFields } from './books';

export interface NewItemInput {
  name: string;
  unit: string;
  price: number;
  cost: number;
  keep: boolean;
}

/** A name typed on a quote or invoice that is not in the items list: its prices, and whether to keep it. */
export function NewItemSheet({ name, visible, onClose, onAdd }: { name: string; visible: boolean; onClose: () => void; onAdd: (input: NewItemInput) => void }) {
  const { t } = useLocale();
  const [title, setTitle] = useState(name);
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState(0);
  const [cost, setCost] = useState(0);
  const [keep, setKeep] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setTitle(name);
    setUnit('');
    setPrice(0);
    setCost(0);
    setKeep(true);
  }, [visible, name]);

  const add = () => {
    if (!title.trim()) return;
    onAdd({ name: title.trim(), unit, price, cost, keep });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('newItemTitle')}>
      <SheetScroll>
        <Field label={t('itemName')} value={title} onChangeText={setTitle} maxLength={80} testID="new-item-name" />
        <PriceFields price={price} setPrice={setPrice} cost={cost} setCost={setCost} onSubmit={add} />
        <Field label={`${t('unit')} (${t('optional')})`} value={unit} onChangeText={setUnit} placeholder={t('unitPh')} maxLength={20} testID="new-item-unit" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T size={15} w="semibold">
              {t('saveToItems')}
            </T>
            <T size={12.5} color={C.muted}>
              {t('saveToItemsHint')}
            </T>
          </View>
          <Switch value={keep} onValueChange={setKeep} trackColor={{ true: C.greenDeep, false: C.border }} thumbColor={C.surface} testID="new-item-keep" />
        </View>
        <Button label={t('addToDoc')} icon="plus" size="lg" head disabled={!title.trim()} onPress={add} testID="new-item-add" />
      </SheetScroll>
    </Sheet>
  );
}
