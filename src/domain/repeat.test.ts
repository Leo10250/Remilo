import { describe, expect, it } from 'vitest';
import type { RecurrenceDraft } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { cleanRepeat, repeatErrors, repeatLabel } from './repeat';
const base: RecurrenceDraft = { frequency: 'daily', interval: 1, zoneMode: 'floating' };
describe('repeat summaries', () => {
  it('names monthly ordinal, weekday and interval together', () => {
    expect(repeatLabel({ ...base, frequency: 'monthlyOrdinal', interval: 2, ordinal: 3, weekday: 2 })).toBe('Third Tuesday every 2 months');
    expect(repeatLabel({ ...base, frequency: 'monthlyOrdinal', ordinal: -1, weekday: 5 })).toBe('Last Friday every month');
  });
  it('retains monthly date, annual date and ending information', () => {
    expect(repeatLabel({ ...base, frequency: 'monthlyDay', day: 31, count: 3 })).toBe('Day 31 every month · 3 occurrences');
    expect(repeatLabel({ ...base, frequency: 'yearly', month: 2, day: 29, interval: 4 })).toBe('February 29 · every 4 years');
    expect(repeatLabel({ ...base, until: '2027-03-01' })).toContain('until');
  });
  it('isolates an editable rule from the committed selection and native decorations', () => {
    const saved = { ...base, frequency: 'weekly' as const, weekdays: [1, 5], anchor: 'private decoration' };
    const draft = cleanRepeat(saved);
    draft.weekdays!.push(3);
    expect(saved.weekdays).toEqual([1, 5]);
    expect(draft).not.toHaveProperty('anchor');
  });
});
describe('custom repeat validation', () => {
  it('allows skipped dates rather than forbidding useful monthly/annual rules', () => {
    expect(repeatErrors({ ...base, frequency: 'yearly', month: 2, day: 29 }, '2027-01-01')).toEqual({});
    expect(repeatErrors({ ...base, frequency: 'monthlyDay', day: 31 }, '2027-01-01')).toEqual({});
  });
  it('requires weekdays, bounded integers and a valid inclusive ending', () => {
    expect(repeatErrors({ ...base, frequency: 'weekly', weekdays: [], interval: 0, count: 100_001, until: '2026-12-31' }, '2027-01-01')).toHaveProperty('weekdays');
    expect(repeatErrors({ ...base, interval: 1.5 }, '2027-01-01')).toHaveProperty('interval');
    expect(repeatErrors({ ...base, until: '2027-02-31' }, '2027-01-01')).toHaveProperty('until');
  });
});
