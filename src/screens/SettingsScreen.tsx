import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PRIVACY_URL } from '../config';
import { store, useAppState } from '../data/app';
import type { Lang } from '../data/types';
import { CURRENCIES, formatAmount } from '../logic/money';
import { formatDocNumber } from '../logic/totals';
import type { RootNav } from '../nav';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Field, NumberField } from '../ui/Input';
import { Card, Divider, Screen, Sheet, SheetScroll, TopBar } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { useBackupActions } from './backupActions';
import { TaxSheet } from './EditorScreen';
import { AccountCard } from './limits';
import { DriveSection } from './drive';

export const APP_VERSION: string = require('../../app.json').expo.version;

export function Row({ label, value, onPress, latinValue, testID }: { label: string; value?: string; onPress?: () => void; latinValue?: boolean; testID?: string }) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress} testID={testID} style={({ pressed }) => ({ minHeight: 52, paddingStart: 14, paddingEnd: 8, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flex: 1 }}>
        <T size={15} w="medium">
          {label}
        </T>
      </View>
      {value ? (
        <T size={15} color={C.muted} latin={latinValue} numberOfLines={1}>
          {value}
        </T>
      ) : null}
      {onPress ? <Icon name="chevron" size={20} color={C.muted} stroke={2} /> : <View style={{ width: 6 }} />}
    </Pressable>
  );
}

export function Option({ label, selected, onPress, latin, testID }: { label: string; selected: boolean; onPress: () => void; latin?: boolean; testID?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} testID={testID} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: C.lineSoft }}>
      <View style={{ flex: 1 }}>
        <T size={16} w={selected ? 'semibold' : 'regular'} latin={latin}>
          {label}
        </T>
      </View>
      {selected ? <Icon name="check" color={C.greenText} stroke={2.4} /> : null}
    </Pressable>
  );
}

export function SettingsScreen() {
  const nav = useNavigation<RootNav>();
  const { t } = useLocale();
  const { settings } = useAppState();
  const [sheet, setSheet] = useState<'language' | 'currency' | 'tax' | 'numbers' | null>(null);

  const backup = useBackupActions();

  const taxValue = settings.taxPercent > 0 ? `${settings.taxLabel.trim() || t('tax')} ${formatAmount(settings.taxPercent)}%` : t('taxNotAdded');

  return (
    <Screen>
      <TopBar title={t('tabSettings')} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 14, gap: 12 }}>
        <AccountCard />
        <Pressable accessibilityRole="button" onPress={() => nav.navigate('ShopProfile')} testID="open-profile">
          <Card style={{ minHeight: 68, paddingStart: 14, paddingEnd: 8, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={settings.logo ? { uri: settings.logo } : require('../../assets/icon.png')} style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: C.bg }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T size={16} w="semibold" numberOfLines={1}>
                {settings.shopName || t('shopProfile')}
              </T>
              <T size={13} color={C.muted}>
                {t('shopProfileSub')}
              </T>
            </View>
            <Icon name="chevron" color={C.muted} stroke={2} />
          </Card>
        </Pressable>

        <Card>
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
        </Card>

        <View style={{ backgroundColor: C.ink, borderRadius: 16, padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.inkPanel, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={settings.lastBackupAt ? 'cloudCheck' : 'cloudOff'} size={24} color={settings.lastBackupAt ? C.green : C.orangeOnInk} stroke={2} />
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
            {t('backupExplain')}
          </T>
          <View style={{ gap: 8 }}>
            <Button label={t('saveBackup')} icon="download" variant="onInk" onPress={backup.saveBackup} testID="save-backup" />
            <Button label={t('restoreBackup')} icon="upload" variant="onInkOutline" onPress={backup.restore} testID="restore-backup" />
          </View>
          <DriveSection />
        </View>

        <Card>
          <Row label={t('privacyPolicy')} onPress={() => void Linking.openURL(PRIVACY_URL)} testID="row-privacy" />
          <Divider />
          <Row label={t('version')} value={APP_VERSION} latinValue />
        </Card>
      </ScrollView>

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
    </Screen>
  );
}

export function NumbersSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const settings = useAppState().settings;
  const [quotePrefix, setQuotePrefix] = useState(settings.quotePrefix);
  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoicePrefix);
  const [nextQuote, setNextQuote] = useState(settings.nextQuote);
  const [nextInvoice, setNextInvoice] = useState(settings.nextInvoice);

  useEffect(() => {
    if (visible) {
      setQuotePrefix(settings.quotePrefix);
      setInvoicePrefix(settings.invoicePrefix);
      setNextQuote(settings.nextQuote);
      setNextInvoice(settings.nextInvoice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const save = () => {
    store.updateSettings({
      quotePrefix: quotePrefix.trim(),
      invoicePrefix: invoicePrefix.trim(),
      nextQuote: Math.max(1, Math.floor(nextQuote) || 1),
      nextInvoice: Math.max(1, Math.floor(nextInvoice) || 1),
    });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('docNumbers')}>
      <SheetScroll>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
          <Field label={t('quotePrefix')} value={quotePrefix} onChangeText={setQuotePrefix} latin maxLength={8} autoCapitalize="none" style={{ flex: 1 }} testID="quote-prefix" />
          <View style={{ gap: 6 }}>
            <T size={13} w="semibold" color={C.muted}>
              {t('nextQuoteNumber')}
            </T>
            <NumberField label={t('nextQuoteNumber')} value={nextQuote} onChange={setNextQuote} width={130} height={52} testID="next-quote" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
          <Field label={t('invoicePrefix')} value={invoicePrefix} onChangeText={setInvoicePrefix} latin maxLength={8} autoCapitalize="none" style={{ flex: 1 }} testID="invoice-prefix" />
          <View style={{ gap: 6 }}>
            <T size={13} w="semibold" color={C.muted}>
              {t('nextInvoiceNumber')}
            </T>
            <NumberField label={t('nextInvoiceNumber')} value={nextInvoice} onChange={setNextInvoice} width={130} height={52} testID="next-invoice" />
          </View>
        </View>
        <Button label={t('save')} onPress={save} testID="numbers-save" />
      </SheetScroll>
    </Sheet>
  );
}
