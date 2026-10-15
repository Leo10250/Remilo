import { t } from '../localization';
import type { CalendarConnection, CalendarLink, CalendarLinkedOperation, CalendarOperationStatus, CalendarRecoveryAction, ManagedCalendarState } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from './actions';
import { calendarReviewReason } from './calendar-presentation';

export type CalendarStatusPresentation = { title: string; description: string; label: string; action: CalendarRecoveryAction | 'Setup' | 'Progress' | 'Sync'; warning: boolean; tone?: Tone };
export function calendarStatusPresentation(connection: CalendarConnection, state: ManagedCalendarState): CalendarStatusPresentation {
  const source = state.calendarName || t('m_4c4bc76bf722');
  if (!connection.connected) return { title: t('m_c04f9d6a937e'), description: t('m_b04d970bab94'), label: t('m_2035e3f9baed'), action: 'Connect', warning: false };
  if (state.phase === 'AccessRequired') return { title: t('m_08af4a655c74'), description: t('m_16d32f390f0e', { arg0: String(source) }), label: state.problem?.action === 'Authorize' ? t('m_2204c2c3f1b5') : t('m_b724411569e0'), action: state.problem?.action === 'Authorize' ? 'Authorize' : 'Connect', warning: true, tone: 'danger' };
  if (state.phase === 'CreationUnconfirmed') return { title: t('m_64af0e42ea9e'), description: t('m_19d1b56ab64e'), label: t('m_2b9b02919ba1'), action: 'InspectCreation', warning: true };
  if (state.phase === 'CalendarUnavailable') return { title: t('m_6ea25f950a4a'), description: t('m_fc291cb5eedd', { arg0: String(source) }), label: t('m_003b4d1c1e62'), action: 'ReviewSetup', warning: true };
  if (state.phase === 'OwnershipUnknown') return { title: t('m_e07d10e9beba'), description: t('m_006e32c11540'), label: t('m_b34be071b23c'), action: 'ReviewSetup', warning: true };
  if (state.mode === 'Paused') return { title: t('m_56f7bbcb9922'), description: t('m_115911c1e9e0'), label: t('m_4a5f846d4f91'), action: 'Resume', warning: false };
  if (state.phase === 'Reviewing' && state.calendarId && state.mode !== 'Disabled') return { title: t('m_3c20e9a51e0d'), description: t('m_358335aa809c'), label: t('m_4a5f846d4f91'), action: 'Resume', warning: false };
  if (['PreparingCalendar', 'InitialImport'].includes(state.phase) || state.mode === 'Enabled' && !!state.progress?.pending) return { title: state.phase === 'PreparingCalendar' ? t('m_462ebc8a00e3') : state.progress?.scanComplete ? t('m_c8d6bb1f4ab6') : t('m_7cc52a097ee2'), description: t('m_ca87573ada5f'), label: t('m_c2e39c2cee78'), action: 'Progress', warning: false };
  if (state.mode === 'Disabled' || ['NotConfigured', 'Reviewing'].includes(state.phase)) return { title: state.calendarId ? t('m_9f2b41de05e9') : t('m_e792ff59a770'), description: state.calendarId ? t('m_d85ea54a8fbe') : t('m_792942c54206'), label: state.problem?.reason === 'CALENDAR_SELECTION_REQUIRED' ? t('m_c422fd93a0e6') : t('m_c5702c19da53'), action: 'Setup', warning: false };
  const review = state.progress?.review ?? state.reviewCount;
  return { title: t('m_e9f4095c2535'), description: review ? t('m_b12eefdbe4a8', { arg0: String(review), arg1: String(review === 1 ? t('m_48f2a1e019f4') : t('m_d47992d38fa8')) }) : '', label: review ? t('m_e6bc867f7622') : t('m_885e8f48bd70'), action: review ? 'ReviewItems' : 'Sync', warning: !!review };
}
export function calendarOperationTitle(status: CalendarOperationStatus) {
  if (status.syncResult) return calendarSyncOutcome(status).title;
  return ({ Waiting: t('m_f5e5f81fd256'), PreparingCalendar: t('m_462ebc8a00e3'), CreatingCalendar: t('m_5f74d505e85d'), CheckingCalendar: t('m_1b154ed1f09c'), CheckingEvents: t('m_7cc52a097ee2'), AddingReminders: t('m_c8d6bb1f4ab6'),
    Confirmed: status.kind === 'Setup' ? t('m_2ed037216210') : t('m_bf651ba279a7'), NeedsReview: t('m_64ac2d321e0f'), NeedsAccess: t('m_08af4a655c74'),
    Unconfirmed: t('m_64af0e42ea9e'), Paused: t('m_56f7bbcb9922'), Cancelled: t('m_9f944f7125d4'), AwaitingAuthorization: t('m_8699e80bf418'), Authorized: t('m_e26886f4af7d'), Failed: t('m_da6606d403da') })[status.stage];
}
export function calendarTransferText(inbound: string[] = [], outbound: string[] = [], equal = false) {
  const names: Record<string, string> = { title: 'title', notes: 'notes', schedule: t('m_eec29d380fca'), Title: 'title', Notes: 'notes', Schedule: t('m_eec29d380fca') };
  const fields = (values: string[]) => values.map(value => names[value] || value).join(', ');
  return [inbound.length ? t('m_8d604339a2bd', { arg0: String(fields(inbound)) }) : '', outbound.length ? t('m_feef614e588e', { arg0: String(fields(outbound)) }) : ''].filter(Boolean).join(' · ') || (equal ? t('m_c61f1223d688') : t('m_41a8bf8da139'));
}

