import { describe, expect, it } from 'vitest';
import type { CalendarEventPage, CalendarEventQuery, CalendarLink, CalendarLinkedOperation } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarImportRange, collectCalendarImports, excludedCalendarImports, orderedCalendarImportDates, remainingCalendarImports } from './calendar-import';
import { previewCalendar } from '../../verification/ui/preview-calendar';

const row = (eventId: string, unsupportedReason: string | null = null) => ({ eventId, title: eventId, unsupportedReason, fields: null, occurrenceId: null, erased: false });
const query: CalendarEventQuery = { calendarId: 'source', from: '2026-10-12', until: '2026-11-11', cursor: null };
describe('Calendar import browser and all-range capture', () => {
  it('includes both selected dates and counts local calendar days through a DST transition', () => {
    const range = calendarImportRange(Date.parse('2026-10-31T00:00:00-07:00'), Date.parse('2026-11-02T00:00:00-08:00'), 'America/Los_Angeles');
    expect(range).toEqual({ from: '2026-10-31', until: '2026-11-03', days: 3, valid: true });
    expect(calendarImportRange(Date.parse('2026-11-01T00:00:00-07:00'), Date.parse('2026-11-01T00:00:00-07:00'), 'America/Los_Angeles').days).toBe(1);
  });
  it('keeps the earlier selected date first and rejects ranges beyond 366 days', () => {
    expect(orderedCalendarImportDates(1000, 2000, 'start', 3000)).toEqual({ start: 3000, end: 3000 });
    expect(orderedCalendarImportDates(1000, 2000, 'end', 500)).toEqual({ start: 500, end: 500 });
    expect(calendarImportRange(Date.parse('2026-01-01'), Date.parse('2027-01-02'), 'UTC').valid).toBe(false);
  });
  it('hides retained links, erased records and captured pending imports while preserving unrelated accounts and calendars', () => {
    const links = [{ source: { calendarId: 'source', eventId: 'linked' }, state: 'Detached' }, { source: null }, { source: { calendarId: 'other', eventId: 'different' } }] as CalendarLink[];
    const jobs = [{ source: { calendarId: 'source', eventId: 'pending' }, state: 'Waiting', localApplied: false },
      { source: { calendarId: 'source', eventId: 'conflict' }, state: 'Conflict', localApplied: false }] as CalendarLinkedOperation[];
    const excluded = excludedCalendarImports('source', links, jobs);
    expect(remainingCalendarImports([row('linked'), row('pending'), row('different'), row('conflict'), { ...row('old'), occurrenceId: 'record' }, { ...row('purged'), erased: true }], excluded).map(item => item.eventId)).toEqual(['different', 'conflict']);
  });
  it('collects every page through unsupported-only pages, deduplicating and excluding imports', async () => {
    const visited: (string | null)[] = [];
    const list = async (q: typeof query): Promise<CalendarEventPage> => {
      visited.push(q.cursor);
      return { connectionRevision: 4, calendarName: 'source', nextCursor: q.cursor === 'last' ? null : q.cursor === 'next' ? 'last' : 'next',
        items: q.cursor === 'next' ? [row('meeting', 'MEETING_EVENT')] : q.cursor === 'last' ? [row('first'), row('second')] : [row('linked'), row('first')] };
    };
    expect((await collectCalendarImports(query, 4, list, new Set(['linked']), () => true, () => {})).map(item => item.eventId)).toEqual(['first', 'second']);
    expect(visited).toEqual([null, 'next', 'last']);
  });
  it('rejects stale accounts and cyclic cursors instead of confirming an incomplete all-range list', async () => {
    const page = { items: [], nextCursor: 'same', connectionRevision: 2, calendarName: 'source' };
    await expect(collectCalendarImports(query, 1, async () => page, new Set(), () => true, () => {})).rejects.toMatchObject({ code: 'STALE_CONNECTION' });
    await expect(collectCalendarImports(query, 2, async () => page, new Set(), () => true, () => {})).rejects.toMatchObject({ code: 'STALE_CURSOR' });
  });
  it('recovers a lost batch reply without duplicating any imported event and hides its saved rows', async () => {
    const fixture = previewCalendar(new URLSearchParams('reviewCalendarBulk=1&reviewLostReply=1'), () => undefined, () => {});
    const events = await collectCalendarImports(query, 1, q => fixture.listCalendarEvents(q), new Set(), () => true, () => {});
    expect(events).toHaveLength(3);
    const reviews = await Promise.all(events.map(event => fixture.previewCalendarImport({ calendarId: 'source', eventId: event.eventId }, {})));
    const command = { kind: 'ImportCalendarEvents' as const, operationId: 'all', items: reviews.map(p => ({ previewId: p.previewId, choices: { mode: 'None' as const } })) };
    await expect(fixture.applyCalendarCommand(command)).rejects.toThrow('batch reply lost');
    await fixture.applyCalendarCommand(command);
    expect(await fixture.getCalendarOperations()).toHaveLength(3);
    const excluded = excludedCalendarImports('source', await fixture.getCalendarLinks(), await fixture.getCalendarOperations());
    expect(remainingCalendarImports(events, excluded)).toEqual([]);
    await expect(fixture.applyCalendarCommand({ ...command, items: command.items.slice(1) })).rejects.toMatchObject({ code: 'OPERATION_REUSED' });
  });
});
