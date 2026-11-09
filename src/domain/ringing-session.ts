import type {
  Occurrence,
  SessionActionMember,
  SessionActions,
} from '../../modules/remilo-alarm/src/RemiloAlarm.types';

type RingingOccurrence = Pick<
  Occurrence,
  'id' | 'generation' | 'deliveryState' | 'mode' | 'completed' | 'deleted' | 'skipped' | 'routine'
>;

/** Missing, stale and ineligible members invalidate the whole displayed scope. */
export function resolveRingingMembers<T extends RingingOccurrence>(
  scope: SessionActions,
  items: readonly (T | null)[],
) {
  const displayed: T[] = [];
  if (!scope.members.length || scope.members.length !== items.length) return null;
  for (const [index, member] of scope.members.entries()) {
    const item = items[index];
    if (
      !item ||
      item.id !== member.occurrenceId ||
      item.generation !== member.expectedGeneration ||
      item.deliveryState !== 'Alerting' ||
      item.mode === 'None' ||
      item.completed ||
      item.deleted ||
      item.skipped ||
      item.routine
    )
      return null;
    displayed.push(item);
  }
  return displayed;
}

export function sameRingingScope(captured: SessionActions, current?: SessionActions | null) {
  return (
    current?.sessionId === captured.sessionId &&
    current.members.length === captured.members.length &&
    captured.members.every(
      (member, index) =>
        member.occurrenceId === current.members[index]?.occurrenceId &&
        member.expectedGeneration === current.members[index]?.expectedGeneration,
    )
  );
}

export function ringingMembersRemain(
  captured: readonly SessionActionMember[],
  current?: SessionActions | null,
) {
  if (!current || !captured.length) return false;
  const live = new Map(
    current.members.map((member) => [member.occurrenceId, member.expectedGeneration]),
  );
  return captured.every((member) => live.get(member.occurrenceId) === member.expectedGeneration);
}
