import type { CommandResult, Occurrence, ContentCommand } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
export type Tone = 'success' | 'warning' | 'danger' | 'muted' | 'accent';
export function commandFeedback(result: CommandResult, success: string): { message: string; tone: Tone } {
  if (result.status === 'Rejected') return { message: result.errorMessage ?? 'That action could not be applied. Refresh and retry.', tone: 'danger' };
  if (result.memberResults && result.status !== 'Applied' && result.status !== 'Scheduled') {
    const members = result.memberResults;
    const scheduled = members.filter((member) => member.status === 'Scheduled').length;
    const counts = [
      ['Blocked', 'blocked'], ['Pending', 'pending'], ['Superseded', 'changed since this action'], ['Missed', 'elapsed without replay'],
    ] as const;
    const remaining = counts.map(([status, label]) => {
      const count = members.filter((member) => member.status === status).length;
      return count ? `${count} ${label}` : '';
    }).filter(Boolean).join(', ');
    return { message: `${scheduled} of ${members.length} alerts scheduled${remaining ? '; ' + remaining : ''}. Reminders remain unfinished. Review their alert status.`,
      tone: result.status === 'Blocked' ? 'danger' : 'warning' };
  }
  if (result.status === 'Partial') return { message: 'Some alerts could not be scheduled. Reminders remain unfinished. Review their alert status.', tone: 'warning' };
  if (result.status === 'Blocked') return { message: 'Saved; alert blocked. Review Alert problems in Agenda.', tone: 'danger' };
  if (result.status === 'Pending') return { message: 'Saved; scheduling pending. Check the next alert status.', tone: 'warning' };
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
