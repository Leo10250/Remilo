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
  if (code.includes('STALE')) return 'This reminder or Calendar destination changed. Refresh the preview before publishing.';
  if (code.includes('NEEDS') || code.includes('AUTH')) return 'Connect or authorize Google Calendar, choose a calendar you own, and try again.';
  if (code.includes('INELIGIBLE')) return 'Only saved, unfinished one-off reminders can be published.';
  if (code.includes('INVALID_ZONE')) return 'Choose a named time zone for this reminder and refresh its publication preview.';
  if (code.includes('ALREADY')) return 'This reminder already has a captured publication. Open its Calendar status to continue.';
  return 'Calendar could not confirm this request. Check its saved status before retrying the same action.';
}
