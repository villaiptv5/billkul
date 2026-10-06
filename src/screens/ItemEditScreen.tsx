import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { store, useAppState } from '../data/app';
import { COMMON_UNITS } from '../data/seed';
import type { RootNav, RootParams } from '../nav';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Field, NumberField } from '../ui/Input';
import { Chip, Screen, TopBar, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { PriceFields, saveItemForm, StockFields } from './books';

export function ItemEditScreen() {
  const nav = useNavigation<RootNav>();
  const id = useRoute<RouteProp<RootParams, 'ItemEdit'>>().params?.id;
  const { t, lang } = useLocale();
  const { confirm, notify } = useDialogs();
  const { items, settings } = useAppState();
  const existing = items.find((i) => i.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [unit, setUnit] = useState(existing?.unit ?? '');
  const [price, setPrice] = useState(existing?.price ?? 0);
  const [cost, setCost] = useState(existing?.cost ?? 0);
  const [track, setTrack] = useState(existing?.trackStock ?? false);
  const [opening, setOpening] = useState(0);
  const [lowAt, setLowAt] = useState(existing?.lowStock ?? 0);

  // Adding stock from this screen can set a new purchase price; the box follows it, so Save does not put the old one back.
  const storedCost = existing?.cost;
  useEffect(() => {
    if (storedCost !== undefined) setCost(storedCost);
  }, [storedCost]);

  const save = () => {
    if (!saveItemForm({ id: existing?.id, name, unit, price, cost, track, opening, lowAt })) return notify(t('nameRequired'));
    nav.goBack();
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm({ title: t('deleteItemTitle', { name: existing.name }), body: t('deleteItemBody'), confirmLabel: t('delete'), danger: true })) {
      store.deleteItem(existing.id);
      nav.goBack();
    }
  };

  return (
    <Screen>
      <TopBar title={t(existing ? 'editItem' : 'newItem')} onBack={() => nav.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Field label={t('itemName')} value={name} onChangeText={setName} autoFocus={!existing} testID="item-name" />
        <PriceFields price={price} setPrice={setPrice} cost={cost} setCost={setCost} />
        <View style={{ gap: 8 }}>
          <Field label={`${t('unit')} (${t('optional')})`} value={unit} onChangeText={setUnit} placeholder={t('unitPh')} autoCapitalize="none" testID="item-unit" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {COMMON_UNITS[lang].map((u) => (
              <Chip key={u} label={u} selected={unit === u} onPress={() => setUnit(unit === u ? '' : u)} testID={`unit-${u}`} />
            ))}
          </View>
        </View>
        <StockFields item={existing} track={track} setTrack={setTrack} opening={opening} setOpening={setOpening} lowAt={lowAt} setLowAt={setLowAt} />
        <Button label={t('save')} size="lg" head onPress={save} testID="item-save" />
        {existing ? <Button label={t('delete')} icon="trash" variant="danger" onPress={remove} testID="item-delete" /> : null}
      </ScrollView>
    </Screen>
  );
}
