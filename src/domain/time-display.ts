import type { TimeDisplayPreferences } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export type TimeDisplayOptions = Partial<TimeDisplayPreferences>;
export function clockOptions(options: TimeDisplayOptions = {}): Intl.DateTimeFormatOptions {
  return { hour: 'numeric', minute: '2-digit', ...(options.uses24HourClock == null ? {} : { hourCycle: options.uses24HourClock ? 'h23' : 'h12' }) };
}
export function displayClock(value: number, zoneId?: string, options: TimeDisplayOptions = {}) {
  return new Intl.DateTimeFormat(options.localeTag, { ...clockOptions(options), timeZone: zoneId }).format(value);
}
export function displayDateTime(value: number, zoneId?: string, options: TimeDisplayOptions = {}, full = false) {
  return new Intl.DateTimeFormat(options.localeTag, { ...(full ? { weekday: 'short' as const, year: 'numeric' as const } : {}), month: 'short', day: 'numeric', ...clockOptions(options), timeZone: zoneId }).format(value);
}
