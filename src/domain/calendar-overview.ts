import type { CalendarConnection, CalendarOperationStatus, CalendarSyncSummary, ManagedCalendarState } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { t } from '../localization';
import { calendarStatusPresentation, calendarSyncOutcome, type CalendarStatusPresentation } from './calendar-ux';

export type CalendarOverviewPresentation = Omit<CalendarStatusPresentation, 'action'> & {
  action: CalendarStatusPresentation['action'] | 'Refresh';
  state: 'UpToDate' | 'Syncing' | 'Paused' | 'Error' | 'Pending' | 'Unchecked' | 'Setup' | 'Review';
  checkedAtMs?: number;
};

/** Permission is not evidence of agreement. Only the native-fenced, completed global check can be green. */
export function calendarOverviewPresentation(connection: CalendarConnection, managed: ManagedCalendarState, summary?: CalendarSyncSummary,
  status?: CalendarOperationStatus | null, options: { submitting?: boolean; inspecting?: boolean; uncertain?: boolean; unavailable?: boolean } = {}): CalendarOverviewPresentation {
  const base = calendarStatusPresentation(connection, managed);
  const wrap = (state: CalendarOverviewPresentation['state']): CalendarOverviewPresentation => ({ ...base, state });
  const request = status?.kind === 'Sync' && status.currentScope && status.syncResult?.scope?.kind === 'AllAuthorized' ? status : undefined;
  const result = request?.syncResult;
  if (!connection.connected) return wrap('Setup');
  if (managed.phase === 'AccessRequired') return { ...base, state: 'Error', title: t('calendar_sync_blocked') };
  if (['InspectCreation', 'ReviewSetup'].includes(base.action)) return wrap(base.action === 'InspectCreation' ? 'Review' : 'Error');
  // The selected calendar's controls do not hide recovery for other authorized links.
  if (result?.outcome === 'AccessRequired') return { ...wrap('Error'), title: t('calendar_sync_blocked'), description: t('calendar_sync_access_body'), label: t('m_b724411569e0'), action: 'Connect', tone: 'danger', warning: true };
  const review = Math.max(summary?.reviewCount ?? 0, managed.reviewCount, managed.progress?.review ?? 0, request?.review ?? 0);
  if (review || result?.outcome === 'NeedsReview' || result?.outcome === 'Unconfirmed') return { ...wrap('Review'), title: t('m_3d2d5eb3e995'), description: t('m_638daed11ef3'), label: t('m_e6bc867f7622'), action: 'ReviewItems', tone: summary?.attention?.tone ?? 'warning', warning: true };
  if (options.uncertain) return { ...wrap('Review'), title: t('m_151dc5ed7d18'), description: t('calendar_sync_uncertain_body'), label: '', action: 'None', tone: 'warning', warning: true };
  if (options.unavailable || !summary) return { ...wrap('Unchecked'), title: t('calendar_sync_status_unavailable'), description: t('calendar_sync_status_unavailable_body'), label: t('calendar_refresh_status'), action: 'Refresh', tone: 'muted', warning: false };
  if (options.inspecting) return { ...wrap('Unchecked'), title: t('calendar_sync_reading_status'), description: t('calendar_sync_reading_status_body'), label: '', action: 'None', tone: 'muted', warning: false };

  if (options.submitting || result?.outcome === 'Checking' && request!.stage === 'CheckingEvents') return { ...wrap('Syncing'), title: options.submitting ? t('calendar_sync_requesting') : t('calendar_sync_running'), description: t('calendar_sync_running_body'), label: '', action: 'None', tone: 'muted', warning: false };
  if (managed.mode === 'Enabled' && base.action === 'Progress' && ['PreparingCalendar', 'InitialImport'].includes(managed.phase)) return wrap('Setup');
  if (result?.outcome === 'Failed') return { ...wrap('Error'), ...calendarSyncOutcome(request!), title: t('calendar_sync_blocked'), label: t('m_d8b8392e2c54'), action: 'Retry', warning: true };
  // A current global request can still operate on other calendars while this one is paused/off.
  const modeFallback = !result || ['Paused', 'NotChecked'].includes(result.outcome);
  if (modeFallback && managed.mode === 'Paused') return { ...wrap('Paused'), description: t('calendar_sync_paused_body'), tone: 'muted' };
  if (modeFallback && managed.mode === 'Disabled') return { ...wrap('Setup'), title: managed.calendarId ? t('m_9f2b41de05e9') : t('m_e792ff59a770'), description: managed.calendarId ? t('m_d85ea54a8fbe') : t('m_792942c54206'), label: t('m_c5702c19da53'), action: 'Setup', tone: 'muted', warning: false };
  if (modeFallback && ['Setup', 'Resume'].includes(base.action)) return wrap('Setup');
  const pending = Math.max(summary.pendingCount, managed.pendingExportCount + (managed.pendingChangeCount ?? 0), managed.progress?.pending ?? 0, request?.pending ?? 0);
  const held = Math.max(managed.heldExportCount, managed.progress?.held ?? 0, request?.held ?? 0);
  if (pending || held || result?.outcome === 'Pending' || result?.outcome === 'Paused' || result?.outcome === 'Checking' && request!.stage === 'Waiting') return { ...wrap('Pending'), title: t('calendar_sync_waiting'),
    description: result?.outcome === 'Pending' ? calendarSyncOutcome(request!).description : t('calendar_sync_waiting_body'), label: t('m_885e8f48bd70'), action: 'Sync', tone: 'muted', warning: false };
  if (result && ['NoChanges', 'Synced'].includes(result.outcome) && request?.stage === 'Confirmed' && request.correlationComplete !== false && result.finishedAtMs != null && Number.isFinite(result.finishedAtMs)) {
    return { ...wrap('UpToDate'), title: t('calendar_sync_up_to_date'), description: t('calendar_sync_up_to_date_body'), checkedAtMs: result.finishedAtMs,
      label: t('m_885e8f48bd70'), action: 'Sync', tone: 'success', warning: false };
  }
  return { ...wrap('Unchecked'), title: t('calendar_sync_unchecked'), description: t('calendar_sync_unchecked_body'), label: t('m_885e8f48bd70'), action: 'Sync', tone: 'muted', warning: false };
}

export function calendarAutomaticSyncPresentation(managed: ManagedCalendarState) {
  if (managed.mode === 'Paused') return { value: t('calendar_automatic_paused'), summary: t('calendar_automatic_paused_body') };
  if (managed.mode === 'Disabled') return { value: t('calendar_automatic_off'), summary: t('calendar_automatic_off_body') };
  return { value: t('calendar_automatic_on'), summary: t('calendar_automatic_on_body') };
}
