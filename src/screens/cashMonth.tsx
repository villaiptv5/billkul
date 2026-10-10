import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useAppState } from '../data/app';
import type { CashKind } from '../data/types';
import type { CashRow } from '../logic/ledger';
import { money } from '../logic/money';
import { C } from '../theme';
import { Sheet, SheetScroll } from '../ui/kit';
import { useLocale } from '../ui/locale';
import { T } from '../ui/T';
import { useCashBook } from './books';
import { CashLine } from './CashScreen';
import { usePeriod } from './period';
import { PeriodStepper } from './PeriodStepper';

/** The trail behind "In this month" or "Out this month": every cash book line on that side, with the total. */
export function CashMonthSheet({ kind, onClose, onOpen }: { kind: CashKind | null; onClose: () => void; onOpen: (row: CashRow) => void }) {
  const { t } = useLocale();
  const { settings } = useAppState();
  const book = useCashBook();
  const period = usePeriod('month');
  const side = kind ?? 'in';
  const rows = useMemo(() => book.rows.filter((r) => r.kind === side && r.date.startsWith(period.prefix)), [book.rows, side, period.prefix]);
  const days = useMemo(() => new Set(book.rows.filter((r) => r.kind === side).map((r) => r.date)), [book.rows, side]);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const coming = side === 'in';

  return (
    <Sheet visible={kind !== null} onClose={onClose} title={t(coming ? 'inTitle' : 'outTitle')} full>
      <SheetScroll>
        <PeriodStepper period={period} marked={days} testID="cashmonth-period" />
        <T size={13.5} color={C.muted}>
          {t(coming ? 'inSub' : 'outSub')}
        </T>
        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, overflow: 'hidden' }}>
          {rows.length === 0 ? (
            <View style={{ padding: 18 }}>
              <T size={14} color={C.muted} center>
                {t(coming ? 'nothingIn' : 'nothingOut', { period: period.name })}
              </T>
            </View>
          ) : (
            rows.map((row) => <CashLine key={row.key} row={row} onPress={() => onOpen(row)} />)
          )}
          <View style={{ minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgDeep }}>
            <View style={{ flex: 1 }}>
              <T size={15} w="semibold">
                {`${t(coming ? 'totalIn' : 'totalOut')} · ${period.name}`}
              </T>
            </View>
            <T size={17} w="bold" head latin color={coming ? C.greenText : C.orange} testID="cashmonth-total">
              {money(total, settings.currency)}
            </T>
          </View>
        </View>
      </SheetScroll>
    </Sheet>
  );
}
