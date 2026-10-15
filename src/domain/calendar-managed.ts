import type { CalendarReminderDisposition, CalendarReviewIssue, ManagedCalendarCommand, ManagedCalendarPreview, ManagedCalendarReviewItem, ManagedCalendarState } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarReviewReason } from './calendar-presentation';

export function managedCalendarStatus(state: ManagedCalendarState) {
  const phase = ({ NotConfigured: 'Not configured', Reviewing: 'Setup needs review', PreparingCalendar: 'Preparing Remilo calendar', InitialImport: 'Importing Calendar reminders',
    AccessRequired: 'Google access needed', CalendarUnavailable: 'Remilo calendar unavailable', OwnershipUnknown: 'Calendar ownership needs review', CreationUnconfirmed: 'Calendar creation not confirmed' } as Record<string, string>)[state.phase];
  return phase || (state.mode === 'Paused' ? 'Automatic sync paused' : state.mode === 'Disabled' ? 'Automatic sync disabled' : 'Remilo calendar · Automatic sync');
}
export function calendarDispositionLabel(value: CalendarReminderDisposition) {
  return ({ LocalOnly: 'Local only', Held: 'Not linked · Waiting to publish · Sync paused', WaitingToPublish: 'Not linked · Waiting to publish', Publishing: 'Google publication pending', Linked: 'Linked · Automatic sync',
    Ineligible: 'Calendar review needed', Unconfigured: 'Local only · Calendar not configured' } as const)[value.state];
}
export function managedCalendarCapture(preview: ManagedCalendarPreview, operationId: string, selectedItemIds: string[]): Extract<ManagedCalendarCommand, { selectedItemIds: string[] }> {
  const kind = ({ Setup: 'ConfirmManagedCalendarSetup', Policy: 'ApplyManagedCalendarPolicy', Resume: 'ResumeManagedCalendar', RecoveredAlerts: 'EnableRecoveredCalendarAlerts' } as const)[preview.kind];
  return { kind, operationId, previewId: preview.previewId, selectedItemIds: preview.items.filter(item => item.ready && selectedItemIds.includes(item.itemId)).map(item => item.itemId),
    ...(preview.kind === 'Setup' ? { selectedCalendarId: preview.selectedCalendarId } : {}) };
}
export function calendarReviewRoute(issue: CalendarReviewIssue) {
  if (issue.kind === 'Candidate') return { pathname: '/calendar-review' as const, params: { candidateId: issue.candidateId } };
  if (issue.kind === 'Setup') return { pathname: '/calendar' as const };
  return { pathname: '/calendar-manage' as const, params: { id: issue.occurrenceId } };
}
export function calendarReviewIssueText(issue: CalendarReviewIssue) {
  if (issue.kind === 'Candidate') return (['ReviewRequired', 'IdentityReview'].includes(issue.reason) ? 'Check the existing Calendar copy' : 'No Remilo alert yet') + (issue.calendarName ? ' · ' + issue.calendarName : '');
  if (issue.kind === 'Setup') return 'Calendar setup';
  return issue.affectedScopes?.length ? 'Affected occurrences: ' + issue.affectedScopes.join(', ') : 'Linked reminder';
}
export function calendarReviewIssueReason(issue: CalendarReviewIssue) {
  if (issue.kind === 'Candidate') {
    if (issue.reason === 'ElapsedAlert') return 'Choose a future alert or No alert before importing.';
    if (issue.reason === 'Unsupported') return 'This event is not supported for automatic import.';
    if (issue.reason === 'ReviewRequired' || issue.reason === 'IdentityReview') return 'Review the source identity before importing or linking a copy.';
    return 'Review this Google event before creating a Remilo reminder.';
  }
  if (issue.kind === 'Setup') {
    if (['UnconfirmedWrite', 'CreationUnconfirmed', 'CREATION_UNCONFIRMED'].includes(issue.reason)) return 'Calendar creation has not been confirmed. Inspect the original request before creating another calendar.';
    if (['OwnershipUnknown', 'OWNERSHIP_UNKNOWN'].includes(issue.reason)) return 'Calendar ownership could not be verified. Refresh access before enabling sync.';
  }
  return calendarReviewReason(issue.reason);
}
export function managedCalendarItemReason(item: Pick<ManagedCalendarReviewItem, 'kind' | 'reason'>) {
  if (item.kind === 'Import' && item.reason === 'ElapsedAlert') return 'No Remilo alert yet. Choose a future alert or No alert before importing.';
  if (item.kind === 'RecoveredAlert' && item.reason === 'ElapsedAlert') return 'This recovered reminder still has No alert. Review a future target before enabling an alarm.';
  return calendarReviewReason(item.reason);
}
