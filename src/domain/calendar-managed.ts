import { t } from '../localization';
import type { CalendarReminderDisposition, CalendarReviewIssue, ManagedCalendarCommand, ManagedCalendarPreview, ManagedCalendarReviewItem, ManagedCalendarState } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarReviewReason } from './calendar-presentation';

export function managedCalendarStatus(state: ManagedCalendarState) {
  const phase = ({ NotConfigured: t('m_dd1841d29502'), Reviewing: t('m_30416545a561'), PreparingCalendar: t('m_4e56c840938f'), InitialImport: t('m_77656cdbb15e'),
    AccessRequired: t('m_2bac957cacfe'), CalendarUnavailable: t('m_de37d8d70a8f'), OwnershipUnknown: t('m_f529881b469c'), CreationUnconfirmed: t('m_c007740d3853') } as Record<string, string>)[state.phase];
  return phase || (state.mode === 'Paused' ? t('m_bf958954b105') : state.mode === 'Disabled' ? t('m_1f7e4ac3283d') : t('m_4993ca20a7c1'));
}
export function calendarDispositionLabel(value: CalendarReminderDisposition) {
  return ({ LocalOnly: t('m_c905013aab29'), Held: t('m_ad247578e4d3'), WaitingToPublish: t('m_ec0bf2251136'), Publishing: t('m_6dc57b056357'), Linked: t('m_5c30a92fdc1b'),
    Ineligible: t('m_8ef0b712ea7e'), Unconfigured: t('m_a23789f19a90') } as const)[value.state];
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
  if (issue.kind === 'Candidate') return (['ReviewRequired', 'IdentityReview'].includes(issue.reason) ? t('m_b95ffe008981') : t('m_b89457145742')) + (issue.calendarName ? ' · ' + issue.calendarName : '');
  if (issue.kind === 'Setup') return t('m_a342c7f38799');
  return issue.affectedScopes?.length ? t('m_37460427b837') + issue.affectedScopes.join(', ') : t('m_10208d7687ad');
}
export function calendarReviewIssueReason(issue: CalendarReviewIssue) {
  if (issue.kind === 'Candidate') {
    if (issue.reason === 'ElapsedAlert') return t('m_abc43a19ee76');
    if (issue.reason === 'Unsupported') return t('m_100e567db39d');
    if (issue.reason === 'ReviewRequired' || issue.reason === 'IdentityReview') return t('m_7432f17dcc34');
    return t('m_3e32d1d5e9be');
  }
  if (issue.kind === 'Setup') {
    if (['UnconfirmedWrite', 'CreationUnconfirmed', 'CREATION_UNCONFIRMED'].includes(issue.reason)) return t('m_9475b4627062');
    if (['OwnershipUnknown', 'OWNERSHIP_UNKNOWN'].includes(issue.reason)) return t('m_ed69948c4fc6');
  }
  return calendarReviewReason(issue.reason);
}
export function managedCalendarItemReason(item: Pick<ManagedCalendarReviewItem, 'kind' | 'reason'>) {
  if (item.kind === 'Import' && item.reason === 'ElapsedAlert') return t('m_85fe33518840');
  if (item.kind === 'RecoveredAlert' && item.reason === 'ElapsedAlert') return t('m_686652a7555d');
  return calendarReviewReason(item.reason);
}
