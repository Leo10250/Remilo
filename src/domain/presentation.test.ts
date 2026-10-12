import { describe, expect, it, vi } from 'vitest';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { agendaAlertPresentation, alertPresentation, calendarDate, canAdjustAlert, cardTimingPresentation, detailSchedulePresentation, deliveryExplanation, eventRange, nextAlertTime, ordinaryDue, overduePresentation, recordedCompletionTime, reminderBrowsingPresentation, repeatSummary, scheduleDateTime, scheduleNeedsDetails, spokenDateTime, stateIcon, stateLabel, type ScheduleItem } from './presentation';
import { deviceZone } from './time';
import * as time from './time';

const start = Date.UTC(2027, 0, 5, 15);
const normal: ScheduleItem = { eventStartMs: start, eventEndMs: start + 1_800_000, dueAtMs: start, alarmAtMs: start,
  zoneId: 'UTC', dueLinked: true, alarmLinked: true, mode: 'Alarm', nextAlertMs: start, deliveryState: 'Scheduled' };
describe('user-facing schedule', () => {
  it('collapses an ordinary linked due and unchanged alert, retaining independent coincident semantics', () => {
    expect(ordinaryDue(normal)).toBe(true); expect(scheduleNeedsDetails(normal, 'UTC')).toBe(false);
    expect(ordinaryDue({ ...normal, dueLinked: false })).toBe(false);
    expect(scheduleNeedsDetails({ ...normal, dueLinked: false })).toBe(true);
    expect(scheduleNeedsDetails({ ...normal, alarmLinked: false })).toBe(true);
    expect(scheduleNeedsDetails({ ...normal, nextAlertMs: start + 600_000 })).toBe(true);
    expect(scheduleNeedsDetails({ ...normal, mode: 'None', alarmLinked: false }, 'UTC')).toBe(false);
  });
  it('keeps an all-day due at the native next-midnight boundary on a short DST day', () => {
    const allDay = { ...normal, allDay: true, zoneId: 'America/Los_Angeles',
      eventStartMs: Date.parse('2026-03-08T00:00:00-08:00'), eventEndMs: Date.parse('2026-03-09T00:00:00-07:00'),
      dueAtMs: Date.parse('2026-03-09T00:00:00-07:00') };
    expect(ordinaryDue(allDay)).toBe(true);
    expect(eventRange(allDay, allDay.eventStartMs)).toBe('Today · All day');
    expect(ordinaryDue({ ...allDay, dueAtMs: allDay.eventStartMs + 86_400_000 })).toBe(false);
  });
  it('shows both dates across midnight and includes a year for historical dates', () => {
    expect(calendarDate(Date.UTC(2025, 0, 5), 'UTC', start)).toContain('2025');
    const crossing = { ...normal, eventStartMs: Date.UTC(2027, 0, 5, 23, 30), eventEndMs: Date.UTC(2027, 0, 6, 0, 30) };
    expect(eventRange(crossing, start)).toContain('Today');
    expect(eventRange(crossing, start)).toContain('Tomorrow');
  });
  it('can omit a redundant group date without dropping cross-day timing', () => {
    expect(eventRange(normal, start, true)).not.toContain('Today');
    expect(eventRange(normal, start, true)).toContain('–');
    expect(eventRange({ ...normal, allDay: true }, start, true)).toBe('All day');
    const crossing = { ...normal, eventStartMs: Date.UTC(2027, 0, 5, 23, 30), eventEndMs: Date.UTC(2027, 0, 6, 0, 30) };
    expect(eventRange(crossing, start, true)).toContain('Today');
    expect(eventRange(crossing, start, true)).toContain('Tomorrow');
  });
  it('preserves nonzero linked offsets and consequential zones and exceptions', () => {
    expect(ordinaryDue({ ...normal, dueAtMs: start + 600_000 })).toBe(false);
    expect(scheduleNeedsDetails({ ...normal, dueAtMs: start + 600_000 }, 'UTC')).toBe(true);
    expect(scheduleNeedsDetails({ ...normal, exception: true }, 'UTC')).toBe(true);
    expect(scheduleNeedsDetails({ ...normal, zoneId: 'Europe/Paris' }, 'UTC')).toBe(true);
    expect(scheduleNeedsDetails({ ...normal, repeatRule: { frequency: 'daily', interval: 1, zoneMode: 'pinned' } }, 'UTC')).toBe(true);
  });
  it('names actual alert modes and distinguishes an unknown adjustment from a recorded choice', () => {
    expect(alertPresentation(normal, false, start).label).toMatch(/^Alarm at Today/);
    expect(alertPresentation({ ...normal, mode: 'Notification' }, false, start).label).toMatch(/^Notification at Today/);
    expect(alertPresentation({ ...normal, mode: 'None' }, false, start).label).toBe('No alert');
    expect(alertPresentation({ ...normal, mode: 'None', nextAlertMs: start + 600_000 }, false, start).target).toBeNull();
    expect(alertPresentation({ ...normal, mode: 'None', nextAlertMs: start + 600_000 }, false, start).changed).toBe(false);
    const changed = { ...normal, nextAlertMs: start + 600_000 };
    expect(alertPresentation(changed, false, start).label).toMatch(/^Alert changed to/);
    expect(alertPresentation(changed, false, start).targetZone).toBe(deviceZone());
    expect(alertPresentation({ ...changed, alertAdjustment: 'Snoozed' }, false, start).label).toMatch(/^Alarm snoozed to/);
    expect(alertPresentation({ ...changed, alertAdjustment: 'Postponed' }, false, start).label).toMatch(/^Alarm postponed to/);
    expect(alertPresentation({ ...changed, mode: 'Notification', alertAdjustment: 'Postponed' }, false, start).label).toMatch(/^Notification postponed to/);
  });
  it('presents blocked and changing targets as intended, and terminal targets as historical', () => {
    for (const deliveryState of ['Blocked', 'Pending', 'Changing', 'SeriesChanging']) {
      const result = alertPresentation({ ...normal, deliveryState }, false, start);
      expect(result.label).toContain('intended for'); expect(result.confirmed).toBe(false);
      expect(nextAlertTime({ ...normal, deliveryState } as Occurrence)).toBeNull();
    }
    for (const deliveryState of ['Stopped', 'Missed', 'TimedOut', 'Interrupted', 'Failed', 'Notified', 'Paused']) {
      const result = alertPresentation({ ...normal, deliveryState }, false, start);
      expect(result.label).toBe('No next alert scheduled'); expect(result.target).toBeNull();
    }
    for (const state of [{ completed: true }, { skipped: true }, { deleted: true }]) {
      expect(alertPresentation({ ...normal, ...state }, false, start).label).toMatch(/^Alarm was set for/);
      expect(alertPresentation({ ...normal, ...state }, false, start).target).toBeNull();
    }
  });
});
describe('task state and alert actions', () => {
  const item = { ...normal, completed: false, deleted: false, skipped: false } as Occurrence;
  it('keeps historical Stopped, missed and timed-out unfinished reminders adjustable', () => {
    for (const deliveryState of ['Stopped', 'Missed', 'TimedOut']) {
      expect(canAdjustAlert({ ...item, deliveryState })).toBe(true);
      expect(deliveryExplanation({ ...item, deliveryState })).toContain('Still unfinished');
    }
    for (const deliveryState of ['Paused', 'Changing', 'SeriesChanging', 'Replaced']) expect(canAdjustAlert({ ...item, deliveryState })).toBe(false);
    expect(canAdjustAlert({ ...item, mode: 'None' })).toBe(false);
    expect(canAdjustAlert({ ...item, completed: true })).toBe(false);
    expect(canAdjustAlert({ ...item, deleted: true })).toBe(false);
  });
  it('calls a missed notification a notification and never invents a completion timestamp', () => {
    expect(stateLabel({ ...item, mode: 'Notification', deliveryState: 'Missed' })).toBe('Notification delivery missed');
    expect(deliveryExplanation({ ...item, mode: 'Notification', deliveryState: 'Missed' })).toBe('Notification delivery missed. Still unfinished.');
    expect(stateLabel({ ...item, mode: 'None', deliveryState: 'Missed' })).toBe('No alert');
    expect(stateLabel({ ...item, mode: 'Notification', deliveryState: 'Failed' })).toBe('Notification could not be sent');
    expect(stateLabel({ ...item, nextAlertMs: start + 600_000, alertAdjustment: null })).toBe('Alert changed');
    expect(stateIcon({ ...item, deliveryState: 'Stopped' })).toBe('stop');
    expect(stateIcon({ ...item, deliveryState: 'Blocked' })).toBe('error');
    expect(recordedCompletionTime([{ kind: 'Edit', atMs: start, targetMs: null }])).toBeNull();
    expect(recordedCompletionTime([{ kind: 'Done', atMs: start, targetMs: null }, { kind: 'Done', atMs: start + 1000, targetMs: null }])).toBe(start + 1000);
  });
});