export function calendarSyncOutcome(status: CalendarOperationStatus): { title: string; description: string; tone: Tone } {
  const result = status.syncResult;
  const values = {
    Checking: [t('m_2f1fa1a2b4c8'), t('m_21a0833ff950'), 'muted'],
    NoChanges: [t('m_a6ed6c024c72'), t('m_d18512ebb8bb'), 'success'],
    Synced: [t('m_595667b91cc0'), result?.changed ? `${result.changed} ${result.changed === 1 ? t('m_bf4197e30724') : t('m_9a7aaeb97280')}.` : t('m_233765b147e6'), 'success'],
    Pending: [t('m_adfc4b0bc60a'), status.reason === 'NETWORK' ? t('m_c0292fdc5a28') : t('m_d2a2c90969a2'), 'muted'],
    NeedsReview: [t('m_64ac2d321e0f'), t('m_4fa17727ec8e'), 'warning'],
    AccessRequired: [t('m_2bac957cacfe'), t('m_d83d245c8fba'), 'danger'],
    Unconfirmed: [t('m_151dc5ed7d18'), t('m_52b7cfd980f7'), 'warning'],
    Paused: [t('m_56f7bbcb9922'), t('m_b66baf418808'), 'muted'],
    Failed: [t('m_50448ab9cd63'), t('m_6e2b4313f185'), 'danger'],
    ScopeChanged: [t('m_65fbca83060d'), t('m_1049ca39305f'), 'muted'],
    NotChecked: [t('m_87e095310472'), t('m_c10f13fed888'), 'muted'],
  } as const;
  const [title, description, tone] = values[result?.outcome ?? 'NotChecked'];
  return { title, description, tone };
}
export function calendarLinkStatus(link: CalendarLink, jobs: readonly CalendarLinkedOperation[] = [], managed?: ManagedCalendarState): { title: string; description: string; tone: Tone; action: 'None' | 'Connect' | 'Review' | 'Inspect' | 'Activate' | 'Setup' } {
  if (link.state === 'Detached') return { title: t('m_42ad44bebf0f'), description: t('m_b4e8adc06607'), tone: 'muted', action: 'None' };
  if (link.state === 'NeedsAccess' || link.source === null || ['AccessRequired', 'AccountChanged'].includes(link.pauseReason || '')) return { title: t('m_2bac957cacfe'), description: t('m_d52322d111c3'), tone: 'danger', action: 'Connect' };
  if (link.syncStatus === 'Unconfirmed') return { title: t('m_151dc5ed7d18'), description: t('m_655e73e16825'), tone: 'warning', action: 'Inspect' };
  if (link.availability === 'Deleted') return { title: t('m_7cde2d365da1'), description: t('m_1e59857b1765'), tone: 'warning', action: 'None' };
  if (link.availability === 'Unavailable') return { title: t('m_c9799e986741'), description: t('m_3eb5b2a8a447'), tone: 'warning', action: 'Connect' };
  if (managed?.calendarId && managed.calendarId === link.source?.calendarId) {
    if (managed.mode === 'Paused') return { title: t('m_56f7bbcb9922'), description: t('m_7dceba352771'), tone: 'muted', action: 'None' };
    if (managed.mode === 'Disabled') return { title: t('m_9f2b41de05e9'), description: t('m_486f60ac539d'), tone: 'muted', action: 'None' };
    if (!['Ready', 'InitialImport'].includes(managed.phase)) return { title: t('m_302c69360bf5'), description: t('m_efa173f54f34'), tone: 'warning', action: 'Setup' };
  }
  if (link.syncStatus === 'Deferred') return { title: t('m_db1b4e600f56'), description: t('m_8e21dce21c32'), tone: 'muted', action: 'None' };
  if (link.requiresReview || ['Review', 'Paused'].includes(link.syncStatus || '') || link.availability === 'Unsupported') return { title: link.syncStatus === 'Review' ? t('m_6fb9cc7a0513') : t('m_a836895b6393'), description: calendarReviewReason(link.pauseReason), tone: 'warning', action: link.readOnly ? 'None' : 'Review' };
  if (link.syncMode !== 'Automatic' && (link.differs || link.remoteDiffers)) return { title: t('m_8d3e019d3824'), description: t('m_7c2edede4883'), tone: 'warning', action: link.readOnly ? 'None' : 'Review' };
  if (jobs.some(job => ['Waiting', 'Sending', 'Unconfirmed', 'Blocked'].includes(job.state))) return { title: t('m_4ea875df7cbc'), description: t('m_bafb7d838ca0'), tone: 'muted', action: 'None' };
  if (link.syncStatus === 'UpdatePending' || link.syncMode === 'Pending' || link.differs || link.remoteDiffers) return { title: t('m_8e0a4b18ae75'), description: t('m_bf6947de0cbb'), tone: 'muted', action: 'None' };
  return { title: link.syncMode === 'Automatic' ? t('m_e9f4095c2535') : t('m_4eac6a88771f'), description: '', tone: 'muted', action: link.syncMode !== 'Automatic' && !link.readOnly ? 'Activate' : 'None' };
}
export function calendarActivityLabel(kind: string, groups: string[] = []) {
  const fields = groups.map(group => ({ title: t('m_7e8cd2056da7'), notes: t('m_8a7525b1492f'), schedule: t('m_1d7fc661c9ce') })[group as 'title' | 'notes' | 'schedule']).filter(Boolean).join(', ');
  if (fields && kind === 'CalendarUpdatedRemilo') return t('m_4b3ea0ade966', { arg0: String(fields) });
  if (fields && kind === 'CalendarUpdatedGoogle') return t('m_770a5f6517da', { arg0: String(fields) });
  return null;
}
