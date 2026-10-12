import type { TimeDisplayPreferences } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export type TimeDisplayOptions = Partial<TimeDisplayPreferences>;
/** A late read cannot replace a newer event or outlive its presentation owner. */
export class TimeDisplayObservation {
  private revision = 0;
  private live = true;
  constructor(private changed: (preferences: TimeDisplayPreferences) => void) {}
  update(preferences: TimeDisplayPreferences) { ++this.revision; if (this.live) this.changed(preferences); }
  async refresh(read: () => Promise<TimeDisplayPreferences>) {
    const request = ++this.revision;
    try { const next = await read(); if (this.live && request === this.revision) this.changed(next); }
    catch { /* Last observation survives an unavailable read. */ }
  }
  close() { this.live = false; ++this.revision; }
}
export function clockOptions(options: TimeDisplayOptions = {}): Intl.DateTimeFormatOptions {
  return { hour: 'numeric', minute: '2-digit', ...(options.uses24HourClock == null ? {} : { hourCycle: options.uses24HourClock ? 'h23' : 'h12' }) };
}
export function displayClock(value: number, zoneId?: string, options: TimeDisplayOptions = {}) {
  return new Intl.DateTimeFormat(options.localeTag, { ...clockOptions(options), timeZone: zoneId }).format(value);
}
export function displayDateTime(value: number, zoneId?: string, options: TimeDisplayOptions = {}, full = false) {
  return new Intl.DateTimeFormat(options.localeTag, { ...(full ? { weekday: 'short' as const, year: 'numeric' as const } : {}), month: 'short', day: 'numeric', ...clockOptions(options), timeZone: zoneId }).format(value);
}