describe('alert-first browsing', () => {
  it('uses device-local alert dates even when the authored event zone differs', () => {
    const result = agendaAlertPresentation({ ...normal, zoneId: 'Asia/Shanghai' }, start);
    expect(result).toBe('Alarm at ' + scheduleDateTime(start, deviceZone(), start));
    expect(agendaAlertPresentation({ ...normal, mode: 'None' }, start)).toBe('No alert');
  });
  it('retains tomorrow on an overdue postponed alert and explains intended scheduling', () => {
    const tomorrow = new Date(start); tomorrow.setDate(tomorrow.getDate() + 1);
    expect(agendaAlertPresentation({ ...normal, dueAtMs: start - 1, nextAlertMs: tomorrow.getTime(), alertAdjustment: 'Postponed' }, start)).toContain('postponed to Tomorrow');
    for (const deliveryState of ['Pending', 'Blocked', 'Changing', 'SeriesChanging']) {
      const result = agendaAlertPresentation({ ...normal, deliveryState }, start);
      expect(result).toContain('intended for'); expect(result).not.toContain('Alarm at');
    }
  });
  it('never advertises past or paused delivery as an upcoming alert', () => {
    for (const deliveryState of ['Missed', 'TimedOut', 'Interrupted', 'Failed', 'Notified', 'Paused', 'Stopped']) {
      const result = agendaAlertPresentation({ ...normal, deliveryState }, start);
      expect(result).toContain('was set for'); expect(result).not.toContain('Alarm at');
    }
  });
});

