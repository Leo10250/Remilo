import { t } from '../localization';
import type { CalendarFields, CalendarSelections, CalendarLinkedOperation } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export function resolvedCalendarFields(local: CalendarFields, remote: CalendarFields, selections: CalendarSelections): CalendarFields | null {
  if (!selections.title || !selections.notes || !selections.schedule) return null;
  return { title: selections.title === 'remilo' ? local.title : remote.title,
    notes: selections.notes === 'remilo' ? local.notes : remote.notes,
    schedule: selections.schedule === 'remilo' ? local.schedule : remote.schedule };
}
export function calendarOperationRetryable(job: CalendarLinkedOperation) {
  return !job.readOnly && ['Retry', 'ConfirmOutcome'].includes(job.recoveryMode);
}
export function calendarCaptureRejected(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  return ['STALE', 'INELIGIBLE', 'INVALID_INPUT', 'OPERATION_REUSED', 'ALREADY_IMPORTED', 'OPERATION_PENDING',
    'TITLE_REQUIRED', 'ELAPSED_ALERT', 'IMPORT_LIMIT', 'RESOLUTION_REQUIRED', 'CONTENT_LIMIT', 'NOT_FOUND'].some(value => code.includes(value));
}
export function unsupportedCalendarReason(code: string) {
  return ({ RECURRING_EVENT: t('m_af1bbb9c8c3b'), UNSUPPORTED_RECURRENCE: t('m_c10a19f77db8'),
    INSTANCE_REQUIRES_MASTER: t('m_a68455fa37bf'), MEETING_EVENT: t('m_8a88e671f5be'),
    MULTI_DAY_EVENT: t('m_345751491c0e'), CONTENT_LIMIT: t('m_5a5e6bf8bf65'),
    INVALID_ZONE: t('m_2e62416bce80'), INCOMPATIBLE_ZONES: t('m_e6d6e34ce558'),
    LOCKED_EVENT: t('m_bcaf61a5d77e'), SPECIAL_EVENT: t('m_5daa6399c5e1'),
    UNSPECIFIED_END: t('m_c2b2584aed5e'), REMOTE_REMOVED: t('m_38ed5b242f0e'),
    INVALID_EVENT: t('m_c3ba25ec96bb') } as Record<string, string>)[code] || t('m_701dcf7d3a6b');
}
