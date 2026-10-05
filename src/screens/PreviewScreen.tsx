import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { store, useAppState } from '../data/app';
import type { TemplateId } from '../data/types';
import { money } from '../logic/money';
import { docTotals } from '../logic/totals';
import type { RootNav, RootParams } from '../nav';
import { buildDocHtml, docFileName, whatsappNumber } from '../pdf/template';
import { IS_PHONE, openWhatsappText, printDoc, shareImage, sharePdf } from '../platform/docActions';
import { DocView } from '../platform/DocView';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Screen, TopBar, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { showDoc } from './shared';

const SHADOW = Platform.select({
  web: { boxShadow: '0 6px 20px rgba(11,31,23,0.14)' },
  default: { elevation: 4, shadowColor: '#0B1F17', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
}) as object;

function TemplateOption({ id, label, selected, onPress }: { id: TemplateId; label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={`template-${id}`}
      style={{
        flex: 1,
        minHeight: 56,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? C.greenDeep : C.border,
        backgroundColor: C.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <View style={{ width: 26, height: 34, borderRadius: 3, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, overflow: 'hidden' }}>
        {id === 'classic' ? <View style={{ height: 10, backgroundColor: C.ink }} /> : <View style={{ marginTop: 9, height: 2, backgroundColor: C.green }} />}
      </View>
      <T size={14} w={selected ? 'semibold' : 'medium'}>
        {label}
      </T>
    </Pressable>
  );
}

export function PreviewScreen() {
  const nav = useNavigation<RootNav>();
  const { docId } = useRoute<RouteProp<RootParams, 'Preview'>>().params;
  const { t, lang } = useLocale();
  const { notify } = useDialogs();
  const { docs, settings } = useAppState();
  const doc = docs.find((d) => d.id === docId);
  const [width, setWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  const pageRef = useRef<View>(null);

  useEffect(() => {
    if (!doc) nav.goBack();
  }, [doc, nav]);

  const html = useMemo(() => (doc ? buildDocHtml({ doc, settings, lang }) : ''), [doc, settings, lang]);
  if (!doc) return null;

  const fileName = docFileName(doc);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.floor(e.nativeEvent.layout.width));

  /** Runs a send or print action, then marks the document as gone to the customer. */
  const run = async (action: () => Promise<boolean | void>) => {
    if (busy) return;
    setBusy(true);
    try {
      const done = await action();
      if (done !== false) store.markSent(doc.id);
    } catch {
      notify(t('shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  const whatsappText = () => {
    const text = t('whatsappMessage', {
      type: t(doc.type),
      number: doc.number,
      shop: settings.shopName || t('myShop'),
      total: money(docTotals(doc).total, settings.currency),
    });
    openWhatsappText(whatsappNumber(doc.customerPhone), text);
    store.markSent(doc.id);
  };

  return (
    <Screen bg={C.bgDeep}>
      <TopBar
        title={t('preview')}
        subtitle={doc.customerName ? `${doc.number} · ${doc.customerName}` : doc.number}
        onBack={() => nav.goBack()}
        right={<Button label={t('edit')} variant="ghost" size="sm" onPress={() => showDoc(nav, 'Editor', docId)} testID="preview-edit" style={{ paddingHorizontal: 12 }} />}
      />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 14, gap: 14 }}>
        <View onLayout={onLayout} style={[{ borderRadius: 6, backgroundColor: C.surface, overflow: 'hidden' }, SHADOW]} testID="doc-preview">
          {width > 0 ? <DocView ref={pageRef} html={html} width={width} /> : <View style={{ height: 420 }} />}
        </View>

        <View style={{ gap: 8 }}>
          <T size={13} w="semibold" color={C.muted}>
            {t('template')}
          </T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TemplateOption id="classic" label={t('tplClassic')} selected={settings.template === 'classic'} onPress={() => store.updateSettings({ template: 'classic' })} />
            <TemplateOption id="simple" label={t('tplSimple')} selected={settings.template === 'simple'} onPress={() => store.updateSettings({ template: 'simple' })} />
          </View>
        </View>

        {IS_PHONE ? (
          <View style={{ gap: 8 }}>
            <Button label={t('sendPdf')} icon="chat" size="lg" head disabled={busy} onPress={() => run(() => sharePdf(html, fileName))} testID="send-pdf" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label={t('sendImage')} icon="image" variant="secondary" disabled={busy} onPress={() => run(() => shareImage(pageRef.current, fileName))} style={{ flex: 1 }} testID="send-image" />
              <Button label={t('print')} icon="printer" variant="secondary" disabled={busy} onPress={() => run(() => printDoc(html))} style={{ flex: 1 }} testID="print" />
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Button label={`${t('print')} / ${t('savePdf')}`} icon="printer" size="lg" head disabled={busy} onPress={() => run(() => printDoc(html))} testID="print" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label={t('sendWhatsappText')} icon="chat" variant="secondary" onPress={whatsappText} style={{ flex: 1 }} testID="send-whatsapp-text" />
            </View>
            <T size={13} color={C.muted}>
              {t('phoneOnlyBody')}
            </T>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
