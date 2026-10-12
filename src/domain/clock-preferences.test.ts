import { describe, expect, it } from 'vitest';
import { clockPreferenceDate, clockPreferenceFromPicker, clockPreferenceLabel } from './clock-preferences';

describe('date-independent clock preferences', () => {
  it.each([0, 150, 600, 1020, 1439])('carries %i minutes without local DST conversion', minutes => {
    const date = clockPreferenceDate(minutes);
    expect(date.getUTCHours() * 60 + date.getUTCMinutes()).toBe(minutes);
    expect(clockPreferenceFromPicker(date.getTime(), 0)).toBe(minutes);
  });
  it('extracts the chosen wall clock with the picker offset, including a DST fold', () => {
    expect(clockPreferenceFromPicker(Date.parse('2026-11-01T08:30:00Z'), -420)).toBe(90);
    expect(clockPreferenceFromPicker(Date.parse('2026-11-01T09:30:00Z'), -480)).toBe(90);
    expect(clockPreferenceFromPicker(Date.parse('2026-10-10T18:29:00Z'), 330)).toBe(1439);
    expect(clockPreferenceFromPicker(Date.parse('2026-10-09T10:00:00Z'), 840)).toBe(0);
  });
  it('formats the same clock independently of device zone and dates', () => {
    expect(clockPreferenceLabel(150, 'en-GB')).toBe('2:30');
    expect(clockPreferenceLabel(600, 'en-US')).toBe('10:00 AM');
    expect(clockPreferenceLabel(0, 'en-GB')).toBe('0:00');
  });
  it('rejects unusable clocks rather than saving an invalid preference', () => {
    for (const minutes of [-1, 1440, 1.5, NaN]) expect(() => clockPreferenceDate(minutes)).toThrow(RangeError);
    expect(() => clockPreferenceFromPicker(NaN, 0)).toThrow(RangeError);
    expect(() => clockPreferenceFromPicker(0, NaN)).toThrow(RangeError);
  });
});
