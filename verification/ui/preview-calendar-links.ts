/** Memory-only P4-B fixtures. No authorization, HTTPS, durable storage or native scheduler. */
import type { CalendarCommand, CalendarFields, CalendarImportChoices, CalendarLink, CalendarLinkedOperation, CalendarLinkPreview, CalendarEventQuery, CalendarEventRef, CalendarSelections, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { resolvedCalendarFields } from '../../src/domain/calendar-link';

export function previewCalendarLinks(review: URLSearchParams, find: (id: string) => Occurrence | undefined, changed: () => void,
  save?: (fields: CalendarFields, choices: CalendarImportChoices, operationId: string, id?: string) => Occurrence,
  connectionRevision: () => number = () => 1) {
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  const error = (code: string): never => { throw Object.assign(new Error('Synthetic link: ' + code), { code }); };
  const scenario = review.get('reviewCalendarLink');
  const previews = new Map<string, CalendarLinkPreview>(), links = new Map<string, CalendarLink>(), jobs = new Map<string, CalendarLinkedOperation>();
  const receipts = new Map<string, string>(); let count = 0;
  const fields = (item?: Occurrence): CalendarFields => ({ title: item?.title || 'A personal Calendar event / 私人日程',
    notes: item?.notes || 'Synthetic notes. No Google requests.', schedule: { eventStartMs: item?.eventStartMs || Date.now() + 3_600_000,
      eventEndMs: item?.eventEndMs || Date.now() + 5_400_000, allDay: item?.allDay || false, zoneId: item?.zoneId || 'America/Los_Angeles' } });
  const remote = fields();
  if (review.get('reviewText') === 'long') {
    remote.title = 'Review the complete project proposal and supporting materials / 审阅完整项目计划与支持材料';
    remote.notes = 'Preserve these personal notes exactly. 请保留完整的个人备注。\n'.repeat(20);
  }
  if (scenario === 'all-day') { const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + 1); remote.schedule = { ...remote.schedule, eventStartMs: day.getTime(), eventEndMs: day.getTime() + 86_400_000, allDay: true }; }
  if (scenario === 'conflict') links.set('review', { occurrenceId: 'review', revision: 1, calendarName: 'Synthetic source / 测试日历', state: 'Linked', checkedAtMs: Date.now(), message: 'Synthetic conflict. Manual review required.', htmlLink: '', readOnly: false, differs: true });
  const preview = (id: string | null, choices: CalendarImportChoices = {}): CalendarLinkPreview => {
    const item = id ? find(id) : undefined;
    if (id && (!item || item.completed || item.deleted || item.skipped || item.segmentId)) return error('INELIGIBLE');
    const local = id ? fields(item) : null, google = id ? fields(item) : clone(remote);
    if (id && scenario === 'conflict') { google.title = 'Google changed title / 新标题'; google.notes = 'Google changed notes'; }
    const defaults: CalendarSelections = { title: 'remilo', notes: 'remilo', schedule: 'remilo' };
    if (id && scenario === 'conflict') { defaults.title = null; defaults.notes = null; }
    const defaultAlarm = google.schedule.allDay ? google.schedule.eventStartMs + 9 * 3_600_000 : google.schedule.eventStartMs;
    const result: CalendarLinkPreview = { previewId: 'synthetic-review-' + ++count, occurrenceId: id || '', calendarName: 'Synthetic source / 测试日历',
      email: 'calendar-tester@example.test', remote: google, local, baseline: local ? { ...clone(local), title: 'Last confirmed title', notes: 'Last confirmed notes' } : null,
      selections: id ? defaults : null, choices: { ...choices, mode: choices.mode || 'Alarm', title: choices.title ?? google.title,
        alarmAtMs: choices.alarmAtMs ?? defaultAlarm, dueAtMs: google.schedule.allDay ? google.schedule.eventEndMs : google.schedule.eventStartMs },
      googleReminders: true, checkedAtMs: Date.now(), nextAlertMs: item?.alertAdjustment ? item.nextAlertMs : null,
      timings: item ? { remilo: { mode: item.mode, dueAtMs: item.dueAtMs, alarmAtMs: item.alarmAtMs }, google: { mode: item.mode, dueAtMs: item.dueAtMs, alarmAtMs: item.alarmAtMs } } : null };
    previews.set(result.previewId, clone(result)); return clone(result);
  };
  return {
    getCalendarLinks: async () => clone([...links.values()]),
    getCalendarOperations: async () => clone([...jobs.values()]),
    listCalendarEvents: async (query: CalendarEventQuery) => {
      const days = (Date.parse(query.until) - Date.parse(query.from)) / 86_400_000;
      if (!(days > 0 && days <= 366)) return error('INVALID_RANGE');
      return { connectionRevision: connectionRevision(), calendarName: 'Synthetic source / 测试日历',
        items: [{ eventId: 'personal', title: remote.title, fields: clone(remote), unsupportedReason: null, occurrenceId: [...links.keys()].find(id => id !== 'review') || null, erased: false },
          { eventId: 'meeting', title: 'Meeting with attendees', fields: null, unsupportedReason: 'MEETING_EVENT', occurrenceId: null, erased: false },
          { eventId: 'repeat', title: 'Recurring event', fields: null, unsupportedReason: 'RECURRING_EVENT', occurrenceId: null, erased: false }], nextCursor: query.cursor ? null : 'synthetic-next' };
    },
    previewCalendarImport: async (_event: CalendarEventRef, choices: CalendarImportChoices) => preview(null, choices),
    previewCalendarLink: async (id: string) => preview(id),
    previewCalendarUpdate: async (id: string) => preview(id),
    applyCalendarLinked: async (command: CalendarCommand): Promise<unknown> => {
      if (command.kind === 'RetryCalendarOperation') {
        const job = jobs.get(command.operationId); if (!job) return error('NOT_FOUND');
        if (review.get('reviewCalendarOffline') !== '1') jobs.set(job.operationId, { ...job, state: 'Confirmed', message: 'Synthetic outcome confirmed. No Google write.' });
        changed(); return clone(jobs.get(job.operationId));
      }
      const input = JSON.stringify(command), prior = receipts.get(command.operationId);
      if (prior) { if (prior !== input) return error('OPERATION_REUSED'); return clone(jobs.get(command.operationId) || { unlinked: true }); }
      if (command.kind === 'UnlinkCalendar') {
        const old = links.get(command.occurrenceId); if (!old || old.revision !== command.expectedLinkRevision) return error('STALE_PREVIEW');
        links.set(old.occurrenceId, { ...old, revision: old.revision + 1, state: 'Detached', message: 'Unlinked. Both copies retained.' });
        receipts.set(command.operationId, input); changed(); return { unlinked: true };
      }
      if (!('previewId' in command)) return error('INVALID_INPUT');
      const p = previews.get(command.previewId); if (!p) return error('STALE_PREVIEW');
      const values = p.local ? resolvedCalendarFields(p.local, p.remote, command.selections || { title: null, notes: null, schedule: null }) : p.remote;
      if (!values) return error('RESOLUTION_REQUIRED');
      const item = save?.(p.local ? values : { ...values, title: p.choices.title || values.title }, p.choices, command.operationId, p.occurrenceId || undefined);
      const id = item?.id || p.occurrenceId || 'synthetic-import-' + ++count;
      const blocked = scenario === 'blocked', partial = scenario === 'partial' || review.get('reviewCalendarOffline') === '1';
      links.set(id, { occurrenceId: id, revision: 1, calendarName: p.calendarName, state: 'Linked', checkedAtMs: Date.now(), message: 'Synthetic manually linked reminder.', htmlLink: '', readOnly: false, differs: false });
      const job: CalendarLinkedOperation = { operationId: command.operationId, occurrenceId: id, kind: command.kind, calendarName: p.calendarName,
        state: blocked ? 'Blocked' : partial ? 'Unconfirmed' : 'Confirmed', localApplied: true, localStatus: blocked ? 'Blocked' : (item?.mode || p.choices.mode) === 'None' ? 'Applied' : 'Scheduled',
        remoteAttempted: partial, readOnly: false, message: blocked ? 'Google reminders remain. Resolve alert readiness, then retry.' : partial ? 'Local changes saved. Google outcome unconfirmed. Retry the same operation.' : 'Local and Google outcomes confirmed in memory only.' };
      jobs.set(command.operationId, job); receipts.set(command.operationId, input); changed();
      if (review.get('reviewLostReply') === '1') throw new Error('Synthetic reply lost after durable-capture substitute.');
      return clone(job);
    },
  };
}
