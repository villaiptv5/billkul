import React, { useState } from 'react';
import { CalendarSheet } from '../ui/Calendar';
import { useLocale } from '../ui/locale';
import { Stepper } from './books';
import type { Period } from './period';

/** Steps a report back and forth a day or a month; the date itself opens a calendar to jump to any day or month. */
export function PeriodStepper({ period, marked, testID }: { period: Period; marked?: Set<string>; testID: string }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const day = period.mode === 'day';
  return (
    <>
      <Stepper
        label={period.label}
        onPrev={period.previous}
        onNext={period.next}
        canNext={period.canNext}
        prevLabel={t(day ? 'previousDay' : 'previousMonth')}
        nextLabel={t(day ? 'nextDay' : 'nextMonth')}
        onPick={() => setOpen(true)}
        pickLabel={t('pickDate')}
        testID={testID}
      />
      <CalendarSheet
        visible={open}
        onClose={() => setOpen(false)}
        value={period.value}
        marked={marked}
        onPickDay={(date) => {
          setOpen(false);
          period.pickDay(date);
        }}
        onPickMonth={(month) => {
          setOpen(false);
          period.pickMonth(month);
        }}
      />
    </>
  );
}
