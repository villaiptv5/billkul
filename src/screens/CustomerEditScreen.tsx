import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { store, useAppState } from '../data/app';
import type { RootNav, RootParams } from '../nav';
import { Button } from '../ui/Button';
import { Field } from '../ui/Input';
import { Screen, TopBar, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';

export function CustomerEditScreen() {
  const nav = useNavigation<RootNav>();
  const id = useRoute<RouteProp<RootParams, 'CustomerEdit'>>().params?.id;
  const { t } = useLocale();
  const { confirm, notify } = useDialogs();
  const existing = useAppState().customers.find((c) => c.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');

  const save = () => {
    if (!name.trim()) return notify(t('nameRequired'));
    store.saveCustomer({ id: existing?.id, name, phone, address });
    nav.goBack();
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm({ title: t('deleteCustomerTitle', { name: existing.name }), body: t('deleteCustomerBody'), confirmLabel: t('delete'), danger: true })) {
      store.deleteCustomer(existing.id);
      nav.goBack();
    }
  };

  return (
    <Screen>
      <TopBar title={t(existing ? 'editCustomer' : 'newCustomer')} onBack={() => nav.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Field label={t('name')} value={name} onChangeText={setName} autoFocus={!existing} autoCapitalize="words" testID="customer-name" />
        <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" latin placeholder={t('phonePh')} testID="customer-phone" />
        <Field label={`${t('address')} (${t('optional')})`} value={address} onChangeText={setAddress} multiline testID="customer-address" />
        <Button label={t('save')} size="lg" head onPress={save} testID="customer-save" />
        {existing ? <Button label={t('delete')} icon="trash" variant="danger" onPress={remove} testID="customer-delete" /> : null}
      </ScrollView>
    </Screen>
  );
}
