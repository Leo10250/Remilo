import { describe, expect, it } from 'vitest';
import { displayClock } from './time-display';
import { clockPreferenceLabel } from './clock-preferences';
import { cardTimingPresentation, eventRange, spokenDateTime } from './presentation';

describe('device clock overrides', () => {
  const day = Date.parse('2026-10-10T00:00:00Z');
  it.each([0, 720, 1439])('keeps %i minutes independent of dates and locale defaults', minutes => {
    const at = day + minutes * 60_000;
    const clock = displayClock(at, 'UTC', { localeTag: 'en-US', uses24HourClock: true });
    expect(clock).toBe(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
    expect(clockPreferenceLabel(minutes, 'en-US', { uses24HourClock: true })).toBe(clock);
    expect(displayClock(at, 'UTC', { localeTag: 'en-GB', uses24HourClock: false })).toMatch(/AM|PM/i);
  });
  it('preserves full spoken dates, zone conversion and cross-day range while overriding the clock', () => {
    const at = Date.parse('2026-11-01T08:30:00Z'), options = { localeTag: 'en-US', uses24HourClock: true };
    expect(displayClock(at, 'America/Los_Angeles', options)).toBe('01:30');
    expect(displayClock(at + 3_600_000, 'America/Los_Angeles', options)).toBe('01:30');
    expect(spokenDateTime(at, 'America/Los_Angeles', options)).toContain('2026');
    expect(spokenDateTime(at, 'America/Los_Angeles', options)).toContain('01:30');
    const item = { eventStartMs: day + 23 * 3_600_000, eventEndMs: day + 25 * 3_600_000, dueAtMs: day, alarmAtMs: day, zoneId: 'UTC', mode: 'None' as const };
    expect(eventRange(item, day, false, options)).toContain('23:00');
    expect(eventRange(item, day, false, options)).toContain('01:00');
    const card = cardTimingPresentation(item, day, { groupKey: '2026-10-10' }, options);
    expect(card.spokenTiming).toContain('2026');
    expect(card.timing).toContain('Tomorrow');
  });
  it('uses Chinese locale and retains locale fallback when no observation exists', () => {
    expect(displayClock(day + 18 * 3_600_000, 'UTC', { localeTag: 'zh-CN', uses24HourClock: true })).toBe('18:00');
    expect(displayClock(day + 18 * 3_600_000, 'UTC', { localeTag: 'en-US' })).toMatch(/6:00.*PM/);
  });
});
