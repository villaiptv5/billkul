import { useState } from 'react';
import { addDays, formatDate, formatDay, formatMonth, isoDate, monthKey } from '../logic/dates';
import { shiftMonth } from '../logic/ledger';
import { useLocale } from '../ui/locale';

export type PeriodMode = 'day' | 'month';

/** A day or a month the reader can step through, shared by the reports. */
export function usePeriod(initial: PeriodMode = 'month') {
  const { lang } = useLocale();
  const today = isoDate();
  const [mode, setMode] = useState<PeriodMode>(initial);
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(monthKey(today));
  const monthName = formatMonth(`${month}-01`, lang);

  return {
    mode,
    setMode,
    /** "2026-10-06" or "2026-10": what a date must start with to be in the period. */
    prefix: mode === 'day' ? day : month,
    /** "Today", "5 Oct" or "October 2026", for the stepper. */
    label: mode === 'day' ? formatDay(day, lang) : monthName,
    /** "6 Oct 2026" or "October 2026", for print and for sentences. */
    name: mode === 'day' ? formatDate(day, lang) : monthName,
    canNext: mode === 'day' ? day < today : month < monthKey(today),
    previous: () => (mode === 'day' ? setDay(addDays(day, -1)) : setMonth(shiftMonth(month, -1))),
    next: () => (mode === 'day' ? setDay(addDays(day, 1)) : setMonth(shiftMonth(month, 1))),
    /** Opens one day. */
    openDay: (date: string) => {
      setDay(date);
      setMode('day');
    },
  };
}

export type Period = ReturnType<typeof usePeriod>;
