import type { CalendarCommand, CalendarPublication, CalendarPublicationPreview } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export function publicationCommand(preview: CalendarPublicationPreview, operationId: string): CalendarCommand {
  return { kind: 'PublishOneOff', operationId, occurrenceId: preview.occurrenceId,
    expectedRevision: preview.reminderRevision, expectedConnectionRevision: preview.connectionRevision, fingerprint: preview.fingerprint };
}
export function canRetryPublication(publication: CalendarPublication) {
  return ['Waiting', 'Unconfirmed', 'NeedsAccess', 'Failed'].includes(publication.state);
}
export function calendarError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code.includes('STALE_CURSOR')) return 'The account or date range changed. Browse events again before loading another page.';
  if (code.includes('STALE')) return 'This reminder or Google Calendar version changed. Refresh the review before confirming.';
  if (code.includes('OPERATION_PENDING')) return 'This event has an unresolved operation. Continue its saved request before reviewing another change.';
  if (code.includes('ALREADY_IMPORTED')) return 'This event is already associated with a Remilo reminder. Open that reminder.';
  if (code.includes('TITLE_REQUIRED')) return 'Enter a title before importing this event.';
  if (code.includes('INVALID_RANGE')) return 'Choose an end date after the start, with a range of at most 366 days.';
  if (code.includes('RESOLUTION_REQUIRED')) return 'Choose Remilo or Google values for each field before confirming.';
  if (code.includes('NEEDS_CONNECTION')) return 'Publishing needs both a connected Google account and a selected calendar. Open Calendar settings to finish setup.';
  if (code.includes('NEEDS') || code.includes('AUTH')) return 'Connect or authorize Google Calendar, choose a calendar you own, and try again.';
  if (code.includes('INELIGIBLE')) return 'Only saved, unfinished one-off reminders can be published or updated. Keep terminal reminders as local records.';
  if (code.includes('INVALID_ZONE')) return 'Choose a named time zone for this reminder and refresh its publication preview.';
  if (code.includes('ALREADY')) return 'This reminder already has a captured publication. Open its Calendar status to continue.';
  return 'Calendar could not confirm this request. Check its saved status before retrying the same action.';
}
