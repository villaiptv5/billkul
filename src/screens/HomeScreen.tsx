import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { store, useAppState } from '../data/app';
import { sortDocs } from '../data/store';
import type { DocType } from '../data/types';
import { formatDayInline, formatMonth, formatTime, isoDate } from '../logic/dates';
import { formatAmount } from '../logic/money';
import { monthStats } from '../logic/stats';
import type { RootNav } from '../nav';
import { C } from '../theme';
import { Button, IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Card, Empty } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { useCashBook, useStock } from './books';
import { HeldList } from './finish';
import { ReceivedSheet } from './received';
import { useMonthSales } from './sales';
import { DocRow, openDoc } from './shared';
import { PlanNotice, useLimits } from './limits';
import { DriveOffer } from './drive';

function Stat({ label, value, symbol, color = C.onInk, onPress, testID }: { label: string; value: number; symbol: string; color?: string; onPress?: () => void; testID?: string }) {
  const { rtl } = useLocale();
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} testID={testID} style={({ pressed }) => ({ flexBasis: '47%', flexGrow: 1, backgroundColor: C.inkPanel, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 4, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ flex: 1 }}>
          <T size={13} color={C.onInkMuted} numberOfLines={1}>
            {label}
          </T>
        </View>
        {onPress ? <Icon name="chevron" size={15} color={C.onInkMuted} stroke={2} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, direction: 'ltr', justifyContent: rtl ? 'flex-end' : 'flex-start' }}>
        <T size={12} w="medium" latin color={C.onInkMuted}>
          {symbol}
        </T>
        <T size={18} w="semibold" head latin color={color} numberOfLines={1}>
          {formatAmount(value)}
        </T>
      </View>
    </Pressable>
  );
}

