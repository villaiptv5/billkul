import React, { useMemo } from 'react';
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
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Card, Empty } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { DocRow, openDoc } from './shared';

function Stat({ label, value, symbol, color = C.onInk }: { label: string; value: number; symbol: string; color?: string }) {
  const { rtl } = useLocale();
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: C.inkPanel, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 4 }}>
      <T size={13} color={C.onInkMuted}>
        {label}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, direction: 'ltr', justifyContent: rtl ? 'flex-end' : 'flex-start' }}>
        <T size={12} w="medium" latin color={C.onInkMuted}>
          {symbol}
        </T>
        <T size={18} w="semibold" head latin color={color} numberOfLines={1}>
          {formatAmount(value)}
        </T>
      </View>
    </View>
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

  const create = (type: DocType) => {
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
              <T size={18} w="semibold" head color={C.onInk} numberOfLines={1} accessibilityRole="header">
                {settings.shopName || t('myShop')}
              </T>
              <Pressable accessibilityRole="button" onPress={() => nav.navigate('Tabs', { screen: 'Settings' })} testID="home-backup" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 }}>
                <Icon name={settings.lastBackupAt ? 'cloudCheck' : 'cloudOff'} size={16} color={settings.lastBackupAt ? C.mint : C.orangeOnInk} stroke={2} />
                <T size={13} color={settings.lastBackupAt ? C.mint : C.orangeOnInk}>
                  {backupText}
                </T>
              </Pressable>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <T size={14} w="semibold" color={C.onInkSoft}>
              {t('thisMonth')}
            </T>
            <T size={13} color="#A9BDB3">
              {formatMonth(today, lang)}
            </T>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Stat label={t('quoted')} value={stats.quoted} symbol={settings.currency.symbol} />
            <Stat label={t('invoiced')} value={stats.invoiced} symbol={settings.currency.symbol} />
            <Stat label={t('received')} value={stats.received} symbol={settings.currency.symbol} color={C.green} />
            <Stat label={t('due')} value={stats.due} symbol={settings.currency.symbol} color={C.orangeOnInk} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 14 }}>
          <View style={{ gap: 8 }}>
            <Button label={t('newQuote')} icon="plus" size="lg" head onPress={() => create('quote')} testID="new-quote" style={{ minHeight: 60, borderRadius: 16 }} />
            <Button label={t('newInvoice')} variant="secondary" onPress={() => create('invoice')} testID="new-invoice" style={{ borderRadius: 14 }} />
          </View>

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
    </View>
  );
}
