import type { CalendarFields, CalendarSelections, CalendarLinkedOperation } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export function resolvedCalendarFields(local: CalendarFields, remote: CalendarFields, selections: CalendarSelections): CalendarFields | null {
  if (!selections.title || !selections.notes || !selections.schedule) return null;
  return { title: selections.title === 'remilo' ? local.title : remote.title,
    notes: selections.notes === 'remilo' ? local.notes : remote.notes,
    schedule: selections.schedule === 'remilo' ? local.schedule : remote.schedule };
}
export function calendarOperationRetryable(job: CalendarLinkedOperation) {
  return !job.readOnly && ['Waiting', 'Unconfirmed', 'NeedsAccess', 'Blocked'].includes(job.state);
}
export function calendarCaptureRejected(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  return ['STALE', 'INELIGIBLE', 'INVALID_INPUT', 'OPERATION_REUSED', 'ALREADY_IMPORTED', 'OPERATION_PENDING',
    'TITLE_REQUIRED', 'ELAPSED_ALERT', 'IMPORT_LIMIT', 'RESOLUTION_REQUIRED', 'CONTENT_LIMIT', 'NOT_FOUND'].some(value => code.includes(value));
}
export function unsupportedCalendarReason(code: string) {
  return ({ RECURRING_EVENT: 'Recurring events are a later stage.', MEETING_EVENT: 'Meetings with attendees are not supported yet.',
    MULTI_DAY_EVENT: 'Only single-day all-day events are supported.', CONTENT_LIMIT: 'Shorten the title to 200 characters and notes to 10,000 in Google Calendar.',
    INVALID_ZONE: 'A supported named time zone is required.', INCOMPATIBLE_ZONES: 'Start and end need the same named time zone.',
    LOCKED_EVENT: 'This event is locked or a private copy.', SPECIAL_EVENT: 'This Calendar event type is not supported.',
    UNSPECIFIED_END: 'An explicit event end is required.', REMOTE_REMOVED: 'This event was removed or cancelled.',
    INVALID_EVENT: 'The event dates or fields cannot be imported.' } as Record<string, string>)[code] || 'This event cannot be imported.';
}