describe('concise work-state browsing', () => {
  const overdue = { ...normal, completed: false, skipped: false, deleted: false, overdue: true, overdueAtMs: start - 3 * 60_000,
    dueAtMs: start + 86_400_000, alarmAtMs: start - 3 * 60_000, nextAlertMs: start + 600_000 };
  it.each<[number, string, string]>([
    [1_000, 'Overdue · <1 min', 'Overdue by less than one minute'],
    [60_000, 'Overdue · 1 min', 'Overdue by 1 minute'],
    [3 * 60_000, 'Overdue · 3 min', 'Overdue by 3 minutes'],
    [60 * 60_000, 'Overdue · 1 hr', 'Overdue by 1 hour'],
    [119 * 60_000, 'Overdue · 1 hr', 'Overdue by 1 hour'],
    [86_400_000, 'Overdue · 1 day', 'Overdue by 1 day'],
    [2 * 86_400_000, 'Overdue · 2 days', 'Overdue by 2 days'],
  ])('formats native overdue age %i without reading Event, Due or next alert', (elapsed, label, spokenLabel) => {
    expect(overduePresentation({ ...overdue, overdueAtMs: start - elapsed }, start)).toEqual({ label, spokenLabel });
  });
  it('suppresses stale terminal flags, missing references and not-yet-elapsed boundaries', () => {
    for (const state of [{ completed: true }, { deleted: true }, { skipped: true }]) {
      expect(overduePresentation({ ...overdue, ...state }, start)).toBeNull();
      expect(reminderBrowsingPresentation({ ...overdue, deliveryState: 'Alerting', ...state }, start).spokenLabel).not.toContain('Overdue');
    }
    expect(overduePresentation({ ...overdue, overdue: false }, start)).toBeNull();
    expect(overduePresentation({ ...overdue, overdueAtMs: undefined }, start)).toBeNull();
    expect(overduePresentation({ ...overdue, overdueAtMs: Number.NaN }, start)).toBeNull();
    expect(overduePresentation({ ...overdue, overdueAtMs: start }, start)).toBeNull();
    expect(overduePresentation({ ...overdue, overdueAtMs: start + 1 }, start)).toBeNull();
  });
  it('keeps snoozed and postponed next delivery separate from original overdue age', () => {
    for (const alertAdjustment of ['Snoozed', 'Postponed'] as const) {
      const result = reminderBrowsingPresentation({ ...overdue, alertAdjustment }, start);
      expect(result.status?.label).toBe('Overdue · 3 min');
      expect(result.timing).toContain('Next alarm'); expect(result.timing).toContain(alertAdjustment);
      expect(result.spokenLabel).toContain('Overdue by 3 minutes');
    }
    const result = reminderBrowsingPresentation({ ...overdue, mode: 'None' }, start);
    expect(result.timing).toBe('No alert · ' + eventRange({ ...overdue, zoneId: deviceZone() }, start)); expect(result.status?.label).toBe('Overdue · 3 min');
  });
  it('preserves the scheduled When for No alert work without treating independent Due as its schedule', () => {
    const item = { ...normal, mode: 'None' as const, dueAtMs: start - 86_400_000, dueLinked: false, deliveryState: 'NoAlert', overdue: false };
    const result = reminderBrowsingPresentation(item, start);
    expect(result.timing).toBe('No alert · ' + eventRange({ ...item, zoneId: deviceZone() }, start)); expect(result.status).toBeNull();
    expect(result.timing).not.toContain(scheduleDateTime(item.dueAtMs, item.zoneId, start));
    const allDay = { ...item, allDay: true };
    expect(reminderBrowsingPresentation(allDay, start).timing).toBe('No alert · Today · All day');
  });
  it('matches timed No alert date groups to the device zone while preserving authored all-day and terminal dates', () => {
    const zone = vi.spyOn(time, 'deviceZone').mockReturnValue('America/Los_Angeles');
    try {
      const now = Date.parse('2027-01-05T12:00:00Z');
      const item = { ...normal, mode: 'None' as const, zoneId: 'Asia/Shanghai',
        eventStartMs: Date.parse('2027-01-05T18:00:00Z'), eventEndMs: Date.parse('2027-01-05T18:30:00Z') };
      expect(eventRange(item, now)).toContain('Tomorrow');
      const result = reminderBrowsingPresentation(item, now);
      expect(result.timing).toBe('No alert · ' + eventRange({ ...item, zoneId: 'America/Los_Angeles' }, now));
      expect(result.timing).toContain('Today'); expect(result.timing).not.toContain('Tomorrow');
      expect(reminderBrowsingPresentation({ ...item, completed: true }, now).timing).toBe('No alert · ' + eventRange(item, now));
      const allDay = { ...item, allDay: true, eventStartMs: Date.parse('2027-01-05T16:00:00Z'), eventEndMs: Date.parse('2027-01-06T16:00:00Z') };
      expect(reminderBrowsingPresentation(allDay, now).timing).toBe('No alert · Tomorrow · All day');
    } finally { zone.mockRestore(); }
  });
  it('prioritizes ringing visually without erasing the spoken overdue state', () => {
    const result = reminderBrowsingPresentation({ ...overdue, deliveryState: 'Alerting' }, start);
    expect(result.status?.label).toBe('Ringing'); expect(result.timing).toContain('Alarm time');
    expect(result.spokenLabel).toContain('Alarm ringing'); expect(result.spokenLabel).toContain('Overdue by 3 minutes');
  });
  it('uses overdue rather than redundant delivery outcomes while retaining diagnostics', () => {
    for (const deliveryState of ['Missed', 'TimedOut', 'Interrupted', 'Stopped', 'Notified']) {
      const result = reminderBrowsingPresentation({ ...overdue, deliveryState }, start);
      expect(result.status?.label).toBe('Overdue · 3 min');
      expect(result.spokenLabel).not.toMatch(/missed|timed out|interrupted|stopped|sent/i);
    }
    expect(stateLabel({ ...overdue, deliveryState: 'TimedOut' })).toBe('Alarm timed out');
    expect(reminderBrowsingPresentation({ ...normal, mode: 'Notification', deliveryState: 'Missed' }, start).status).toBeNull();
  });
  it('keeps an actionable blocked target and failed-delivery explanation truthful', () => {
    const blocked = reminderBrowsingPresentation({ ...overdue, deliveryState: 'Blocked' }, start);
    expect(blocked.status?.label).toBe('Overdue · 3 min'); expect(blocked.timing).toContain('Intended alarm'); expect(blocked.timing).toContain('Blocked');
    const failed = reminderBrowsingPresentation({ ...overdue, mode: 'Notification', deliveryState: 'Failed' }, start);
    expect(failed.status?.label).toBe('Overdue · 3 min'); expect(failed.warning).toBe('Notification could not be sent');
  });
  it('omits routine duplicate chips and preserves repeat metadata independently', () => {
    for (const deliveryState of ['Scheduled', 'Pending', 'Changing', 'SeriesChanging', 'Notified'])
      expect(reminderBrowsingPresentation({ ...normal, deliveryState }, start).status).toBeNull();
    expect(reminderBrowsingPresentation({ ...normal, alertAdjustment: 'Snoozed' }, start).status).toBeNull();
    expect(repeatSummary({ repeatRule: { frequency: 'daily', interval: 1, zoneMode: 'floating' }, repeatSummary: null })).toBe('Every day');
  });
  it('keeps terminal schedule, historical alert and one work-state label without an invented date', () => {
    for (const [state, label] of [[{ completed: true }, 'Completed'], [{ skipped: true }, 'Skipped'], [{ deleted: true }, 'In Trash · Previously unfinished']] as const) {
      const result = reminderBrowsingPresentation({ ...overdue, ...state }, start);
      expect(result.status?.label).toBe(label); expect(result.timing).toBe('Original alarm · ' + scheduleDateTime(overdue.alarmAtMs, overdue.zoneId, start));
      expect(result.spokenLabel).toContain('Original alarm'); expect(result.spokenLabel).not.toMatch(/Completed at|Skipped at|Moved to Trash at/);
    }
  });
});

