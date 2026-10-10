/** Synthetic Calendar adapter: memory only, with no native authorization or HTTP capability. */
import type { CalendarCommand, CalendarConnection, CalendarPublication, CalendarPublicationPreview, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { deviceZone } from '../../src/domain/time';

export function previewCalendar(review: URLSearchParams, find: (id: string) => Occurrence | undefined, changed: () => void) {
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  const state = review.get('reviewCalendar') || 'connected';
  let connection: CalendarConnection = { revision: 1, connected: state !== 'disconnected', available: state !== 'unavailable', email: 'calendar-tester@example.test',
    calendarId: 'fixture-calendar', calendarName: 'Synthetic owned calendar / 测试日历', message: 'Synthetic preview. No Google requests can be sent.' };
  const jobs = new Map<string, CalendarPublication>(), captures = new Map<string, CalendarCommand>();
  const error = (code: string): never => { throw Object.assign(new Error('Synthetic Calendar: ' + code), { code }); };
  const preview = (id: string): CalendarPublicationPreview => {
    const item = find(id);
    if (!item) return error('NOT_FOUND');
    if (item.completed || item.deleted || item.skipped || item.segmentId) return error('INELIGIBLE');
    if ([...jobs.values()].some((job) => job.occurrenceId === id)) return error('ALREADY_PUBLISHED');
    if (!connection.connected || !connection.calendarId) return error('NEEDS_CONNECTION');
    return { occurrenceId: id, reminderRevision: item.revision, connectionRevision: connection.revision,
      fingerprint: `fixture-${item.revision}-${connection.revision}`, zoneId: item.zoneId || deviceZone(), pinsZone: !item.zoneId,
      title: item.title, notes: item.notes, eventStartMs: item.eventStartMs, eventEndMs: item.eventEndMs, allDay: item.allDay,
      email: connection.email, calendarName: connection.calendarName };
  };
  if (['Published', 'Unconfirmed', 'NeedsAccess', 'Failed', 'Conflict', 'Cancelled', 'Publishing'].includes(state)) {
    jobs.set('fixture-publication', { operationId: 'fixture-publication', occurrenceId: 'review', email: connection.email,
      calendarName: connection.calendarName, state: state as CalendarPublication['state'], message: 'Synthetic saved publication. No remote writes.',
      htmlLink: '', publishedAtMs: state === 'Published' ? Date.now() : null, differs: review.get('reviewCalendarDiffers') === '1', readOnly: false });
  }
  return {
    getCalendarConnection: async () => clone(connection),
    getCalendarPublications: async () => clone([...jobs.values()]),
    previewCalendarPublication: async (id: string) => clone(preview(id)),
    authorizeCalendar: async (_publicationId: string | null) => {
      // Deliberately no real authorization, even when a fixture action is pressed.
      if (review.get('reviewCalendarConsent') === 'cancel') return;
      if (review.get('reviewCalendarConsent') === 'denied') return error('AUTH');
      connection = { ...connection, connected: true, revision: connection.revision + 1 }; changed();
    },
    listOwnedCalendars: async (cursor: string | null) => ({ connectionRevision: connection.revision,
      items: state === 'empty' ? [] : [{ id: cursor ? 'fixture-calendar-2' : 'fixture-calendar', name: cursor ? 'Another owned calendar' : connection.calendarName, zoneId: 'America/Los_Angeles' }],
      nextCursor: !cursor && state !== 'empty' ? 'fixture-page-2' : null }),
    applyCalendarCommand: async (command: CalendarCommand): Promise<unknown> => {
      if (command.kind === 'RetryPublication') {
        const job = jobs.get(command.operationId); if (!job) return error('NOT_FOUND');
        if (review.get('reviewCalendarOffline') !== '1') jobs.set(job.operationId, { ...job, state: 'Published', message: 'Synthetic publication confirmed.' });
        changed(); return clone(jobs.get(job.operationId));
      }
      const prior = captures.get(command.operationId);
      if (prior) { if (JSON.stringify(prior) !== JSON.stringify(command)) return error('OPERATION_REUSED'); return clone(jobs.get(command.operationId) ?? connection); }
      if (command.kind === 'PublishOneOff') {
        const value = preview(command.occurrenceId);
        if (command.expectedRevision !== value.reminderRevision || command.expectedConnectionRevision !== value.connectionRevision || command.fingerprint !== value.fingerprint) return error('STALE_PREVIEW');
        jobs.set(command.operationId, { operationId: command.operationId, occurrenceId: command.occurrenceId, email: value.email,
          calendarName: value.calendarName, state: review.get('reviewCalendarOffline') === '1' ? 'Unconfirmed' : 'Published',
          message: 'Synthetic captured publication. No Google requests.', htmlLink: '', publishedAtMs: null, differs: false, readOnly: false });
      } else {
        if (command.expectedConnectionRevision !== connection.revision) return error('STALE_CONNECTION');
        connection = { ...connection, revision: connection.revision + 1, ...(command.kind === 'DisconnectCalendar' ? { connected: false } : { calendarId: command.calendarId, calendarName: command.calendarId === 'fixture-calendar-2' ? 'Another owned calendar' : 'Synthetic owned calendar / 测试日历' }) };
      }
      captures.set(command.operationId, clone(command)); changed();
      if (review.get('reviewLostReply') === '1') throw new Error('Synthetic Calendar reply lost after capture.');
      return clone(jobs.get(command.operationId) ?? connection);
    },
  };
}
