import React, { useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { store, useAppState } from '../data/app';
import type { Doc, ReceiptPaper } from '../data/types';
import { buildReceiptHtml, receiptHeightMm, receiptWidthPx, RECEIPT_PAPERS } from '../pdf/receipt';
import { docFileName } from '../pdf/template';
import { IS_PHONE, printDoc, shareImage } from '../platform/docActions';
import { useCapture } from '../platform/capture';
import { DocView } from '../platform/DocView';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Segmented, Sheet, SheetScroll, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';

const SHADOW = Platform.select({
  web: { boxShadow: '0 4px 16px rgba(11,31,23,0.16)' },
  default: { elevation: 3, shadowColor: '#0B1F17', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
}) as object;

/** The receipt as it will come out of a thermal printer, with the roll width and the print button. */
function Receipt({ doc }: { doc: Doc }) {
  const { t, lang } = useLocale();
  const { notify } = useDialogs();
  const { settings } = useAppState();
  const paper = settings.receiptPaper;
  const [busy, setBusy] = useState(false);
  const pageRef = useRef<View>(null);
  const capture = useCapture();
  const html = useMemo(() => buildReceiptHtml({ doc, settings, lang, paper }), [doc, settings, lang, paper]);
  const width = receiptWidthPx(paper);

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

  const print = () => printDoc(html, { widthMm: RECEIPT_PAPERS[paper].widthMm, heightMm: receiptHeightMm(doc, settings, lang, paper) });

  return (
    <SheetScroll>
      <View style={{ gap: 6 }}>
        <T size={13} w="semibold" color={C.muted}>
          {t('receiptPaper')}
        </T>
        <Segmented
          value={paper}
          onChange={(next: ReceiptPaper) => store.updateSettings({ receiptPaper: next })}
          options={[
            { value: 'r80', label: t('paper80'), testID: 'receipt-80' },
            { value: 'r58', label: t('paper58'), testID: 'receipt-58' },
          ]}
        />
      </View>

      <View style={{ alignItems: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: C.bgDeep }}>
        <View style={[{ backgroundColor: '#FFFFFF' }, SHADOW]} testID="receipt-preview">
          <DocView ref={pageRef} html={html} width={width} pageWidth={width} capturing={capture.capturing} />
        </View>
      </View>

      <Button label={t('printReceipt')} icon="printer" size="lg" head disabled={busy} onPress={() => run(print)} testID="receipt-print" />
      {IS_PHONE ? <Button label={t('sendReceiptImage')} icon="image" variant="secondary" disabled={busy} onPress={() => run(() => capture.shoot(() => shareImage(pageRef.current, `${docFileName(doc)} receipt`)))} testID="receipt-image" /> : null}
      <T size={13} color={C.muted}>
        {t('receiptHint')}
      </T>
    </SheetScroll>
  );
}

/** Opens over a quote or invoice: its thermal (POS) receipt, ready to print. */
export function ReceiptSheet({ doc, visible, onClose }: { doc: Doc; visible: boolean; onClose: () => void }) {
  const { t } = useLocale();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('thermalReceipt')} full>
      {visible ? <Receipt doc={doc} /> : null}
    </Sheet>
  );
}