describe('card and Details timing authority', () => {
  it('chooses current, intended, previous and original targets independently of populated nextAlertMs', () => {
    const adjusted = { ...normal, nextAlertMs: start + 600_000, agendaAtMs: start + 600_000, alertAdjustment: 'Postponed' as const };
    expect(cardTimingPresentation(adjusted, start).timing).toBe('Next alarm · ' + scheduleDateTime(adjusted.nextAlertMs, deviceZone(), start) + ' · Postponed');
    for (const deliveryState of ['Blocked', 'Pending', 'Changing', 'SeriesChanging']) {
      const item = { ...adjusted, deliveryState };
      expect(cardTimingPresentation(item, start).timing).toContain('Intended alarm');
      expect(alertPresentation(item).confirmed).toBe(false);
    }
    for (const deliveryState of ['Missed', 'TimedOut', 'Interrupted', 'Failed', 'Stopped', 'Notified', 'Paused', 'Alerting']) {
      const item = { ...adjusted, deliveryState };
      expect(cardTimingPresentation(item, start).timing).toBe('Alarm time · ' + scheduleDateTime(adjusted.nextAlertMs, deviceZone(), start));
      expect(nextAlertTime(item as Occurrence)).toBeNull();
    }
    for (const state of [{ completed: true }, { skipped: true }, { deleted: true }]) {
      expect(cardTimingPresentation({ ...adjusted, ...state }, start).timing).toBe('Original alarm · ' + scheduleDateTime(normal.alarmAtMs, normal.zoneId, start));
      expect(cardTimingPresentation({ ...adjusted, ...state, mode: 'Notification' }, start).timing).toContain('Original notification');
    }
  });
  it('omits dates only beneath matching civil date headings and retains full accessible dates', () => {
    const zone = vi.spyOn(time, 'deviceZone').mockReturnValue('UTC');
    try {
      const context = { groupKey: '2027-01-05' };
      const matching = cardTimingPresentation(normal, start, context);
      expect(matching.timing).not.toContain('Today');
      expect(matching.spokenTiming).toContain(spokenDateTime(start, 'UTC'));
      expect(matching.spokenTiming).toContain('2027');
      for (const groupKey of ['overdue', 'earlier', 'completed', '2027-01-06'])
        expect(cardTimingPresentation(normal, start, { groupKey }).timing).toContain('Today');
      expect(cardTimingPresentation({ ...normal, completed: true }, start, context).timing).toContain('Today');
      expect(cardTimingPresentation({ ...normal, zoneId: 'Asia/Shanghai' }, start, context).timing).toContain('Today');
      const crossDay = { ...normal, mode: 'None' as const, eventStartMs: Date.UTC(2027, 0, 5, 23, 30), eventEndMs: Date.UTC(2027, 0, 6, 0, 30) };
      expect(cardTimingPresentation(crossDay, start, context).timing).toContain('Today');
      expect(cardTimingPresentation(crossDay, start, context).timing).toContain('Tomorrow');
      const midnight = { ...normal, alarmAtMs: Date.UTC(2027, 0, 6), nextAlertMs: Date.UTC(2027, 0, 6) };
      expect(cardTimingPresentation(midnight, start, context).timing).toContain('Tomorrow');
    } finally { zone.mockRestore(); }
  });
    it('discloses Calendar Event when relevant and retains independent coincident Due', () => {
    expect(detailSchedulePresentation(normal, start).showEvent).toBe(false);
    expect(detailSchedulePresentation(normal, start).showDue).toBe(false);
    expect(detailSchedulePresentation({ ...normal, dueLinked: false }, start).showDue).toBe(true);
    expect(detailSchedulePresentation({ ...normal, dueAtMs: start + 1 }, start).showDue).toBe(true);
    expect(detailSchedulePresentation(normal, start, true).showEvent).toBe(true);
      expect(detailSchedulePresentation({ ...normal, allDay: true }, start).showEvent).toBe(false);
      expect(detailSchedulePresentation({ ...normal, nextAlertMs: start + 600_000 }, start).showEvent).toBe(false);
      expect(detailSchedulePresentation({ ...normal, deliveryState: 'Blocked', nextAlertMs: start + 600_000 }, start).showEvent).toBe(false);
      // Operational target/state changes never promote an optional Event to the main group.
    for (const state of [{ deliveryState: 'Failed' }, { completed: true }, { skipped: true }, { deleted: true }])
      expect(detailSchedulePresentation({ ...normal, nextAlertMs: start + 600_000, ...state }, start).showEvent).toBe(false);
    const noAlert = detailSchedulePresentation({ ...normal, mode: 'None' }, start);
    expect(noAlert.label).toBe('Scheduled for'); expect(noAlert.value).toBe(eventRange(normal, start));
  });
});
