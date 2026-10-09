import React from 'react';
import { Pressable, View } from 'react-native';
import { useAppState } from '../data/app';
import type { Doc } from '../data/types';
import { formatDay } from '../logic/dates';
import { money } from '../logic/money';
import { docTotals } from '../logic/totals';
import type { RootNav } from '../nav';
import { C } from '../theme';
import { StatusPill } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';

/**
 * Moves between a document's editor and its preview without piling up screens:
 * if the wanted screen is the one just behind this one, go back to it.
 */
export function showDoc(nav: RootNav, screen: 'Editor' | 'Preview', docId: string) {
  const { routes, index } = nav.getState();
  const previous = routes[index - 1];
  const params = previous?.params as { docId?: string } | undefined;
  if (previous?.name === screen && params?.docId === docId) nav.goBack();
  else nav.navigate(screen, { docId });
}

/** Drafts open for editing; finished documents open in the preview. */
export function openDoc(nav: RootNav, doc: Doc) {
  nav.navigate(doc.status === 'draft' ? 'Editor' : 'Preview', { docId: doc.id });
}

/** Customer, number and date on one side; amount and status on the other. */
export function DocSummary({ doc }: { doc: Doc }) {
  const { t, lang } = useLocale();
  const currency = useAppState().settings.currency;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={15} w="semibold" numberOfLines={1}>
          {doc.customerName || t('noCustomer')}
        </T>
        <View style={{ flexDirection: 'row', gap: 5 }}>
          <T size={13} color={C.muted} latin>
            {doc.number}
          </T>
          <T size={13} color={C.muted}>
            · {formatDay(doc.date, lang)}
          </T>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <T size={15} w="semibold" latin>
          {money(docTotals(doc).total, currency)}
        </T>
        <StatusPill status={doc.status} held={!!doc.heldAt} />
      </View>
    </View>
  );
}

export function DocRow({ doc, onPress, last }: { doc: Doc; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={`doc-${doc.number}`}
      style={({ pressed }) => ({
        minHeight: 62,
        paddingHorizontal: 14,
        paddingVertical: 9,
        justifyContent: 'center',
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.lineSoft,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <DocSummary doc={doc} />
    </Pressable>
  );
}
