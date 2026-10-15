import { t } from '../localization';
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
  if (code.includes('CREATION_UNCONFIRMED')) return t('m_3d41a331cd10');
  if (code.includes('DISCOVERY_INCOMPLETE')) return t('m_f6b15efa47ca');
  if (code.includes('SELECTION_REQUIRED')) return t('m_554f1772bde5');
  if (code.includes('OWNERSHIP_UNKNOWN')) return t('m_eda8439b5f60');
  if (code.includes('NOT_OWNER')) return t('m_25751f99b6ab');
  if (code.includes('UNSUPPORTED_RECURRENCE')) return t('m_f436bbd0fd75');
  if (code.includes('MEETING_EVENT')) return t('m_7f5cfcf6b956');
  if (code.includes('REVIEW_REQUIRED')) return t('m_83247b835e54');
  if (code.includes('STALE_CURSOR')) return t('m_f78f4fc6af87');
  if (code.includes('STALE')) return t('m_601dc414a533');
  if (code.includes('OPERATION_PENDING')) return t('m_0a8739d15b5a');
  if (code.includes('ALREADY_IMPORTED')) return t('m_d6e970618b8f');
  if (code.includes('TITLE_REQUIRED')) return t('m_acf167bd0281');
  if (code.includes('ELAPSED_ALERT')) return t('m_ba9f77b2ffd9');
  if (code.includes('IMPORT_LIMIT')) return t('m_b5f04921f0d2');
  if (code.includes('INVALID_RANGE')) return t('m_d84a7bff4fba');
  if (code.includes('RESOLUTION_REQUIRED')) return t('m_e7ff061cb4f9');
  if (code.includes('NEEDS_CONNECTION')) return t('m_60bac12b7cf2');
  if (code.includes('NEEDS') || code.includes('AUTH')) return t('m_326e71c82f32');
  if (code.includes('INELIGIBLE')) return t('m_f7e8af2c017b');
  if (code.includes('INVALID_ZONE')) return t('m_b5946340deb0');
  if (code.includes('ALREADY')) return t('m_afa72b693f9d');
  return t('m_e33334fb25a7');
}
