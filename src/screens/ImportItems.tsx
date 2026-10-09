import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { store } from '../data/app';
import { itemsFromSheet, itemTemplate } from '../logic/itemImport';
import { readSheet } from '../logic/sheet';
import { pickSheetFile, saveSheetFile } from '../platform/files';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Sheet, SheetScroll, useDialogs } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';

/** Brings items in from an Excel or CSV sheet, with a template to fill in. */
export function ImportItemsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const { notify } = useDialogs();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (visible) setResult(null);
  }, [visible]);

  const template = async () => {
    try {
      await saveSheetFile('BillKul items template.xlsx', itemTemplate());
    } catch {
      notify(t('shareFailed'));
    }
  };

  const choose = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const bytes = await pickSheetFile();
      if (!bytes) return;
      let table: string[][];
      try {
        table = readSheet(bytes);
      } catch {
        return setResult({ text: t('importBadFile'), ok: false });
      }
      const sheet = itemsFromSheet(table);
      if (!sheet.rows.length) return setResult({ text: t('importNothing'), ok: false });
      const done = store.importItems(sheet.rows);
      const skipped = sheet.noName.length ? `\n${t('importNoName', { rows: sheet.noName.slice(0, 12).join(', ') + (sheet.noName.length > 12 ? '…' : '') })}` : '';
      setResult({ text: t('importDone', { added: done.added, updated: done.updated }) + skipped, ok: true });
    } catch {
      setResult({ text: t('importBadFile'), ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('importTitle')}>
      <SheetScroll>
        <View style={{ gap: 8 }}>
          {(['importStep1', 'importStep2', 'importStep3'] as const).map((key) => (
            <T key={key} size={14.5} color={C.ink}>
              {t(key)}
            </T>
          ))}
        </View>
        <Button label={t('downloadTemplate')} icon="download" variant="secondary" onPress={() => void template()} testID="import-template" />
        <Button label={t('chooseSheet')} icon="upload" size="lg" head disabled={busy} onPress={() => void choose()} testID="import-choose" />
        {result ? (
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: result.ok ? C.tintGreen : '#FDECEC' }}>
            <T size={14.5} w="semibold" color={result.ok ? C.greenDark : C.danger} testID="import-result">
              {result.text}
            </T>
          </View>
        ) : null}
      </SheetScroll>
    </Sheet>
  );
}
