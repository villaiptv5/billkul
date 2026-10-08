import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { getLocales } from 'expo-localization';
import { store, useAppState } from '../data/app';
import type { BusinessType, Lang } from '../data/types';
import type { StringKey } from '../i18n';
import { CURRENCIES } from '../logic/money';
import { pickBackupFile } from '../platform/files';
import { pickLogo } from '../platform/logo';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Field } from '../ui/Input';
import { Screen, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { localPhone } from '../logic/phone';
import { useDriveReady, useDriveRestore } from './drive';

const TYPES: { value: BusinessType; label: StringKey }[] = [
  { value: 'computer', label: 'btComputer' },
  { value: 'general', label: 'btGeneral' },
  { value: 'services', label: 'btServices' },
  { value: 'freelancer', label: 'btFreelancer' },
  { value: 'wholesale', label: 'btWholesale' },
  { value: 'other', label: 'btOther' },
];

/** The phone's own region decides the starting currency; it can be changed in Settings. */
function deviceCurrency() {
  try {
    const code = getLocales()[0]?.currencyCode;
    if (code) return CURRENCIES.find((c) => c.code === code) ?? { code, symbol: code };
  } catch {
    // keep the default
  }
  return undefined;
}

export function SetupScreen() {
  const { t, rtl } = useLocale();
  const { notify } = useDialogs();
  const { settings, account } = useAppState();
  const [type, setType] = useState<BusinessType>('computer');
  const [shopName, setShopName] = useState(settings.shopName);
  // The number that signed in is offered as the shop's phone; it can be changed before it goes on any document.
  const [phone, setPhone] = useState(settings.phone || (account ? localPhone(account.phone) : ''));
  const [logo, setLogo] = useState(settings.logo);

  const driveReady = useDriveReady();
  const driveRestore = useDriveRestore();
  const setLanguage = (language: Lang) => store.updateSettings({ language });

  const finish = (skip: boolean) => {
    const currency = deviceCurrency();
    if (currency) store.updateSettings({ currency });
    store.completeSetup(
      { language: settings.language, businessType: skip ? 'other' : type, shopName: skip ? '' : shopName, phone: skip ? '' : phone, logo: skip ? '' : logo },
      !skip,
    );
  };

  const restore = async () => {
    try {
      const json = await pickBackupFile();
      if (json == null) return;
      notify(store.importBackup(json) ? t('restoreDone') : t('restoreBad'));
    } catch {
      notify(t('restoreBad'));
    }
  };

  const addLogo = async () => {
    try {
      const picked = await pickLogo();
      if (picked) setLogo(picked);
    } catch {
      // The user can add a logo later from Settings.
    }
  };

  return (
    <Screen bg={C.surface}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 20, gap: 18 }}>
        {/* The logo is never mirrored or translated: same order and same side in every language. */}
        <View style={{ direction: 'ltr', flexDirection: 'row', alignItems: 'center', gap: 12 }} accessible accessibilityLabel="BillKul">
          <Image source={require('../../assets/icon.png')} style={{ width: 48, height: 48, borderRadius: 12 }} accessibilityIgnoresInvertColors />
          <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 24, lineHeight: 32, color: C.ink, writingDirection: 'ltr' }} testID="wordmark">
            Bill<Text style={{ color: C.greenDeep }}>Kul</Text>
          </Text>
        </View>

        <View style={{ gap: 6 }}>
          <T size={26} w="semibold" head accessibilityRole="header">
            {t('setupTitle')}
          </T>
          <T size={15} color={C.muted}>
            {t('setupSub')}
          </T>
        </View>

        <View style={{ gap: 8 }}>
          <T size={13} w="semibold" color={C.muted}>
            {t('language')}
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['en', 'ur'] as Lang[]).map((code) => {
              const on = settings.language === code;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setLanguage(code)}
                  testID={`lang-${code}`}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 12,
                    borderWidth: on ? 2 : 1.5,
                    borderColor: on ? C.ink : C.border,
                    backgroundColor: on ? C.ink : C.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {code === 'en' ? (
                    <T size={15} w="semibold" latin color={on ? C.onInk : C.ink} center>
                      English
                    </T>
                  ) : (
                    <T size={16} w="semibold" color={on ? C.onInk : C.ink} center>
                      اردو
                    </T>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <T size={13} w="semibold" color={C.muted}>
            {t('businessType')}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TYPES.map((item) => {
              const on = type === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setType(item.value)}
                  testID={`type-${item.value}`}
                  style={{
                    flexBasis: rtl ? '47%' : '31%',
                    flexGrow: 1,
                    minHeight: rtl ? 52 : 46,
                    paddingHorizontal: 6,
                    borderRadius: 12,
                    borderWidth: on ? 2 : 1.5,
                    borderColor: on ? C.greenDeep : C.border,
                    backgroundColor: on ? C.tintGreen : C.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <T size={13} w={on ? 'semibold' : 'medium'} color={on ? C.greenDark : C.ink} center numberOfLines={2}>
                    {t(item.label)}
                  </T>
                </Pressable>
              );
            })}
          </View>
          <T size={13} color={C.muted}>
            {t('businessTypeHint')}
          </T>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(logo ? 'changeLogo' : 'addLogo')}
            onPress={addLogo}
            testID="setup-logo"
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              borderWidth: logo ? 0 : 1.5,
              borderStyle: 'dashed',
              borderColor: C.borderStrong,
              backgroundColor: C.bg,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {logo ? <Image source={{ uri: logo }} style={{ width: 52, height: 52 }} /> : <Icon name="image" color={C.muted} />}
          </Pressable>
          <Field label={t('shopName')} value={shopName} onChangeText={setShopName} placeholder={t('shopNamePh')} style={{ flex: 1 }} testID="setup-shop" autoCapitalize="words" />
        </View>

        <Field label={t('phoneLabel')} value={phone} onChangeText={setPhone} placeholder={t('phonePh')} keyboardType="phone-pad" latin testID="setup-phone" />

        <View style={{ marginTop: 'auto', gap: 4, paddingTop: 8 }}>
          <Button label={t('start')} size="lg" head onPress={() => finish(false)} testID="setup-start" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable accessibilityRole="button" onPress={() => finish(true)} testID="setup-skip" style={{ minHeight: 44, justifyContent: 'center' }}>
              <T size={15} w="semibold" color={C.muted}>
                {t('skip')}
              </T>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={restore} testID="setup-restore" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="cloudUp" size={20} color={C.greenText} />
              <T size={15} w="semibold" color={C.greenText}>
                {t('restoreMyData')}
              </T>
            </Pressable>
          </View>
          {driveReady ? (
            <Pressable accessibilityRole="button" onPress={() => void driveRestore()} testID="setup-drive-restore" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
              <Icon name="download" size={20} color={C.greenText} />
              <T size={15} w="semibold" color={C.greenText}>
                {t('driveRestore')}
              </T>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
