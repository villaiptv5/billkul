import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatMonth, isoDate, monthGrid, monthKey, shortMonthName } from '../logic/dates';
import { shiftMonth } from '../logic/ledger';
import { C } from '../theme';
import { Button, IconButton } from './Button';
import { Icon } from './Icon';
import { Sheet, SheetScroll } from './kit';
import { useLocale } from './locale';
import { T } from './T';

const WEEK_EN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const WEEK_UR = ['پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ', 'اتوار'];

interface CalendarProps {
  visible: boolean;
  onClose: () => void;
  /** The day ("2026-10-05") or month ("2026-10") now shown by the report. */
  value: string;
  /** Days with something on them get a dot. */
  marked?: Set<string>;
  onPickDay: (day: string) => void;
  onPickMonth: (month: string) => void;
}

/**
 * A calendar for a report: any day of any month, or a whole month. Days after today cannot be picked.
 * Tapping the month's name shows the twelve months of a year, to get far back quickly.
 */
export function CalendarSheet({ visible, onClose, value, marked, onPickDay, onPickMonth }: CalendarProps) {
  const { t, lang } = useLocale();
  const today = isoDate();
  const thisMonth = monthKey(today);
  const [shown, setShown] = useState(monthKey(value));
  const [view, setView] = useState<'days' | 'months'>('days');
  const [year, setYear] = useState(Number(value.slice(0, 4)));

  useEffect(() => {
    if (!visible) return;
    setShown(monthKey(value));
    setYear(Number(value.slice(0, 4)));
    setView('days');
  }, [visible, value]);

  const thisYear = Number(today.slice(0, 4));
  const header = (label: string, onLabel: (() => void) | undefined, prev: () => void, next: () => void, canNext: boolean, prevLabel: string, nextLabel: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <IconButton icon="back" label={prevLabel} size={44} onPress={prev} testID="cal-prev" />
      <Pressable accessibilityRole="button" onPress={onLabel} disabled={!onLabel} testID="cal-title" style={{ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <T size={16} w="semibold" center>
          {label}
        </T>
        {onLabel ? (
          <View style={{ transform: [{ rotate: '90deg' }] }}>
            <Icon name="chevron" size={16} color={C.muted} />
          </View>
        ) : null}
      </Pressable>
      <View style={{ opacity: canNext ? 1 : 0.3 }}>
        <IconButton icon="chevron" label={nextLabel} size={44} onPress={canNext ? next : undefined} testID="cal-next" />
      </View>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={t('pickDate')}>
      <SheetScroll>
        {view === 'days' ? (
          <>
            {header(formatMonth(`${shown}-01`, lang), () => {
              setYear(Number(shown.slice(0, 4)));
              setView('months');
            }, () => setShown(shiftMonth(shown, -1)), () => setShown(shiftMonth(shown, 1)), shown < thisMonth, t('previousMonth'), t('nextMonth'))}
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row' }}>
                {(lang === 'ur' ? WEEK_UR : WEEK_EN).map((name) => (
                  <View key={name} style={{ flex: 1, alignItems: 'center' }}>
                    <T size={lang === 'ur' ? 10.5 : 12} w="semibold" color={C.muted} center latin={lang === 'en'} numberOfLines={1}>
                      {name}
                    </T>
                  </View>
                ))}
              </View>
              {monthGrid(shown).map((week, w) => (
                <View key={w} style={{ flexDirection: 'row', gap: 4 }}>
                  {week.map((day, i) => {
                    if (!day) return <View key={i} style={{ flex: 1, height: 46 }} />;
                    const future = day > today;
                    const picked = day === value;
                    const isToday = day === today;
                    return (
                      <Pressable
                        key={day}
                        accessibilityRole="button"
                        accessibilityState={{ selected: picked, disabled: future }}
                        disabled={future}
                        onPress={() => onPickDay(day)}
                        testID={`cal-day-${day}`}
                        style={{ flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', opacity: future ? 0.3 : 1, backgroundColor: picked ? C.ink : 'transparent', borderWidth: isToday && !picked ? 1.5 : 0, borderColor: C.greenDeep }}
                      >
                        <T size={15} w={picked || isToday ? 'semibold' : 'regular'} color={picked ? C.onInk : C.ink} latin center>
                          {String(Number(day.slice(8)))}
                        </T>
                        <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 2, backgroundColor: marked?.has(day) ? (picked ? C.onInk : C.greenDeep) : 'transparent' }} />
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            <Button label={t('wholeMonth', { month: formatMonth(`${shown}-01`, lang) })} variant={value === shown ? 'primary' : 'secondary'} icon="calendar" onPress={() => onPickMonth(shown)} testID="cal-whole-month" />
          </>
        ) : (
          <>
            {header(String(year), undefined, () => setYear(year - 1), () => setYear(year + 1), year < thisYear, t('previousYear'), t('nextYear'))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: 12 }, (_, m) => {
                const key = `${year}-${String(m + 1).padStart(2, '0')}`;
                const future = key > thisMonth;
                const picked = key === shown;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    disabled={future}
                    onPress={() => {
                      setShown(key);
                      setView('days');
                    }}
                    testID={`cal-month-${key}`}
                    style={{ width: '31%', flexGrow: 1, minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: picked ? C.ink : C.border, backgroundColor: picked ? C.ink : C.surface, alignItems: 'center', justifyContent: 'center', opacity: future ? 0.3 : 1 }}
                  >
                    <T size={15} w="semibold" color={picked ? C.onInk : C.ink} center>
                      {shortMonthName(m, lang)}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </SheetScroll>
    </Sheet>
  );
}
