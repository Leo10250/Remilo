function validMinutes(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) throw new RangeError('Choose a clock time from 00:00 to 23:59.');
}
/** UTC is only a carrier for a clock preference; this date is never scheduled. */
export function clockPreferenceDate(minutes: number) {
  validMinutes(minutes);
  return new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));
}
export function clockPreferenceLabel(minutes: number, locale?: string) {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(clockPreferenceDate(minutes));
}
export function clockPreferenceFromPicker(timestamp: number, utcOffsetMinutes: number) {
  if (!Number.isFinite(timestamp) || !Number.isFinite(utcOffsetMinutes)) throw new RangeError('Could not read this clock time.');
  const clock = new Date(timestamp + utcOffsetMinutes * 60_000);
  const minutes = clock.getUTCHours() * 60 + clock.getUTCMinutes();
  validMinutes(minutes);
  return minutes;
}
