import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { store, useAppState } from '../data/app';
import type { Customer, Doc } from '../data/types';
import { formatTime } from '../logic/dates';
import { money } from '../logic/money';
import { docTotals } from '../logic/totals';
import { C } from '../theme';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Field } from '../ui/Input';
import { Sheet, SheetScroll } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { CustomerPicker } from './CustomerPicker';

function Choice({ title, sub, icon, onPress, testID, strong }: { title: string; sub: string; icon: 'moneyIn' | 'file'; onPress: () => void; testID: string; strong?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({ minHeight: 76, borderRadius: 16, borderWidth: strong ? 0 : 1.5, borderColor: C.border, backgroundColor: strong ? C.green : C.surface, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: pressed ? 0.75 : 1 })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: strong ? 'rgba(11,31,23,0.12)' : C.bgDeep, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={C.ink} stroke={2.1} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={16.5} w="semibold" head>
          {title}
        </T>
        <T size={13.5} color={strong ? C.ink : C.muted}>
          {sub}
        </T>
      </View>
    </Pressable>
  );
}

/**
 * Completing an invoice: paid now puts the money in the cash in hand; not paid yet puts it in the Due list,
 * which needs to know the customer. `onDone` runs once the invoice is complete.
 */
export function CompleteSheet({ doc, visible, onClose, onDone }: { doc: Doc; visible: boolean; onClose: () => void; onDone: () => void }) {
  const { t } = useLocale();
  const currency = useAppState().settings.currency;
  const [picking, setPicking] = useState(false);
  const total = money(docTotals(doc).total, currency);

  const finish = (paid: boolean) => {
    store.completeDoc(doc.id, paid);
    onDone();
    onClose();
  };

  const unpaid = () => {
    if (!doc.customerId) return setPicking(true);
    finish(false);
  };

  const picked = (c: Customer) => {
    store.patchDoc(doc.id, { customerId: c.id, customerName: c.name, customerPhone: c.phone });
    setPicking(false);
    finish(false);
  };

  return (
    <>
      <Sheet visible={visible && !picking} onClose={onClose} title={t('completeTitle')}>
        <SheetScroll>
          <View style={{ alignItems: 'center', gap: 2, paddingVertical: 4 }}>
            <T size={13} color={C.muted}>
              {`${doc.number}${doc.customerName ? ` · ${doc.customerName}` : ''}`}
            </T>
            <T size={28} w="bold" head latin testID="complete-total">
              {total}
            </T>
          </View>
          <Choice title={t('paidNow')} sub={t('paidNowSub', { amount: total })} icon="moneyIn" onPress={() => finish(true)} testID="complete-paid" strong />
          <Choice title={t('notPaidYet')} sub={doc.customerId ? t('notPaidYetSub') : `${t('notPaidYetSub')} ${t('dueNeedsCustomer')}`} icon="file" onPress={unpaid} testID="complete-due" />
        </SheetScroll>
      </Sheet>
      <CustomerPicker visible={visible && picking} onClose={() => setPicking(false)} onPick={picked} />
    </>
  );
}

/** Puts an unfinished invoice aside to serve the next customer; it waits under On hold. */
export function HoldSheet({ doc, visible, onClose, onHeld }: { doc: Doc; visible: boolean; onClose: () => void; onHeld: (startNew: boolean) => void }) {
  const { t } = useLocale();
  const [name, setName] = useState('');
  useEffect(() => {
    if (visible) setName('');
  }, [visible]);

  const hold = (startNew: boolean) => {
    store.holdDoc(doc.id, name);
    onClose();
    onHeld(startNew);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('holdTitle')}>
      <SheetScroll>
        <T size={14.5} color={C.muted}>
          {t('holdSub')}
        </T>
        {doc.customerId ? null : <Field label={t('holdName')} value={name} onChangeText={setName} placeholder={t('holdNamePh')} maxLength={40} testID="hold-name" />}
        <Button label={t('holdAndNew')} icon="plus" size="lg" head onPress={() => hold(true)} testID="hold-new" />
        <Button label={t('holdOnly')} variant="secondary" onPress={() => hold(false)} testID="hold-only" />
      </SheetScroll>
    </Sheet>
  );
}

/** Unfinished documents put on hold, newest first. */
export function heldDocs(docs: Doc[]): Doc[] {
  return docs.filter((d) => d.status === 'draft' && d.heldAt).sort((a, b) => (b.heldAt ?? '').localeCompare(a.heldAt ?? ''));
}

/** The invoices waiting on hold, on the Dashboard: tap one to carry on where it was left. */
export function HeldList({ onOpen, wide }: { onOpen: (doc: Doc) => void; wide?: boolean }) {
  const { t, lang } = useLocale();
  const { docs, settings } = useAppState();
  const held = heldDocs(docs);
  if (!held.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <T size={wide ? 17 : 15} w="semibold" head accessibilityRole="header">
        {`${t('onHold')} (${held.length})`}
      </T>
      <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: '#F2D27A', backgroundColor: '#FFFBEA', overflow: 'hidden' }}>
        {held.map((doc, i) => (
          <Pressable
            key={doc.id}
            accessibilityRole="button"
            onPress={() => onOpen(doc)}
            testID={`held-${doc.number}`}
            style={({ pressed }) => ({ minHeight: 60, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: i === held.length - 1 ? 0 : 1, borderBottomColor: '#F2E3B0', opacity: pressed ? 0.6 : 1 })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <T size={15} w="semibold" numberOfLines={1}>
                {doc.customerName || t('noCustomer')}
              </T>
              <T size={13} color={C.muted} numberOfLines={1}>
                {`${doc.number} · ${t('heldAt', { time: formatTime(doc.heldAt ?? '', lang) })}`}
              </T>
            </View>
            <T size={15} w="semibold" latin>
              {money(docTotals(doc).total, settings.currency)}
            </T>
            <Icon name="chevron" size={18} color={C.muted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
