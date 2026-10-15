import type { CalendarConnection, CalendarOperationStatus, CalendarRecoveryAction, ManagedCalendarState } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export type CalendarStatusPresentation = { title: string; description: string; label: string; action: CalendarRecoveryAction | 'Setup' | 'Progress' | 'Sync'; warning: boolean };
export function calendarStatusPresentation(connection: CalendarConnection, state: ManagedCalendarState): CalendarStatusPresentation {
  const source = state.calendarName || 'your Remilo calendar';
  if (!connection.connected) return { title: 'Connect Google Calendar', description: 'Allow Remilo to read and update a dedicated Remilo calendar. Your local reminders keep working.', label: 'Connect Google', action: 'Connect', warning: false };
  if (state.phase === 'AccessRequired') return { title: 'Google access needs attention', description: `Remilo couldn’t confirm access to ${source}. Continue with the original Google account.`, label: state.problem?.action === 'Authorize' ? 'Continue authorization' : 'Reconnect Google', action: state.problem?.action === 'Authorize' ? 'Authorize' : 'Connect', warning: true };
  if (state.phase === 'CreationUnconfirmed') return { title: 'Calendar creation isn’t confirmed', description: 'Google may already have created the calendar. Check the original request before creating another.', label: 'Check creation result', action: 'InspectCreation', warning: true };
  if (state.phase === 'CalendarUnavailable') return { title: 'Can’t access your Remilo calendar', description: `${source} couldn’t be reached. Check access before reviewing a replacement. Local alerts continue.`, label: 'Check calendar access', action: 'ReviewSetup', warning: true };
  if (state.phase === 'OwnershipUnknown') return { title: 'Calendar ownership isn’t verified', description: 'Remilo needs a secondary calendar owned by this Google account. Google hasn’t confirmed that ownership.', label: 'Check ownership again', action: 'ReviewSetup', warning: true };
  if (state.mode === 'Paused') return { title: 'Calendar sync is paused', description: 'Local alerts continue. Review queued changes before resuming.', label: 'Review and resume', action: 'Resume', warning: false };
  if (state.phase === 'Reviewing' && state.calendarId && state.mode !== 'Disabled') return { title: 'Review before resuming sync', description: 'Google access is connected. Review current events and queued changes before sync resumes.', label: 'Review and resume', action: 'Resume', warning: false };
  if (['PreparingCalendar', 'InitialImport'].includes(state.phase) || state.mode === 'Enabled' && !!state.progress?.pending) return { title: state.phase === 'PreparingCalendar' ? 'Preparing your Remilo calendar' : state.progress?.scanComplete ? 'Adding reminders and updates' : 'Checking existing events', description: 'You can keep using Remilo while this work continues.', label: 'View progress', action: 'Progress', warning: false };
  if (state.mode === 'Disabled' || ['NotConfigured', 'Reviewing'].includes(state.phase)) return { title: state.calendarId ? 'Calendar sync is off' : 'Finish Calendar setup', description: state.calendarId ? 'Both copies are kept. Review setup to turn sync on again.' : 'Choose your Remilo calendar and how events and reminders should sync.', label: state.problem?.reason === 'CALENDAR_SELECTION_REQUIRED' ? 'Choose calendar' : 'Continue setup', action: 'Setup', warning: false };
  const review = state.progress?.review ?? state.reviewCount;
  return { title: 'Calendar sync is on', description: review ? `${review} ${review === 1 ? 'item needs' : 'items need'} your review. Other ready work can continue.` : 'Linked titles, notes and event times stay in sync. Local alerts work offline.', label: review ? 'Review items' : 'Sync now', action: review ? 'ReviewItems' : 'Sync', warning: !!review };
}
export function calendarOperationTitle(status: CalendarOperationStatus) {
  return ({ Waiting: 'Waiting to start', PreparingCalendar: 'Preparing your Remilo calendar', CreatingCalendar: 'Creating your Remilo calendar', CheckingCalendar: 'Checking calendar access', CheckingEvents: 'Checking existing events', AddingReminders: 'Adding reminders and updates',
    Confirmed: status.kind === 'Setup' ? 'Calendar sync is on' : 'Reviewed work finished', NeedsReview: 'Some items need review', NeedsAccess: 'Google access needs attention',
    Unconfirmed: 'Calendar creation isn’t confirmed', Paused: 'Calendar sync is paused', Cancelled: 'This request is no longer active', AwaitingAuthorization: 'Finish connecting in Google', Authorized: 'Google access confirmed', Failed: 'Google access wasn’t confirmed' })[status.stage];
}
export function calendarTransferText(inbound: string[] = [], outbound: string[] = [], equal = false) {
  const names: Record<string, string> = { title: 'title', notes: 'notes', schedule: 'event time', Title: 'title', Notes: 'notes', Schedule: 'event time' };
  const fields = (values: string[]) => values.map(value => names[value] || value).join(', ');
  return [inbound.length ? `Update ${fields(inbound)} in Remilo` : '', outbound.length ? `Update ${fields(outbound)} in Google` : ''].filter(Boolean).join(' · ') || (equal ? 'Already matches' : 'Keep both copies up to date');
}
