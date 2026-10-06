import React, { useEffect, useState } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { store, useAppState } from '../data/app';
import { COMMON_UNITS } from '../data/seed';
import type { Customer, Item } from '../data/types';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Field, NumberField } from '../ui/Input';
import { Chip, Sheet, SheetScroll, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { saveItemForm, StockFields } from '../screens/books';
import { T } from '../ui/T';

/** Page title with its actions on the far side. */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <T size={26} w="semibold" head accessibilityRole="header">
          {title}
        </T>
        {subtitle ? (
          <T size={14} color={C.muted}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line }, style]}>{children}</View>;
}

/** One column of a table: either a fixed width or a share of the remaining space. */
export interface Col {
  width?: number;
  flex?: number;
  end?: boolean;
}

function cellStyle(col: Col): ViewStyle {
  return { width: col.width, flex: col.flex, alignItems: col.end ? 'flex-end' : 'flex-start', justifyContent: 'center', minWidth: 0 };
}

export function TableHead({ cols, labels }: { cols: Col[]; labels: string[] }) {
  return (
    <View accessibilityRole="header" style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 20, minHeight: 44, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: '#F8FAF9', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
      {cols.map((col, i) => (
        <View key={i} style={cellStyle(col)}>
          {labels[i] ? (
            <T size={12.5} w="semibold" color={C.muted} end={col.end}>
              {labels[i]}
            </T>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function TableRow({ cols, cells, onPress, last, testID }: { cols: Col[]; cells: React.ReactNode[]; onPress?: () => void; last?: boolean; testID?: string }) {
  const [hovered, setHovered] = useState(false);
  const style: ViewStyle = {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    minHeight: 56,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: last ? 0 : 1,
    borderBottomColor: C.lineSoft,
    backgroundColor: hovered && onPress ? '#F4F9F6' : 'transparent',
    borderBottomLeftRadius: last ? 16 : 0,
    borderBottomRightRadius: last ? 16 : 0,
  };
  const content = cols.map((col, i) => (
    <View key={i} style={cellStyle(col)}>
      {cells[i]}
    </View>
  ));
  // A row that does nothing itself is a plain row, so the buttons and boxes inside it stay usable.
  if (!onPress) {
    return (
      <View testID={testID} style={style}>
        {content}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" onPress={onPress} testID={testID} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} style={style}>
      {content}
    </Pressable>
  );
}

/** Add or edit a customer in a dialog. */
export function CustomerDialog({ visible, customer, onClose }: { visible: boolean; customer?: Customer; onClose: () => void }) {
  const { t } = useLocale();
  const { confirm, notify } = useDialogs();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (visible) {
      setName(customer?.name ?? '');
      setPhone(customer?.phone ?? '');
      setAddress(customer?.address ?? '');
    }
  }, [visible, customer]);

  const save = () => {
    if (!name.trim()) return notify(t('nameRequired'));
    store.saveCustomer({ id: customer?.id, name, phone, address });
    onClose();
  };

  const remove = async () => {
    if (!customer) return;
    onClose();
    if (await confirm({ title: t('deleteCustomerTitle', { name: customer.name }), body: t('deleteCustomerBody'), confirmLabel: t('delete'), danger: true })) store.deleteCustomer(customer.id);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t(customer ? 'editCustomer' : 'newCustomer')}>
      <SheetScroll>
        <Field label={t('name')} value={name} onChangeText={setName} autoFocus autoCapitalize="words" testID="customer-name" onSubmitEditing={save} />
        <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" latin placeholder={t('phonePh')} testID="customer-phone" onSubmitEditing={save} />
        <Field label={`${t('address')} (${t('optional')})`} value={address} onChangeText={setAddress} multiline testID="customer-address" />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          {customer ? <Button label={t('delete')} icon="trash" variant="danger" onPress={remove} testID="customer-delete" /> : null}
          <View style={{ flex: 1 }} />
          <Button label={t('cancel')} variant="secondary" onPress={onClose} />
          <Button label={t('save')} onPress={save} testID="customer-save" style={{ minWidth: 110 }} />
        </View>
      </SheetScroll>
    </Sheet>
  );
}

/** Add or edit a price-list item in a dialog. */
export function ItemDialog({ visible, item, onClose }: { visible: boolean; item?: Item; onClose: () => void }) {
  const { t, lang } = useLocale();
  const { confirm, notify } = useDialogs();
  const { settings, items } = useAppState();
  const currency = settings.currency;
  // The item as it is now: adding stock from inside the dialog changes it.
  const live = item ? items.find((i) => i.id === item.id) ?? item : undefined;
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState(0);
  const [track, setTrack] = useState(false);
  const [opening, setOpening] = useState(0);
  const [lowAt, setLowAt] = useState(0);

  // Filled when the dialog opens, and not again while it is open, so adding stock does not wipe what is typed.
  useEffect(() => {
    if (visible) {
      setName(item?.name ?? '');
      setUnit(item?.unit ?? '');
      setPrice(item?.price ?? 0);
      setTrack(item?.trackStock ?? false);
      setOpening(0);
      setLowAt(item?.lowStock ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, item?.id]);

  const save = () => {
    if (!saveItemForm({ id: item?.id, name, unit, price, track, opening, lowAt })) return notify(t('nameRequired'));
    onClose();
  };

  const remove = async () => {
    if (!item) return;
    onClose();
    if (await confirm({ title: t('deleteItemTitle', { name: item.name }), body: t('deleteItemBody'), confirmLabel: t('delete'), danger: true })) store.deleteItem(item.id);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t(item ? 'editItem' : 'newItem')}>
      <SheetScroll>
        <Field label={t('itemName')} value={name} onChangeText={setName} autoFocus testID="item-name" onSubmitEditing={save} />
        <View style={{ gap: 6 }}>
          <T size={13} w="semibold" color={C.muted}>
            {`${t('price')} (${currency.code})`}
          </T>
          <NumberField label={t('price')} value={price} onChange={setPrice} width={180} height={52} align="end" blankZero testID="item-price" onSubmit={save} />
        </View>
        <Field label={`${t('unit')} (${t('optional')})`} value={unit} onChangeText={setUnit} placeholder={t('unitPh')} autoCapitalize="none" testID="item-unit" onSubmitEditing={save} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {COMMON_UNITS[lang].map((u) => (
            <Chip key={u} label={u} selected={unit === u} onPress={() => setUnit(unit === u ? '' : u)} testID={`unit-${u}`} />
          ))}
        </View>
        <StockFields item={live} track={track} setTrack={setTrack} opening={opening} setOpening={setOpening} lowAt={lowAt} setLowAt={setLowAt} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          {item ? <Button label={t('delete')} icon="trash" variant="danger" onPress={remove} testID="item-delete" /> : null}
          <View style={{ flex: 1 }} />
          <Button label={t('cancel')} variant="secondary" onPress={onClose} />
          <Button label={t('save')} onPress={save} testID="item-save" style={{ minWidth: 110 }} />
        </View>
      </SheetScroll>
    </Sheet>
  );
}
