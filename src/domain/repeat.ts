import type { RecurrenceDraft } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
export const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const repeatNames: Record<RecurrenceDraft['frequency'], string> = {
  daily: 'Daily', weekly: 'Weekly', monthlyDay: 'Monthly date', monthlyOrdinal: 'Monthly weekday', lastWeekday: 'Last weekday', yearly: 'Yearly',
};
const ordinals = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
export function cleanRepeat(value: RecurrenceDraft): RecurrenceDraft {
  const keys: (keyof RecurrenceDraft)[] = ['frequency', 'interval', 'weekdays', 'day', 'ordinal', 'weekday', 'month', 'count', 'until', 'zoneMode'];
  return Object.fromEntries(keys.filter((key) => value[key] != null).map((key) => [key, key === 'weekdays' ? [...value.weekdays!] : value[key]])) as RecurrenceDraft;
}
export function repeatLabel(value?: RecurrenceDraft) {
  if (!value) return 'Does not repeat';
  const every = (unit: string) => value.interval === 1 ? 'every ' + unit : 'every ' + value.interval + ' ' + unit + 's';
  let label: string;
  switch (value.frequency) {
    case 'daily': label = value.interval === 1 ? 'Every day' : 'Every ' + value.interval + ' days'; break;
    case 'weekly': label = (value.weekdays ?? []).map((day) => dayNames[day - 1]?.slice(0, 3)).join(', ') + (value.interval > 1 ? ' · every ' + value.interval + ' weeks' : ''); break;
    case 'monthlyDay': label = 'Day ' + value.day + ' ' + every('month'); break;
    case 'monthlyOrdinal': label = (value.ordinal === -1 ? 'Last' : ordinals[(value.ordinal ?? 1) - 1]) + ' ' + dayNames[(value.weekday ?? 1) - 1] + ' ' + every('month'); break;
    case 'lastWeekday': label = 'Last weekday ' + every('month'); break;
    case 'yearly': label = new Date(Date.UTC(2024, (value.month ?? 1) - 1, 1)).toLocaleDateString([], { month: 'long', timeZone: 'UTC' }) + ' ' + value.day + ' · ' + every('year'); break;
  }
  if (value.count != null) label += ' · ' + value.count + ' occurrences';
  else if (value.until) label += ' · until ' + new Date(value.until + 'T12:00:00Z').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return label;
}
export function repeatErrors(value: RecurrenceDraft, anchorDate: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!Number.isInteger(value.interval) || value.interval < 1 || value.interval > 999) errors.interval = 'Enter a whole number from 1 to 999.';
  if (value.frequency === 'weekly' && !value.weekdays?.length) errors.weekdays = 'Choose at least one weekday.';
  if (['monthlyDay', 'yearly'].includes(value.frequency) && (!Number.isInteger(value.day) || value.day! < 1 || value.day! > 31)) errors.day = 'Enter a day from 1 to 31.';
  if (value.count != null && (!Number.isInteger(value.count) || value.count < 1 || value.count > 100_000)) errors.count = 'Enter a whole number from 1 to 100,000.';
  if (value.until) {
    const parsed = new Date(value.until + 'T12:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.until) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.until ||
      value.until < anchorDate || value.until > '9999-12-31') errors.until = 'Choose an end date on or after the first event day.';
  }
  return errors;
}
