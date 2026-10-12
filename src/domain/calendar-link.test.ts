import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calendarCaptureRejected, calendarOperationRetryable, resolvedCalendarFields } from './calendar-link';
import { previewCalendar } from '../../verification/ui/preview-calendar';
import type { CalendarFields, CalendarLinkedOperation, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

const fields: CalendarFields = { title: 'Local', notes: 'Local notes', schedule: { eventStartMs: 1000, eventEndMs: 2000, allDay: false, zoneId: 'UTC' } };
describe('Calendar linked review', () => {
  it('requires a choice for every conflict and keeps schedule as one unit', () => {
    const remote = { ...fields, title: 'Google', notes: 'Google notes', schedule: { ...fields.schedule, eventStartMs: 3000, eventEndMs: 4000 } };
    expect(resolvedCalendarFields(fields, remote, { title: null, notes: 'remilo', schedule: 'google' })).toBeNull();
    expect(resolvedCalendarFields(fields, remote, { title: 'google', notes: 'remilo', schedule: 'google' })).toEqual({ title: 'Google', notes: 'Local notes', schedule: remote.schedule });
  });
  it('allows captured recovery only for unresolved operations with retained content', () => {
    for (const state of ['Waiting', 'Unconfirmed', 'NeedsAccess', 'Blocked'] as const) expect(calendarOperationRetryable({ state, readOnly: false } as CalendarLinkedOperation)).toBe(true);
    for (const state of ['Confirmed', 'Cancelled', 'Conflict', 'Failed'] as const) expect(calendarOperationRetryable({ state, readOnly: false } as CalendarLinkedOperation)).toBe(false);
    expect(calendarOperationRetryable({ state: 'Unconfirmed', readOnly: true } as CalendarLinkedOperation)).toBe(false);
    expect(calendarCaptureRejected({ code: 'STALE_PREVIEW' })).toBe(true);
    expect(calendarCaptureRejected({ code: 'NETWORK' })).toBe(false);
  });
  it('isolates the new fixtures from all remote and native side effects', () => {
    const source = readFileSync('verification/ui/preview-calendar-links.ts', 'utf8');
    expect(source).not.toMatch(/fetch\s*\(|XMLHttpRequest|https:\/\/|AuthorizationClient|requireNativeModule|axios|localStorage/);
  });
  it('keeps import defaults independent of publishing setup and preserves destination', async () => {
    const fixture = previewCalendar(new URLSearchParams('reviewCalendar=no-calendar'), () => undefined, () => {});
    const before = await fixture.getCalendarConnection();
    const p = await fixture.previewCalendarImport({ calendarId: 'source', eventId: 'one' }, {});
    expect(p.choices.mode).toBe('Alarm');
    expect(p.choices.disableReminders).not.toBe(true);
    await fixture.applyCalendarCommand({ kind: 'ImportCalendarEvent', previewId: p.previewId, operationId: 'import' });
    expect(await fixture.getCalendarConnection()).toEqual(before);
    expect(await fixture.getCalendarLinks()).toHaveLength(1);
  });
  it('keeps a lost reply operation frozen and rejects a replacement input', async () => {
    const fixture = previewCalendar(new URLSearchParams('reviewLostReply=1&reviewCalendarOffline=1'), () => undefined, () => {});
    const p = await fixture.previewCalendarImport({ calendarId: 'source', eventId: 'one' }, { disableReminders: true });
    const command = { kind: 'ImportCalendarEvent' as const, previewId: p.previewId, operationId: 'same' };
    await expect(fixture.applyCalendarCommand(command)).rejects.toThrow('reply lost');
    await fixture.applyCalendarCommand(command);
    expect(await fixture.getCalendarOperations()).toHaveLength(1);
    expect((await fixture.getCalendarOperations())[0].state).toBe('Unconfirmed');
    await expect(fixture.applyCalendarCommand({ ...command, previewId: 'replacement' })).rejects.toMatchObject({ code: 'OPERATION_REUSED' });
  });
  it('binds event browser revisions to deliberate account/calendar selection', async () => {
    const fixture = previewCalendar(new URLSearchParams(), () => undefined, () => {});
    const before = await fixture.getCalendarConnection();
    await fixture.applyCalendarCommand({ kind: 'SelectCalendar', operationId: 'select', calendarId: 'another', expectedConnectionRevision: before.revision });
    const page = await fixture.listCalendarEvents({ calendarId: 'source', from: '2026-10-12', until: '2026-11-11', cursor: null });
    expect(page.connectionRevision).toBe((await fixture.getCalendarConnection()).revision);
    expect(page.items.some(item => item.unsupportedReason === 'RECURRING_EVENT')).toBe(true);
    await expect(fixture.listCalendarEvents({ calendarId: 'source', from: '2026-10-12', until: '2028-11-11', cursor: null })).rejects.toMatchObject({ code: 'INVALID_RANGE' });
  });
  it('keeps selected local title when choosing Google notes and reports the actual local mode', async () => {
    const item = { id: 'review', title: 'Keep this local title', notes: 'Local notes', mode: 'None',
      eventStartMs: 1000, eventEndMs: 2000, dueAtMs: 1000, alarmAtMs: 1000, zoneId: 'UTC' } as Occurrence;
    let received: CalendarFields | undefined;
    const fixture = previewCalendar(new URLSearchParams('reviewCalendarLink=conflict'), () => item, () => {},
      (fields) => { received = fields; return item; });
    const preview = await fixture.previewCalendarUpdate('review');
    await fixture.applyCalendarCommand({ kind: 'ApplyCalendarResolution', previewId: preview.previewId, operationId: 'resolve',
      selections: { title: 'remilo', notes: 'google', schedule: 'remilo' } });
    expect(received?.title).toBe(item.title);
    expect(received?.notes).toBe('Google changed notes');
    expect((await fixture.getCalendarOperations())[0].localStatus).toBe('Applied');
  });
});
