import { describe, expect, it } from 'vitest';
import { monthGrid, shortMonthName } from '../src/logic/dates';

describe('monthGrid', () => {
  it('lays out October 2026 from Monday, starting on a Thursday', () => {
    const weeks = monthGrid('2026-10');
    expect(weeks[0]).toEqual(['', '', '', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[weeks.length - 1]).toContain('2026-10-31');
  });

  it('knows February in a leap year and a month that starts on Monday', () => {
    expect(monthGrid('2028-02').flat().filter(Boolean)).toHaveLength(29);
    expect(monthGrid('2027-02').flat().filter(Boolean)).toHaveLength(28);
    expect(monthGrid('2027-02')[0][0]).toBe('2027-02-01');
  });

  it('names months in both languages', () => {
    expect(shortMonthName(9, 'en')).toBe('Oct');
    expect(shortMonthName(9, 'ur')).toBe('اکتوبر');
  });
});
