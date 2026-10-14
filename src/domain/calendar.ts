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
  if (code.includes('CREATION_UNCONFIRMED')) return 'Calendar creation has not been confirmed. Check the original request result before reviewing a replacement.';
  if (code.includes('DISCOVERY_INCOMPLETE')) return 'Calendar discovery is incomplete. Refresh the review before choosing or creating a calendar.';
  if (code.includes('SELECTION_REQUIRED')) return 'Choose the Remilo calendar to use before confirming setup.';
  if (code.includes('OWNERSHIP_UNKNOWN')) return 'Google did not confirm calendar ownership. Refresh access before enabling automatic sync.';
  if (code.includes('NOT_OWNER')) return 'The source calendar must be owned by the connected Google account.';
  if (code.includes('UNSUPPORTED_RECURRENCE')) return 'This repeat cannot be imported safely. The Google event is kept.';
  if (code.includes('MEETING_EVENT')) return 'Events with attendees are not supported for automatic import. The Google event is kept.';
  if (code.includes('REVIEW_REQUIRED')) return 'Review this Calendar relationship before granting automatic update permission.';
  if (code.includes('STALE_CURSOR')) return 'The account or date range changed. Browse events again before loading another page.';
  if (code.includes('STALE')) return 'This reminder or Google Calendar version changed. Refresh the review before confirming.';
  if (code.includes('OPERATION_PENDING')) return 'This event has an unresolved operation. Continue its saved request before reviewing another change.';
  if (code.includes('ALREADY_IMPORTED')) return 'This event is already in Remilo. Refresh the list or review to remove it.';
  if (code.includes('TITLE_REQUIRED')) return 'Enter a title before importing this event.';
  if (code.includes('ELAPSED_ALERT')) return 'An alert has elapsed. Review a future alert time or explicitly choose No alert.';
  if (code.includes('IMPORT_LIMIT')) return 'There are too many events to review together. Narrow the date range and try again.';
  if (code.includes('INVALID_RANGE')) return 'Choose an end date after the start, with a range of at most 366 days.';
  if (code.includes('RESOLUTION_REQUIRED')) return 'Choose Remilo or Google values for each field before confirming.';
  if (code.includes('NEEDS_CONNECTION')) return 'Publishing needs both a connected Google account and a selected calendar. Open Calendar settings to finish setup.';
  if (code.includes('NEEDS') || code.includes('AUTH')) return 'Connect or authorize Google Calendar, choose a calendar you own, and try again.';
  if (code.includes('INELIGIBLE')) return 'This item is not eligible for the requested Calendar action. Keep terminal reminders as local records and review current Calendar status.';
  if (code.includes('INVALID_ZONE')) return 'Choose a named time zone for this reminder and refresh its publication preview.';
  if (code.includes('ALREADY')) return 'This reminder already has a captured publication. Open its Calendar status to continue.';
  return 'Calendar could not confirm this request. Check its saved status before retrying the same action.';
}
