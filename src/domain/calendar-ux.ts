import type { CalendarConnection, CalendarLink, CalendarLinkedOperation, CalendarOperationStatus, CalendarRecoveryAction, ManagedCalendarState } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from './actions';
import { calendarReviewReason } from './calendar-presentation';

export type CalendarStatusPresentation = { title: string; description: string; label: string; action: CalendarRecoveryAction | 'Setup' | 'Progress' | 'Sync'; warning: boolean; tone?: Tone };
export function calendarStatusPresentation(connection: CalendarConnection, state: ManagedCalendarState): CalendarStatusPresentation {
  const source = state.calendarName || 'your Remilo calendar';
  if (!connection.connected) return { title: 'Connect Google Calendar', description: 'Allow Remilo to read and update a dedicated Remilo calendar. Your local reminders keep working.', label: 'Connect Google', action: 'Connect', warning: false };
  if (state.phase === 'AccessRequired') return { title: 'Google access needs attention', description: `Remilo couldn’t confirm access to ${source}. Continue with the original Google account.`, label: state.problem?.action === 'Authorize' ? 'Continue authorization' : 'Reconnect Google', action: state.problem?.action === 'Authorize' ? 'Authorize' : 'Connect', warning: true, tone: 'danger' };
  if (state.phase === 'CreationUnconfirmed') return { title: 'Calendar creation isn’t confirmed', description: 'Google may already have created the calendar. Check the original request before creating another.', label: 'Check creation result', action: 'InspectCreation', warning: true };
  if (state.phase === 'CalendarUnavailable') return { title: 'Can’t access your Remilo calendar', description: `${source} couldn’t be reached. Check access before reviewing a replacement. Local alerts continue.`, label: 'Check calendar access', action: 'ReviewSetup', warning: true };
  if (state.phase === 'OwnershipUnknown') return { title: 'Calendar ownership isn’t verified', description: 'Remilo needs a secondary calendar owned by this Google account. Google hasn’t confirmed that ownership.', label: 'Check ownership again', action: 'ReviewSetup', warning: true };
  if (state.mode === 'Paused') return { title: 'Calendar sync is paused', description: 'Local alerts continue. Review queued changes before resuming.', label: 'Review and resume', action: 'Resume', warning: false };
  if (state.phase === 'Reviewing' && state.calendarId && state.mode !== 'Disabled') return { title: 'Review before resuming sync', description: 'Google access is connected. Review current events and queued changes before sync resumes.', label: 'Review and resume', action: 'Resume', warning: false };
  if (['PreparingCalendar', 'InitialImport'].includes(state.phase) || state.mode === 'Enabled' && !!state.progress?.pending) return { title: state.phase === 'PreparingCalendar' ? 'Preparing your Remilo calendar' : state.progress?.scanComplete ? 'Adding reminders and updates' : 'Checking existing events', description: 'You can keep using Remilo while this work continues.', label: 'View progress', action: 'Progress', warning: false };
  if (state.mode === 'Disabled' || ['NotConfigured', 'Reviewing'].includes(state.phase)) return { title: state.calendarId ? 'Calendar sync is off' : 'Finish Calendar setup', description: state.calendarId ? 'Both copies are kept. Review setup to turn sync on again.' : 'Choose your Remilo calendar and how events and reminders should sync.', label: state.problem?.reason === 'CALENDAR_SELECTION_REQUIRED' ? 'Choose calendar' : 'Continue setup', action: 'Setup', warning: false };
  const review = state.progress?.review ?? state.reviewCount;
  return { title: 'Automatic sync on', description: review ? `${review} ${review === 1 ? 'item needs' : 'items need'} your review. Other ready work can continue.` : '', label: review ? 'Review items' : 'Sync now', action: review ? 'ReviewItems' : 'Sync', warning: !!review };
}
export function calendarOperationTitle(status: CalendarOperationStatus) {
  if (status.syncResult) return calendarSyncOutcome(status).title;
  return ({ Waiting: 'Waiting to start', PreparingCalendar: 'Preparing your Remilo calendar', CreatingCalendar: 'Creating your Remilo calendar', CheckingCalendar: 'Checking calendar access', CheckingEvents: 'Checking existing events', AddingReminders: 'Adding reminders and updates',
    Confirmed: status.kind === 'Setup' ? 'Calendar sync is on' : 'Reviewed work finished', NeedsReview: 'Some items need review', NeedsAccess: 'Google access needs attention',
    Unconfirmed: 'Calendar creation isn’t confirmed', Paused: 'Calendar sync is paused', Cancelled: 'This request is no longer active', AwaitingAuthorization: 'Finish connecting in Google', Authorized: 'Google access confirmed', Failed: 'Google access wasn’t confirmed' })[status.stage];
}
export function calendarTransferText(inbound: string[] = [], outbound: string[] = [], equal = false) {
  const names: Record<string, string> = { title: 'title', notes: 'notes', schedule: 'event time', Title: 'title', Notes: 'notes', Schedule: 'event time' };
  const fields = (values: string[]) => values.map(value => names[value] || value).join(', ');
  return [inbound.length ? `Update ${fields(inbound)} in Remilo` : '', outbound.length ? `Update ${fields(outbound)} in Google` : ''].filter(Boolean).join(' · ') || (equal ? 'Already matches' : 'Automatic sync included');
}