export function HomeScreen() {
  const nav = useNavigation<RootNav>();
  const insets = useSafeAreaInsets();
  const { t, lang, rtl } = useLocale();
  const { settings, docs } = useAppState();
  const today = isoDate();
  const focused = useIsFocused();
  const stats = useMemo(() => monthStats(docs, today), [docs, today]);
  const recent = useMemo(() => sortDocs(docs).slice(0, 4), [docs]);
  const book = useCashBook();
  const { low } = useStock();
  const sales = useMonthSales();

  const [showReceived, setShowReceived] = useState(false);
  const limits = useLimits();
  const create = (type: DocType) => {
    if (!limits.allowDoc()) return;
    const doc = store.createDoc(type);
    nav.navigate('Editor', { docId: doc.id });
  };

  const backupDay = settings.lastBackupAt ? isoDate(new Date(settings.lastBackupAt)) : '';
  const backupText = settings.lastBackupAt
    ? t('backedUp', { when: `${formatDayInline(backupDay, lang)}, ${formatTime(settings.lastBackupAt, lang)}` })
    : t('notBackedUp');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, direction: rtl ? 'rtl' : 'ltr' }}>
      {focused ? <StatusBar style="light" /> : null}
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={{ backgroundColor: C.ink, paddingTop: insets.top + 18, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image
              source={settings.logo ? { uri: settings.logo } : require('../../assets/icon.png')}
              style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: C.inkLine, backgroundColor: C.inkPanel }}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <T size={18} w="semibold" head color={C.onInk} numberOfLines={2} accessibilityRole="header" testID="home-shop">
                {settings.shopName || t('myShop')}
              </T>
              <Pressable accessibilityRole="button" onPress={() => nav.navigate('Settings')} testID="home-backup" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 }}>
                <Icon name={settings.lastBackupAt ? 'cloudCheck' : 'cloudOff'} size={16} color={settings.lastBackupAt ? C.mint : C.orangeOnInk} stroke={2} />
                <T size={13} color={settings.lastBackupAt ? C.mint : C.orangeOnInk}>
                  {backupText}
                </T>
              </Pressable>
            </View>
            <IconButton icon="sliders" label={t('tabSettings')} color={C.onInk} onPress={() => nav.navigate('Settings')} testID="open-settings" />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T size={14} w="semibold" color={C.onInkSoft}>
              {t('thisMonth')}
            </T>
            <T size={14} w="medium" color={C.onInkSoft} testID="home-month">
              {formatMonth(today, lang)}
            </T>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Stat label={t('quoted')} value={stats.quoted} symbol={settings.currency.symbol} onPress={() => nav.navigate('Tabs', { screen: 'Documents', params: { type: 'quote' } })} testID="home-quoted" />
            <Stat label={t('invoiced')} value={stats.invoiced} symbol={settings.currency.symbol} onPress={() => nav.navigate('Tabs', { screen: 'Documents', params: { type: 'invoice' } })} testID="home-invoiced" />
            <Stat label={t('received')} value={stats.received} symbol={settings.currency.symbol} color={C.green} onPress={() => setShowReceived(true)} testID="home-received" />
            <Stat label={t('due')} value={stats.due} symbol={settings.currency.symbol} color={C.orangeOnInk} onPress={() => nav.navigate('Due')} testID="home-due" />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label={t('cashInHand')} value={book.inHand} symbol={settings.currency.symbol} color={book.inHand < 0 ? C.orangeOnInk : C.onInk} onPress={() => nav.navigate('Tabs', { screen: 'Cash' })} testID="home-cash" />
            <Stat label={t(sales.profit < 0 ? 'lossOnSales' : 'profitOnSales')} value={Math.round(Math.abs(sales.profit))} symbol={settings.currency.symbol} color={sales.profit < 0 ? C.orangeOnInk : C.green} onPress={() => nav.navigate('Sales')} testID="home-profit" />
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 14 }}>
          <View style={{ gap: 8 }}>
            <Button label={t('newQuote')} icon="plus" size="lg" head onPress={() => create('quote')} testID="new-quote" style={{ minHeight: 60, borderRadius: 16 }} />
            <Button label={t('newInvoice')} variant="secondary" onPress={() => create('invoice')} testID="new-invoice" style={{ borderRadius: 14 }} />
          </View>

          <PlanNotice />
          <DriveOffer />

          {low.length ? (
            <Pressable accessibilityRole="button" onPress={() => nav.navigate('Tabs', { screen: 'Items' })} testID="home-low-stock" style={({ pressed }) => ({ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#F3C9A4', backgroundColor: '#FFF4E8', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}>
              <Icon name="alert" size={20} color={C.orange} />
              <View style={{ flex: 1 }}>
                <T size={14.5} w="semibold" color={C.orange}>
                  {low.length === 1 ? t('lowStockOne') : t('lowStockMany', { n: low.length })}
                </T>
              </View>
              <Icon name="chevron" size={18} color={C.orange} stroke={2} />
            </Pressable>
          ) : null}

          <HeldList onOpen={(doc) => nav.navigate('Editor', { docId: doc.id })} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T size={15} w="semibold" head accessibilityRole="header">
              {t('recentDocuments')}
            </T>
            {recent.length ? (
              <Pressable accessibilityRole="button" onPress={() => nav.navigate('Tabs', { screen: 'Documents' })} testID="see-all" style={{ minHeight: 44, justifyContent: 'center' }}>
                <T size={14} w="semibold" color={C.greenText}>
                  {t('seeAll')}
                </T>
              </Pressable>
            ) : (
              <View style={{ height: 44 }} />
            )}
          </View>

          <Card>
            {recent.length ? (
              recent.map((doc, i) => <DocRow key={doc.id} doc={doc} last={i === recent.length - 1} onPress={() => openDoc(nav, doc)} />)
            ) : (
              <Empty title={t('noDocsTitle')} hint={t('noDocsHint')} />
            )}
          </Card>
        </View>
      </ScrollView>
      <ReceivedSheet
        visible={showReceived}
        onClose={() => setShowReceived(false)}
        onOpen={(doc) => {
          setShowReceived(false);
          nav.navigate('Preview', { docId: doc.id });
        }}
      />
    </View>
  );
}
