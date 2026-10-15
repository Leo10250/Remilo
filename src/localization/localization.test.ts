import { afterEach, describe, expect, it } from 'vitest';
import { captureFeedback, presentFeedback, confirmLanguage, createTranslator, currentLanguage, ownedMessage, resolveLanguage, errorText, t } from '.';
import { catalogs, type MessageKey } from './catalog.generated';
import { dayNames, repeatNames } from '../domain/repeat';
import { atmosphereNames } from '../domain/settings-presentation';
import { cardTimingPresentation, overduePresentation, groupTitle } from '../domain/presentation';
const key = (english: string) => (Object.keys(catalogs.en) as MessageKey[]).find(k => catalogs.en[k] === english)!;
afterEach(() => confirmLanguage('en'));

describe('supported language resolution', () => {
  it.each([
    [['zh-CN'], 'zh-Hans'], [['zh-SG'], 'zh-Hans'], [['zh-Hans-HK'], 'zh-Hans'],
    [['zh-Hant-CN'], 'en'], [['zh-TW'], 'en'], [['zh-HK'], 'en'], [['zh-MO'], 'en'],
    [['fr-FR', 'zh-Hant-TW', 'zh-Hans-SG'], 'zh-Hans'], [['en-GB', 'zh-CN'], 'en'],
    [['fr', 'ja'], 'en'], [[], 'en'],
  ] as const)('resolves %j to %s', (tags, expected) => expect(resolveLanguage(tags)).toBe(expected));
});
describe('reviewed presentation messages', () => {
  it('uses explicit translators without changing the confirmed application locale', () => {
    const chinese = createTranslator('zh-Hans');
    expect(chinese(key('Mark as done'))).toBe('标记为完成');
    expect(currentLanguage()).toBe('en');
  });
  it('reformats retained feedback without translating authored values', () => {
    const args = { arg0: 'Buy milk 买牛奶', arg1: '18:00' };
    const text = t(key('{arg0} at {arg1}'), args);
    confirmLanguage('zh-Hans');
    expect(ownedMessage(text)).toBe('Buy milk 买牛奶：18:00');
    expect(args.arg0).toBe('Buy milk 买牛奶');
    confirmLanguage('en'); expect(ownedMessage(text)).toBe('Buy milk 买牛奶 at 18:00');
  });
  it('updates display-only lookup tables without remounting', () => {
    expect(dayNames[0]).toBe('Monday');
    confirmLanguage('zh-Hans');
    expect(dayNames[0]).toBe('星期一'); expect(repeatNames.daily).toBe('每天');
    expect(atmosphereNames.night).toBe('夜幕');
    confirmLanguage('en'); expect(dayNames[0]).toBe('Monday');
  });
  it('formats explicit Chinese timing while preserving the authored instants', () => {
    const instant = new Date(2026, 9, 15, 18, 0, 0).getTime();
    const item = { title: 'Buy milk', eventStartMs: instant, eventEndMs: instant + 1800000,
      dueAtMs: instant, alarmAtMs: instant, mode: 'Alarm' as const, deliveryState: 'Scheduled' };
    const before = JSON.stringify(item);
    const value = cardTimingPresentation(item, instant - 3600000, undefined,
      { localeTag: 'zh-Hans', resolvedLanguage: 'zh-Hans', uses24HourClock: true });
    expect(value.timing).toContain('18:00');
    expect(value.timing).not.toMatch(/Alarm|Today| at /);
    expect(JSON.stringify(item)).toBe(before);
  });
  it('retains feedback descriptors even after the compatibility cache changes', () => {
    const retained = captureFeedback({ message: t(key('{arg0} at {arg1}'), { arg0: '自定义内容 User title', arg1: '18:00' }), tone: 'success' });
    for (let index = 0; index < 2200; index++) t(key('{arg0} at {arg1}'), { arg0: String(index), arg1: 'x' });
    confirmLanguage('zh-Hans');
    expect(presentFeedback<{message:string}>(retained).message).toBe('自定义内容 User title：18:00');
  });
  it('preserves machine identities while capturing display fields', () => {
    const retained = captureFeedback({ message: t(key('Completed')), status: 'Completed', commandKind: 'Snooze', title: 'Private name 名称', tone: 'warning' });
    confirmLanguage('zh-Hans');
    expect(presentFeedback(retained)).toMatchObject({ message: '已完成', status: 'Completed', commandKind: 'Snooze', title: 'Private name 名称', tone: 'warning' });
  });
  it('formats Chinese overdue ages and date groups without English unit suffixes', () => {
    confirmLanguage('zh-Hans');
    const now = Date.now(), base = { eventStartMs: now, eventEndMs: now, dueAtMs: now, alarmAtMs: now, overdue: true, overdueAtMs: now - 172800000 };
    expect(overduePresentation(base, now)?.label).toContain('2 天');
    expect(overduePresentation(base, now)?.spokenLabel).not.toMatch(/days|天s/);
    expect(groupTitle('2026-12-01', new Date(2026, 9, 15))).not.toMatch(/Dec|Tue/);
  });
  it('uses reviewed fallbacks for unknown platform failures', () => {
    confirmLanguage('zh-Hans');
    const fallback = t(key('Could not save this change. Retry.'));
    expect(errorText(new Error('java.lang.SecurityException: private detail'), fallback)).toBe(fallback);
  });
});
