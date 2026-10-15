import { t } from '../localization';
import type { CalendarLink, CalendarLinkedOperation, CalendarPublication, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export const calendarImportIndependence = t('m_8b7100b79478');
export function calendarCancellation(item: Pick<Occurrence, 'mode' | 'deleted' | 'completed' | 'skipped'> & Partial<Pick<Occurrence, 'segmentId' | 'nominalSlot'>>, link?: CalendarLink) {
  const cancelledInstance = link?.cancelledInstances?.some(scope => scope.segmentId === item.segmentId && scope.nominalSlot === item.nominalSlot);
  if (!link || link.state === 'Detached' || link.availability !== 'Deleted' && !cancelledInstance || item.deleted || item.completed || item.skipped) return null;
  return item.mode === 'None' ? { row: t('m_fb4bc7286463'), detail: t('m_9a0806210e6d') } :
    item.mode === 'Notification' ? { row: t('m_9b67178c7db3'), detail: t('m_417edeaae22a') } :
      { row: t('m_ade14f29062f'), detail: t('m_92024f7cd084') };
}
export function currentCalendarOperations(jobs: readonly CalendarLinkedOperation[]) {
  return jobs.filter(job => ['Waiting', 'Sending', 'Unconfirmed', 'NeedsAccess', 'Blocked'].includes(job.state));
}
export function calendarSummary(link?: CalendarLink, publication?: CalendarPublication, jobs: readonly CalendarLinkedOperation[] = []) {
  if (link?.state === 'Detached') return t('m_31c103113db9');
  const pending = currentCalendarOperations(jobs);
  if (link?.syncStatus === 'Unconfirmed' || pending.some(job => job.remoteAttempted && job.state === 'Unconfirmed')) return t('m_151dc5ed7d18');
  if (link?.syncStatus === 'Review') return t('m_6fb9cc7a0513');
  if (link && (link.syncStatus === 'Paused' || link.requiresReview || ['Deleted', 'Unavailable', 'Unsupported'].includes(link.availability) || link.state === 'NeedsAccess' || link.source === null)) return t('m_a836895b6393');
  if (pending.length || link?.syncStatus === 'UpdatePending' || link?.syncStatus === 'Deferred' || link?.syncMode === 'Pending' || link?.syncMode === 'Automatic' && (link.differs || link.remoteDiffers)) return t('m_8e0a4b18ae75');
  if (link) return link.syncMode === 'Automatic' ? t('m_5c30a92fdc1b') : t('m_af966399867d');
  if (publication?.state === 'Published') return t('m_11d2cb6de7d5');
  if (publication?.state === 'NeedsAccess') return t('m_2bac957cacfe');
  if (publication?.state === 'Unconfirmed') return t('m_2b0956211bc9');
  if (publication) return ['Waiting', 'Publishing'].includes(publication.state) ? t('m_bc26ab4d4ba9') : t('m_ef4953108c87');
  return t('m_1e31d9596d67');
}
export function calendarReviewReason(reason?: string) {
  return ({ Ringing: t('m_41743fe61505'), ChangesNeedReview: t('m_1608b18fcf6e'), UnconfirmedWrite: t('m_3b5d1ddaedac'),
    ElapsedAlert: t('m_fe7740b9bd3b'), AccessRequired: t('m_8c73f9b49371'), AccountChanged: t('m_6b173b689ab9'),
    NotOwner: t('m_e8c4e555e782'), RemoteDeleted: t('m_136210e056b8'), RemoteUnavailable: t('m_9c2e96e2faec'),
    Unsupported: t('m_9fbeface7dc1'), LocalTerminal: t('m_043dcffe8daf'), LocalRemoved: t('m_43cbb51990f4'), Unlinked: t('m_9683e5eabbb0'),
    StaleAuthorization: t('m_7495bbbd2502'), InvalidTiming: t('m_fd5d3cf60dd4'), ContentRequired: t('m_f3882f30e216'), ReviewRequired: t('m_3c8d24c2c85c') } as Record<string, string>)[reason || ''] || t('m_2b470b94b316');
}
export function calendarRowNotice(link?: CalendarLink) {
  if (!link || link.state === 'Detached') return null;
  if (link.syncStatus === 'Review') return t('m_de41ed657181');
  if (link.syncStatus === 'Unconfirmed') return t('m_151dc5ed7d18');
  if (link.syncStatus === 'Paused') return t('m_d4f4db50dfc3');
  if (link.syncStatus === 'UpdatePending' || link.syncStatus === 'Deferred') return t('m_62e78bb2b747');
  return null;
}
export function calendarCheckFailure(code: string) {
  return ({ AUTH: t('m_e2237a9c0b3b'), NEEDS_ACCESS: t('m_8c73f9b49371'), ACCOUNT_MISMATCH: t('m_4fc300ef2681'),
    NETWORK: t('m_fb4fce8aa869'), RETRY: t('m_2ec7bb96ad63'),
    NOT_AVAILABLE: t('m_53c7c025aa78'), STORAGE_ERROR: t('m_a6bae56d5d21') } as Record<string, string>)[code] || t('m_53c7c025aa78');
}
