import { describe, expect, it } from 'vitest';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { agendaAlertPresentation, alertPresentation, calendarDate, canAdjustAlert, deliveryExplanation, eventRange, nextAlertTime, ordinaryDue, recordedCompletionTime, scheduleDateTime, scheduleNeedsDetails, stateIcon, stateLabel, type ScheduleItem } from './presentation';
import { deviceZone } from './time';

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
    expect(stateLabel({ ...item, mode: 'Notification', deliveryState: 'Missed' })).toBe('Notification missed');
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
