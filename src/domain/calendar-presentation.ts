import type { CalendarLink, CalendarLinkedOperation, CalendarPublication, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export const calendarImportIndependence = 'This creates a Remilo reminder with its own alert. Deleting the Google event will not stop that alert. Move the reminder to Trash in Remilo to stop it.';
export function calendarCancellation(item: Pick<Occurrence, 'mode' | 'deleted' | 'completed' | 'skipped'> & Partial<Pick<Occurrence, 'segmentId' | 'nominalSlot'>>, link?: CalendarLink) {
  const cancelledInstance = link?.cancelledInstances?.some(scope => scope.segmentId === item.segmentId && scope.nominalSlot === item.nominalSlot);
  if (!link || link.state === 'Detached' || link.availability !== 'Deleted' && !cancelledInstance || item.deleted || item.completed || item.skipped) return null;
  return item.mode === 'None' ? { row: 'Google event deleted · Reminder kept', detail: 'Google event deleted. This reminder is kept; no Remilo alert is set.' } :
    item.mode === 'Notification' ? { row: 'Google event deleted · Remilo notification unchanged', detail: 'Google event deleted. Your Remilo notification is unchanged.' } :
      { row: 'Google event deleted · Remilo alarm unchanged', detail: 'Google event deleted. Your Remilo alarm is unchanged.' };
}
export function currentCalendarOperations(jobs: readonly CalendarLinkedOperation[]) {
  return jobs.filter(job => ['Waiting', 'Sending', 'Unconfirmed', 'NeedsAccess', 'Blocked'].includes(job.state));
}
export function calendarSummary(link?: CalendarLink, publication?: CalendarPublication, jobs: readonly CalendarLinkedOperation[] = []) {
  if (link?.state === 'Detached') return 'Not linked · Updates stopped';
  const pending = currentCalendarOperations(jobs);
  if (link?.syncStatus === 'Unconfirmed' || pending.some(job => job.remoteAttempted && job.state === 'Unconfirmed')) return 'Google update not confirmed';
  if (link?.syncStatus === 'Review') return 'Changes need review';
  if (link && (link.syncStatus === 'Paused' || link.requiresReview || ['Deleted', 'Unavailable', 'Unsupported'].includes(link.availability) || link.state === 'NeedsAccess' || link.source === null)) return 'Sync paused';
  if (pending.length || link?.syncStatus === 'UpdatePending' || link?.syncStatus === 'Deferred' || link?.syncMode === 'Pending' || link?.syncMode === 'Automatic' && (link.differs || link.remoteDiffers)) return 'Update pending';
  if (link) return link.syncMode === 'Automatic' ? 'Linked · Automatic sync' : 'Linked · Manual updates';
  if (publication?.state === 'Published') return 'Not linked · Published once';
  if (publication?.state === 'NeedsAccess') return 'Google access needed';
  if (publication?.state === 'Unconfirmed') return 'Google publication not confirmed';
  if (publication) return ['Waiting', 'Publishing'].includes(publication.state) ? 'Request pending' : 'Publication needs attention';
  return 'Not linked';
}
export function calendarReviewReason(reason?: string) {
  return ({ Ringing: 'A schedule update is waiting for ringing to end.', ChangesNeedReview: 'Both copies changed. Review the values to keep.', UnconfirmedWrite: 'The sent Google update has not been confirmed.',
    ElapsedAlert: 'The proposed alert has elapsed. Your current local target is kept.', AccessRequired: 'Reconnect the original Google account.', AccountChanged: 'Review access to the original Google account.',
    NotOwner: 'This source calendar is no longer owned by the connected account.', RemoteDeleted: 'The Google event was deleted. Your local reminder and alert are kept.', RemoteUnavailable: 'The Google event could not be accessed.',
    Unsupported: 'This event is no longer supported for linked updates.', LocalTerminal: 'This local work is finished or removed.', LocalRemoved: 'This reminder was removed locally.', Unlinked: 'Linked updates have stopped.',
    StaleAuthorization: 'A fresh review is needed before transfers resume.', InvalidTiming: 'The proposed schedule needs review.', ContentRequired: 'The proposed content needs review.', ReviewRequired: 'A fresh review is needed.' } as Record<string, string>)[reason || ''] || 'A fresh review is needed before updates resume.';
}
export function calendarRowNotice(link?: CalendarLink) {
  if (!link || link.state === 'Detached') return null;
  if (link.syncStatus === 'Review') return 'Calendar changes need review';
  if (link.syncStatus === 'Unconfirmed') return 'Google update not confirmed';
  if (link.syncStatus === 'Paused') return 'Calendar sync paused';
  if (link.syncStatus === 'UpdatePending' || link.syncStatus === 'Deferred') return 'Calendar update pending';
  return null;
}
export function calendarCheckFailure(code: string) {
  return ({ AUTH: 'Google authorization is needed.', NEEDS_ACCESS: 'Reconnect the original Google account.', ACCOUNT_MISMATCH: 'Use the original Google account for this link.',
    NETWORK: 'The latest check could not reach Google.', RETRY: 'Google could not complete the latest check. Try again later.',
    NOT_AVAILABLE: 'The latest check could not finish.', STORAGE_ERROR: 'The latest check could not be saved.' } as Record<string, string>)[code] || 'The latest check could not finish.';
}
