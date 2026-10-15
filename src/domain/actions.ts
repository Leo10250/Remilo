import { t, ownedMessage, errorText, type MessageKey } from '../localization';
import type { CommandResult, Occurrence, ContentCommand } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
export type Tone = 'success' | 'warning' | 'danger' | 'muted' | 'accent';
export function recoveryPresentation(kind?: string) {
  const action = ({ Create: 'save', Edit: 'save', CreateSeries: 'save', EditSeries: 'save', EditFollowing: 'save',
    Done: 'completion', CompleteDelivery: 'completion', Stop: 'completion', UndoDelete: 'restoration', Reopen: 'reopening',
    Postpone: 'postponement', Snooze: 'snooze', Delete: t('m_c2e4d9d387bc'), Purge: t('m_082b6b51d6d1'), CreateList: 'save', RenameList: 'save' } as Record<string, string>)[kind ?? ''] ?? 'change';
  const localizedAction = ownedMessage(action);
  return { message: t('m_563dc1862d65', { arg0: String(localizedAction[0].toUpperCase() + localizedAction.slice(1)) }), retry: t('m_f28163c407f6', { arg0: String(localizedAction) }),
    progress: action === 'completion' ? t('m_23ce4bcfcd5a') : action === 'restoration' ? t('m_464cb8565def') : action === 'save' ? t('m_23e39291d613') : t('m_91d9c6284054', { arg0: String(localizedAction) }) };
}
export function commandFeedback(result: CommandResult, success: string): { message: string; tone: Tone } {
  if (result.status === 'Rejected') return { message: result.errorMessageKey ? ownedMessage({ key: result.errorMessageKey as MessageKey, args: result.errorMessageArgs }) : errorText({ code: result.errorCode, message: result.errorMessage }, t('m_42c3c72f8482')), tone: 'danger' };
  if (result.memberResults && result.status !== 'Applied' && result.status !== 'Scheduled') {
    const members = result.memberResults;
    const scheduled = members.filter((member) => member.status === 'Scheduled').length;
    const counts = [
      ['Blocked', 'blocked'], ['Pending', 'pending'], ['Superseded', t('m_a9cc3c625a57')], ['Missed', t('m_18dbe1385428')],
    ] as const;
    const remaining = counts.map(([status, label]) => {
      const count = members.filter((member) => member.status === status).length;
      return count ? `${count} ${ownedMessage(label)}` : '';
    }).filter(Boolean).join(', ');
    return { message: t('m_704282cd7491', { arg0: String(scheduled), arg1: String(members.length), arg2: String(remaining ? '; ' + remaining : '') }),
      tone: result.status === 'Blocked' ? 'danger' : 'warning' };
  }
  if (result.status === 'Partial') return { message: t('m_55015da1f2cf'), tone: 'warning' };
  if (result.status === 'Blocked') return { message: t('m_d54a4a35c90d'), tone: 'danger' };
  if (result.status === 'Pending') return { message: t('m_1c9c30174e74'), tone: 'warning' };
  return { message: success, tone: 'success' };
}
export function reopenCompleted(item: Occurrence | null, completedRevision: number, operationId: string): ContentCommand | null {
  if (!item || item.deleted || item.skipped || !item.completed || item.revision !== completedRevision) return null;
  return { kind: 'Reopen', occurrenceId: item.id, expectedRevision: completedRevision, operationId };
}
export function restoreDeleted(item: Occurrence | null, deletedRevision: number, operationId: string): ContentCommand | null {
  if (!item?.deleted || item.revision !== deletedRevision) return null;
  return { kind: 'UndoDelete', occurrenceId: item.id, expectedRevision: deletedRevision, operationId };
}
export function editDestination(item: Pick<Occurrence, 'id' | 'segmentId'>) {
  return item.segmentId ? { pathname: '/reminder/[id]' as const, params: { id: item.id, action: 'edit' } }
    : { pathname: '/edit' as const, params: { id: item.id } };
}
