import React, { useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { PRIVACY_URL } from '../config';
import { store, useAppState } from '../data/app';
import type { Lang } from '../data/types';
import { CURRENCIES, formatAmount } from '../logic/money';
import { formatDocNumber } from '../logic/totals';
import { pickLogo } from '../platform/logo';
import { TaxSheet } from '../screens/EditorScreen';
import { useBackupActions } from '../screens/backupActions';
import { APP_VERSION, NumbersSheet, Option, Row } from '../screens/SettingsScreen';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Field } from '../ui/Input';
import { Divider, Sheet, SheetScroll } from '../ui/kit';
import { useDeskSize } from '../ui/layout';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { PageHeader, Panel } from './parts';
import { AccountCard } from '../screens/limits';

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <T size={17} w="semibold" head accessibilityRole="header">
        {title}
      </T>
      {hint ? (
        <T size={13.5} color={C.muted}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function SettingsPage() {
  const { t } = useLocale();
  const { settings } = useAppState();
  const backup = useBackupActions();
  const { snug } = useDeskSize();
  const [sheet, setSheet] = useState<'language' | 'currency' | 'tax' | 'numbers' | null>(null);

  const changeLogo = async () => {
    try {
      const picked = await pickLogo();
      if (picked) store.updateSettings({ logo: picked });
    } catch {
      // Leave the logo as it was.
    }
  };

  const taxValue = settings.taxPercent > 0 ? `${settings.taxLabel.trim() || t('tax')} ${formatAmount(settings.taxPercent)}%` : t('taxNotAdded');

  return (
    <View style={{ gap: 20 }}>
      <PageHeader title={t('tabSettings')} />

      <View style={{ maxWidth: 520 }}>
        <AccountCard />
      </View>

      <View style={snug ? { gap: 20 } : { flexDirection: 'row', alignItems: 'flex-start', gap: 24 }}>
        {/* Shop profile: saved as it is typed, like the rest of the app. */}
        <Panel style={[{ padding: 20, gap: 16, minWidth: 0 }, snug ? null : { flex: 1.2 }]}>
          <SectionTitle title={t('shopProfile')} hint={t('shopProfileOnDocs')} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(settings.logo ? 'changeLogo' : 'addLogo')}
              onPress={changeLogo}
              testID="profile-logo"
              style={{ width: 72, height: 72, borderRadius: 16, borderWidth: settings.logo ? 0 : 1.5, borderStyle: 'dashed', borderColor: C.borderStrong, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            >
              {settings.logo ? <Image source={{ uri: settings.logo }} style={{ width: 72, height: 72 }} /> : <Icon name="image" size={26} color={C.muted} />}
            </Pressable>
            <Button label={t(settings.logo ? 'changeLogo' : 'addLogo')} variant="secondary" size="sm" onPress={changeLogo} />
            {settings.logo ? <Button label={t('removeLogo')} variant="ghost" size="sm" onPress={() => store.updateSettings({ logo: '' })} testID="remove-logo" style={{ paddingHorizontal: 8 }} /> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <Field label={t('shopName')} value={settings.shopName} onChangeText={(shopName) => store.updateSettings({ shopName })} placeholder={t('shopNamePh')} autoCapitalize="words" style={{ flex: 1.3 }} testID="profile-shop" />
            <Field label={t('phoneLabel')} value={settings.phone} onChangeText={(phone) => store.updateSettings({ phone })} placeholder={t('phonePh')} keyboardType="phone-pad" latin style={{ flex: 1 }} testID="profile-phone" />
          </View>
          <Field label={`${t('address')} (${t('optional')})`} value={settings.address} onChangeText={(address) => store.updateSettings({ address })} multiline testID="profile-address" />
          <Field label={`${t('footerNote')} (${t('optional')})`} value={settings.footerNote} onChangeText={(footerNote) => store.updateSettings({ footerNote })} placeholder={t('defaultFooter')} testID="profile-footer" />
        </Panel>

        <View style={[{ gap: 20, minWidth: 0 }, snug ? null : { flex: 1 }]}>
          <View style={{ gap: 10 }}>
            <SectionTitle title={t('preferences')} />
            <Panel>
              <Row label={t('language')} value={settings.language === 'ur' ? 'اردو' : 'English'} latinValue={settings.language === 'en'} onPress={() => setSheet('language')} testID="row-language" />
              <Divider />
              <Row label={t('currency')} value={`${settings.currency.code} (${settings.currency.symbol})`} latinValue onPress={() => setSheet('currency')} testID="row-currency" />
              <Divider />
              <Row label={t('tax')} value={taxValue} onPress={() => setSheet('tax')} testID="row-tax" />
              <Divider />
              <Row
                label={t('docNumbers')}
                value={`${formatDocNumber(settings.quotePrefix, settings.nextQuote)} · ${formatDocNumber(settings.invoicePrefix, settings.nextInvoice)}`}
                latinValue
                onPress={() => setSheet('numbers')}
                testID="row-numbers"
              />
            </Panel>
          </View>

          <View style={{ backgroundColor: C.ink, borderRadius: 16, padding: 20, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.inkPanel, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={backup.backedUp ? 'cloudCheck' : 'cloudOff'} size={24} color={backup.backedUp ? C.green : C.orangeOnInk} stroke={2} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T size={16} w="semibold" head color={C.onInk} accessibilityRole="header">
                  {t('backup')}
                </T>
                <T size={13} color={C.onInkMuted} testID="backup-status">
                  {backup.status}
                </T>
              </View>
            </View>
            <T size={13.5} color={C.onInkSoft}>
              {t('backupExplainPc')}
            </T>
            <View style={{ gap: 8 }}>
              <Button label={t('saveBackup')} icon="download" variant="onInk" onPress={backup.saveBackup} testID="save-backup" />
              <Button label={t('restoreBackup')} icon="upload" variant="onInkOutline" onPress={backup.restore} testID="restore-backup" />
            </View>
          </View>

          <Panel>
            <Row label={t('privacyPolicy')} onPress={() => void Linking.openURL(PRIVACY_URL)} testID="row-privacy" />
            <Divider />
            <Row label={t('version')} value={APP_VERSION} latinValue />
          </Panel>
        </View>
      </View>

      <Sheet visible={sheet === 'language'} onClose={() => setSheet(null)} title={t('language')}>
        <SheetScroll>
          {(['en', 'ur'] as Lang[]).map((code) => (
            <Option key={code} label={code === 'en' ? 'English' : 'اردو'} latin={code === 'en'} selected={settings.language === code} onPress={() => { store.updateSettings({ language: code }); setSheet(null); }} testID={`set-lang-${code}`} />
          ))}
        </SheetScroll>
      </Sheet>

      <Sheet visible={sheet === 'currency'} onClose={() => setSheet(null)} title={t('currency')}>
        <SheetScroll>
          {CURRENCIES.map((c) => (
            <Option key={c.code} label={`${c.code}  ·  ${c.symbol}`} latin selected={settings.currency.code === c.code} onPress={() => { store.updateSettings({ currency: c }); setSheet(null); }} testID={`set-currency-${c.code}`} />
          ))}
        </SheetScroll>
      </Sheet>

      <TaxSheet visible={sheet === 'tax'} onClose={() => setSheet(null)} percent={settings.taxPercent} onSave={(taxPercent) => store.updateSettings({ taxPercent })} />
      <NumbersSheet visible={sheet === 'numbers'} onClose={() => setSheet(null)} />
    </View>
  );
}
