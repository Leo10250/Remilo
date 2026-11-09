import { describe, expect, it } from 'vitest';
import type { SessionActions } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { resolveRingingMembers, sameRingingScope } from './ringing-session';

const scope: SessionActions = {
  sessionId: 'session',
  members: [
    { occurrenceId: 'first', expectedGeneration: 2 },
    { occurrenceId: 'second', expectedGeneration: 3 },
  ],
  snoozeMinutes: 10,
};
const rows = scope.members.map((member) => ({
  id: member.occurrenceId,
  generation: member.expectedGeneration,
  deliveryState: 'Alerting',
  mode: 'Alarm' as const,
  completed: false,
  deleted: false,
  skipped: false,
  title: member.occurrenceId,
}));

describe('displayed ringing scope', () => {
  it('resolves only the complete and ordered set of current ringing reminders', () => {
    expect(resolveRingingMembers(scope, rows)).toEqual(rows);
    expect(resolveRingingMembers(scope, [rows[0], null])).toBeNull();
    expect(resolveRingingMembers(scope, [...rows].reverse())).toBeNull();
    expect(resolveRingingMembers(scope, [rows[0], { ...rows[1], generation: 4 }])).toBeNull();
    expect(
      resolveRingingMembers(scope, [rows[0], { ...rows[1], deliveryState: 'Stopped' }]),
    ).toBeNull();
  });

  it('rejects an outdated displayed scope if members arrive, leave or change generation', () => {
    expect(sameRingingScope(scope, { ...scope, snoozeMinutes: 20 })).toBe(true);
    expect(sameRingingScope(scope, null)).toBe(false);
    expect(sameRingingScope(scope, { ...scope, sessionId: 'new' })).toBe(false);
    expect(sameRingingScope(scope, { ...scope, members: scope.members.slice(1) })).toBe(false);
    expect(
      sameRingingScope(scope, {
        ...scope,
        members: [...scope.members, { occurrenceId: 'late', expectedGeneration: 1 }],
      }),
    ).toBe(false);
    expect(
      sameRingingScope(scope, {
        ...scope,
        members: [scope.members[0], { ...scope.members[1], expectedGeneration: 4 }],
      }),
    ).toBe(false);
  });
});
