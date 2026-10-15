import { t, live, currentLanguage } from '../localization';
import type { RecurrenceDraft } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
export const dayNames = live(() => ([t('m_6a00dfc1dc86'), t('m_7d8af1de1262'), t('m_c0a6cc829cd0'), t('m_fc2662062ffd'), t('m_e21f3f372a46'), t('m_dbe35c7363c2'), t('m_873fef760e5d')]));
export const repeatNames: Record<RecurrenceDraft['frequency'], string> = live(() => ({
  daily: t('m_b36c2611dcdf'), weekly: t('m_2975132481a7'), monthlyDay: t('m_3ac37ff4a7bb'), monthlyOrdinal: t('m_cbc46cad9c9f'), lastWeekday: t('m_5a3a5a97e9b0'), yearly: t('m_6e69b59ed34d'),
}));
const ordinals = live(() => ([t('m_a151ceb1711a'), t('m_8b88a8508956'), t('m_5e7425d72f32'), t('m_c737c0b33eb3'), t('m_b612a40113ea')]));
export type RepeatExplanation = 'missingMonthDate' | 'fifthWeekday' | 'leapYear' | 'missingYearDate' | 'lastWeekday';
export function repeatExplanation(rule: RecurrenceDraft): RepeatExplanation | null {
  if (rule.frequency === 'monthlyDay' && (rule.day ?? 0) >= 29) return 'missingMonthDate';
  if (rule.frequency === 'monthlyOrdinal' && rule.ordinal === 5) return 'fifthWeekday';
  if (rule.frequency === 'lastWeekday') return 'lastWeekday';
  if (rule.frequency === 'yearly') {
    if (rule.month === 2 && rule.day === 29) return 'leapYear';
    const date = new Date(Date.UTC(2024, (rule.month ?? 1) - 1, rule.day ?? 1));
    if (date.getUTCMonth() !== (rule.month ?? 1) - 1) return 'missingYearDate';
  }
  return null;
}
export function matchesRepeatPreset(value: RecurrenceDraft | undefined, base: RecurrenceDraft, frequency: RecurrenceDraft['frequency'], weekdays?: number[]) {
  return !!value && value.frequency === frequency && value.interval === 1 && value.count == null && !value.until &&
    (frequency !== 'weekly' || value.weekdays?.join() === (weekdays ?? base.weekdays)?.join()) &&
    (!['monthlyDay', 'yearly'].includes(frequency) || value.day === base.day) && (frequency !== 'yearly' || value.month === base.month);
}
export function cleanRepeat(value: RecurrenceDraft): RecurrenceDraft {
  const keys: (keyof RecurrenceDraft)[] = ['frequency', 'interval', 'weekdays', 'day', 'ordinal', 'weekday', 'month', 'count', 'until', 'zoneMode'];
  return Object.fromEntries(keys.filter((key) => value[key] != null).map((key) => [key, key === 'weekdays' ? [...value.weekdays!] : value[key]])) as RecurrenceDraft;
}
export function repeatLabel(value?: RecurrenceDraft) {
  if (!value) return t('m_621d129ab80a');
  if (currentLanguage() === 'zh-Hans') return chineseRepeatLabel(value);
  const every = (unit: string) => value.interval === 1 ? t('m_ff7cc2c543d6') + unit : t('m_ff7cc2c543d6') + value.interval + ' ' + unit + 's';
  let label: string;
  switch (value.frequency) {
    case 'daily': label = value.interval === 1 ? t('m_c4e42b974c33') : t('m_73088c2d4cbd') + value.interval + t('m_b1c503166f16'); break;
    case 'weekly': label = (value.weekdays ?? []).map((day) => dayNames[day - 1]?.slice(0, 3)).join(', ') + (value.interval > 1 ? t('m_c6e7db3ea408') + value.interval + t('m_8941244dd89b') : ''); break;
    case 'monthlyDay': label = t('m_df2441a485d2') + value.day + ' ' + every('month'); break;
    case 'monthlyOrdinal': label = (value.ordinal === -1 ? 'Last' : ordinals[(value.ordinal ?? 1) - 1]) + ' ' + dayNames[(value.weekday ?? 1) - 1] + ' ' + every('month'); break;
    case 'lastWeekday': label = t('m_977b5fe70f77') + every('month'); break;
    case 'yearly': label = new Date(Date.UTC(2024, (value.month ?? 1) - 1, 1)).toLocaleDateString([], { month: 'long', timeZone: 'UTC' }) + ' ' + value.day + ' · ' + every('year'); break;
  }
  if (value.count != null) label += ' · ' + value.count + t('m_5b402504fa20');
  else if (value.until) label += t('m_9ad99bcc6e3b') + new Date(value.until + 'T12:00:00Z').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return label;
}
export function repeatErrors(value: RecurrenceDraft, anchorDate: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!Number.isInteger(value.interval) || value.interval < 1 || value.interval > 999) errors.interval = t('m_0b7e5eee363e');
  if (value.frequency === 'weekly' && !value.weekdays?.length) errors.weekdays = t('m_535b7b89ead7');
  if (['monthlyDay', 'yearly'].includes(value.frequency) && (!Number.isInteger(value.day) || value.day! < 1 || value.day! > 31)) errors.day = t('m_fdffeb100c0d');
  if (value.count != null && (!Number.isInteger(value.count) || value.count < 1 || value.count > 100_000)) errors.count = t('m_d1a7bb14a0a3');
  if (value.until) {
    const parsed = new Date(value.until + 'T12:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.until) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.until ||
      value.until < anchorDate || value.until > '9999-12-31') errors.until = t('m_a20709d27264');
  }
  return errors;
}

function chineseRepeatLabel(value: RecurrenceDraft): string {
  const count = value.interval;
  let rule: string;
  switch (value.frequency) {
    case 'daily': rule = count === 1 ? t('m_c4e42b974c33') : t('repeat_days', { count }); break;
    case 'weekly': {
      const days = (value.weekdays ?? []).map(day => dayNames[day - 1]).join('、');
      rule = count === 1 ? days : t('repeat_weeks', { count, days }); break;
    }
    case 'monthlyDay': rule = t('repeat_month_day', { count, day: value.day ?? 1 }); break;
    case 'monthlyOrdinal': rule = t('repeat_month_ordinal', { count, ordinal: value.ordinal === -1 ? t('m_eb970eb0951c') : ordinals[(value.ordinal ?? 1) - 1], weekday: dayNames[(value.weekday ?? 1) - 1] }); break;
    case 'lastWeekday': rule = t('repeat_last_weekday', { count }); break;
    case 'yearly': rule = t('repeat_year', { count, month: value.month ?? 1, day: value.day ?? 1 }); break;
  }
  if (value.count != null) return t('repeat_end_count', { rule, count: value.count });
  if (value.until) return t('repeat_end_date', { rule, date: new Intl.DateTimeFormat('zh-Hans', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(value.until + 'T12:00:00Z')) });
  return rule;
}
