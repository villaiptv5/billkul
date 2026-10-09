import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useAppState } from '../data/app';
import type { Doc } from '../data/types';
import { formatDate } from '../logic/dates';
import { money } from '../logic/money';
import { receivedIn } from '../logic/stats';
import { docTotals } from '../logic/totals';
import { C } from '../theme';
import { Icon } from '../ui/Icon';
import { Sheet, SheetScroll } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { usePeriod } from './period';
import { PeriodStepper } from './PeriodStepper';

/** The trail behind the Received figure: each paid invoice, the day it was paid, and the total. */
export function ReceivedSheet({ visible, onClose, onOpen }: { visible: boolean; onClose: () => void; onOpen: (doc: Doc) => void }) {
  const { t, lang } = useLocale();
  const { docs, settings } = useAppState();
  const period = usePeriod('month');
  const list = useMemo(() => receivedIn(docs, period.prefix), [docs, period.prefix]);
  const paidDays = useMemo(() => new Set(docs.filter((d) => d.type === 'invoice' && d.status === 'paid').map((d) => d.paidOn || d.date)), [docs]);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('receivedTitle')} full>
      <SheetScroll>
        <PeriodStepper period={period} marked={paidDays} testID="received-period" />
        <T size={13.5} color={C.muted}>
          {t('receivedSub')}
        </T>
        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, overflow: 'hidden' }}>
          {list.docs.length === 0 ? (
            <View style={{ padding: 18 }}>
              <T size={14} color={C.muted} center>
                {t('nothingReceived', { period: period.name })}
              </T>
            </View>
          ) : (
            list.docs.map((doc) => (
              <Pressable
                key={doc.id}
                accessibilityRole="button"
                onPress={() => onOpen(doc)}
                testID={`received-${doc.number}`}
                style={({ pressed }) => ({ minHeight: 60, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.lineSoft, opacity: pressed ? 0.6 : 1 })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={15} w="semibold" numberOfLines={1}>
                    {`${doc.number} · ${doc.customerName || t('noCustomer')}`}
                  </T>
                  <T size={13} color={C.muted}>
                    {t('paidOn', { date: formatDate(doc.paidOn || doc.date, lang) })}
                  </T>
                </View>
                <T size={15} w="semibold" latin color={C.greenText}>
                  {money(docTotals(doc).total, settings.currency)}
                </T>
                <Icon name="chevron" size={17} color={C.muted} />
              </Pressable>
            ))
          )}
          <View style={{ minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgDeep }}>
            <View style={{ flex: 1 }}>
              <T size={15} w="semibold">
                {`${t('totalReceived')} · ${period.name}`}
              </T>
            </View>
            <T size={17} w="bold" head latin color={C.greenText} testID="received-total">
              {money(list.total, settings.currency)}
            </T>
          </View>
        </View>
      </SheetScroll>
    </Sheet>
  );
}