export function calendarSyncOutcome(status: CalendarOperationStatus): { title: string; description: string; tone: Tone } {
  const result = status.syncResult;
  const values = {
    Checking: ['Checking for changes…', 'You can keep using Remilo.', 'muted'],
    NoChanges: ['No changes found', 'The requested Calendar check finished.', 'success'],
    Synced: ['Changes synced', result?.changed ? `${result.changed} ${result.changed === 1 ? 'reminder updated' : 'reminders updated'}.` : 'The requested changes are confirmed.', 'success'],
    Pending: ['Updates waiting', status.reason === 'NETWORK' ? 'Waiting for a connection. Local alerts continue.' : 'More work remains. Remilo will continue when it can.', 'muted'],
    NeedsReview: ['Some items need review', 'Choose how to handle these changes. Local alerts are kept.', 'warning'],
    AccessRequired: ['Google access needed', 'Reconnect Google before Calendar work can continue.', 'danger'],
    Unconfirmed: ['Google update not confirmed', 'Check the existing update before trying another write.', 'warning'],
    Paused: ['Calendar sync is paused', 'Local alerts continue. Review queued work before resuming.', 'muted'],
    Failed: ['Calendar check couldn’t finish', 'Review the problem before trying again.', 'danger'],
    ScopeChanged: ['This check is no longer active', 'The account, link or permission changed.', 'muted'],
    NotChecked: ['Check not finished', 'No complete check is recorded for this request.', 'muted'],
  } as const;
  const [title, description, tone] = values[result?.outcome ?? 'NotChecked'];
  return { title, description, tone };
}
export function calendarLinkStatus(link: CalendarLink, jobs: readonly CalendarLinkedOperation[] = [], managed?: ManagedCalendarState): { title: string; description: string; tone: Tone; action: 'None' | 'Connect' | 'Review' | 'Inspect' | 'Activate' | 'Setup' } {
  if (link.state === 'Detached') return { title: 'Updates stopped', description: 'Both copies are kept.', tone: 'muted', action: 'None' };
  if (link.state === 'NeedsAccess' || link.source === null || ['AccessRequired', 'AccountChanged'].includes(link.pauseReason || '')) return { title: 'Google access needed', description: 'Reconnect the original Google account to continue.', tone: 'danger', action: 'Connect' };
  if (link.syncStatus === 'Unconfirmed') return { title: 'Google update not confirmed', description: 'Inspect the existing update before sending another.', tone: 'warning', action: 'Inspect' };
  if (link.availability === 'Deleted') return { title: 'Google event deleted', description: 'Your Remilo reminder and local alert are kept.', tone: 'warning', action: 'None' };
  if (link.availability === 'Unavailable') return { title: 'Google event unavailable', description: 'Its access couldn’t be confirmed. The local reminder is kept.', tone: 'warning', action: 'Connect' };
  if (managed?.calendarId && managed.calendarId === link.source?.calendarId) {
    if (managed.mode === 'Paused') return { title: 'Calendar sync is paused', description: 'Local alerts continue. Review queued work from Calendar settings to resume.', tone: 'muted', action: 'None' };
    if (managed.mode === 'Disabled') return { title: 'Calendar sync is off', description: 'Both copies and local alerts are kept.', tone: 'muted', action: 'None' };
    if (!['Ready', 'InitialImport'].includes(managed.phase)) return { title: 'Calendar setup needs attention', description: 'Review the current calendar before automatic updates resume.', tone: 'warning', action: 'Setup' };
  }
  if (link.syncStatus === 'Deferred') return { title: 'Update waiting', description: 'A schedule change is waiting for ringing to end.', tone: 'muted', action: 'None' };
  if (link.requiresReview || ['Review', 'Paused'].includes(link.syncStatus || '') || link.availability === 'Unsupported') return { title: link.syncStatus === 'Review' ? 'Changes need review' : 'Sync paused', description: calendarReviewReason(link.pauseReason), tone: 'warning', action: link.readOnly ? 'None' : 'Review' };
  if (link.syncMode !== 'Automatic' && (link.differs || link.remoteDiffers)) return { title: 'Updates available', description: 'Review both copies before applying manual changes.', tone: 'warning', action: link.readOnly ? 'None' : 'Review' };
  if (jobs.some(job => ['Waiting', 'Sending', 'Unconfirmed', 'Blocked'].includes(job.state))) return { title: 'Calendar update waiting', description: 'Your saved update still has work remaining.', tone: 'muted', action: 'None' };
  if (link.syncStatus === 'UpdatePending' || link.syncMode === 'Pending' || link.differs || link.remoteDiffers) return { title: 'Update pending', description: 'Local alerts continue while changes are checked.', tone: 'muted', action: 'None' };
  return { title: link.syncMode === 'Automatic' ? 'Automatic sync on' : 'Manual updates', description: '', tone: 'muted', action: link.syncMode !== 'Automatic' && !link.readOnly ? 'Activate' : 'None' };
}
export function calendarActivityLabel(kind: string, groups: string[] = []) {
  const fields = groups.map(group => ({ title: 'Title', notes: 'Notes', schedule: 'Event time' })[group as 'title' | 'notes' | 'schedule']).filter(Boolean).join(', ');
  if (fields && kind === 'CalendarUpdatedRemilo') return `${fields} updated from Google`;
  if (fields && kind === 'CalendarUpdatedGoogle') return `${fields} updated in Google`;
  return null;
}
