import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { store, useAppState } from '../data/app';
import type { RootNav } from '../nav';
import { pickLogo } from '../platform/logo';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Field } from '../ui/Input';
import { Screen, TopBar } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';

/** Every change here is saved as it is typed, like the rest of the app. */
export function ShopProfileScreen() {
  const nav = useNavigation<RootNav>();
  const { t } = useLocale();
  const { settings } = useAppState();

  const changeLogo = async () => {
    try {
      const picked = await pickLogo();
      if (picked) store.updateSettings({ logo: picked });
    } catch {
      // Leave the logo as it was.
    }
  };

  return (
    <Screen>
      <TopBar title={t('shopProfile')} onBack={() => nav.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(settings.logo ? 'changeLogo' : 'addLogo')}
            onPress={changeLogo}
            testID="profile-logo"
            style={{ width: 72, height: 72, borderRadius: 16, borderWidth: settings.logo ? 0 : 1.5, borderStyle: 'dashed', borderColor: C.borderStrong, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          >
            {settings.logo ? <Image source={{ uri: settings.logo }} style={{ width: 72, height: 72 }} /> : <Icon name="image" size={26} color={C.muted} />}
          </Pressable>
          <View style={{ flex: 1, gap: 4, alignItems: 'flex-start' }}>
            <Button label={t(settings.logo ? 'changeLogo' : 'addLogo')} variant="secondary" size="sm" onPress={changeLogo} />
            {settings.logo ? (
              <Pressable accessibilityRole="button" onPress={() => store.updateSettings({ logo: '' })} testID="remove-logo" style={{ minHeight: 44, justifyContent: 'center' }}>
                <T size={14} w="semibold" color={C.danger}>
                  {t('removeLogo')}
                </T>
              </Pressable>
            ) : null}
          </View>
        </View>
        <Field label={t('shopName')} value={settings.shopName} onChangeText={(shopName) => store.updateSettings({ shopName })} placeholder={t('shopNamePh')} autoCapitalize="words" testID="profile-shop" />
        <Field label={t('phoneLabel')} value={settings.phone} onChangeText={(phone) => store.updateSettings({ phone })} placeholder={t('phonePh')} keyboardType="phone-pad" latin testID="profile-phone" />
        <Field label={`${t('address')} (${t('optional')})`} value={settings.address} onChangeText={(address) => store.updateSettings({ address })} multiline testID="profile-address" />
        <Field label={`${t('footerNote')} (${t('optional')})`} value={settings.footerNote} onChangeText={(footerNote) => store.updateSettings({ footerNote })} placeholder={t('defaultFooter')} testID="profile-footer" />
        <Button label={t('done')} size="lg" head onPress={() => nav.goBack()} testID="profile-done" />
      </ScrollView>
    </Screen>
  );
}
