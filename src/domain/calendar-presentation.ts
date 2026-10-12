import type { CalendarLink, CalendarLinkedOperation, CalendarPublication, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export const calendarImportIndependence = 'This creates a Remilo reminder with its own alert. Deleting the Google event will not stop that alert. Move the reminder to Trash in Remilo to stop it.';
export function calendarCancellation(item: Pick<Occurrence, 'mode' | 'deleted' | 'completed' | 'skipped'>, link?: CalendarLink) {
  if (!link || link.state === 'Detached' || link.availability !== 'Deleted' || item.deleted || item.completed || item.skipped) return null;
  return item.mode === 'None' ? { row: 'Google event deleted · Reminder kept', detail: 'Google event deleted. This reminder is kept; no Remilo alert is set.' } :
    item.mode === 'Notification' ? { row: 'Google event deleted · Remilo notification unchanged', detail: 'Google event deleted. Your Remilo notification is unchanged.' } :
      { row: 'Google event deleted · Remilo alarm unchanged', detail: 'Google event deleted. Your Remilo alarm is unchanged.' };
}
export function currentCalendarOperations(jobs: readonly CalendarLinkedOperation[]) {
  return jobs.filter(job => ['Waiting', 'Sending', 'Unconfirmed', 'NeedsAccess', 'Blocked'].includes(job.state));
}
export function calendarSummary(link?: CalendarLink, publication?: CalendarPublication, jobs: readonly CalendarLinkedOperation[] = []) {
  if (link?.state === 'Detached') return 'Unlinked';
  if (link?.availability === 'Deleted') return 'Google event deleted';
  if (link?.state === 'NeedsAccess' || link?.source === null) return 'Google access needed';
  if (link?.availability === 'Unavailable') return 'Google event unavailable';
  if (link?.availability === 'Unsupported') return 'Calendar updates suspended';
  const pending = currentCalendarOperations(jobs);
  if (pending.some(job => job.localApplied && job.state === 'Unconfirmed')) return 'Google update not confirmed';
  if (pending.length) return 'Request pending';
  if (link?.differs || link?.remoteDiffers) return 'Changes to review';
  if (link?.requiresReview) return 'Review linked updates';
  if (link) return link.observedAtMs == null ? 'Linked · Check for changes' : 'Linked';
  if (publication?.state === 'Published') return 'Published copy';
  if (publication?.state === 'NeedsAccess') return 'Google access needed';
  if (publication?.state === 'Unconfirmed') return 'Google publication not confirmed';
  if (publication) return ['Waiting', 'Publishing'].includes(publication.state) ? 'Request pending' : 'Publication needs attention';
  return 'Calendar request';
}
export function calendarCheckFailure(code: string) {
  return ({ AUTH: 'Google authorization is needed.', NEEDS_ACCESS: 'Reconnect the original Google account.', ACCOUNT_MISMATCH: 'Use the original Google account for this link.',
    NETWORK: 'The latest check could not reach Google.', RETRY: 'Google could not complete the latest check. Try again later.',
    NOT_AVAILABLE: 'The latest check could not finish.', STORAGE_ERROR: 'The latest check could not be saved.' } as Record<string, string>)[code] || 'The latest check could not finish.';
}
