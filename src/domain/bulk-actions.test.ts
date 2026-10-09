import { describe, expect, it, vi } from 'vitest';
import type { CommandResult, ContentCommand, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { BulkOperation, captureBulk } from './bulk-actions';

const item = (id: string, extra: Partial<Occurrence> = {}) => ({ id, title: id, revision: 7, completed: true, skipped: false, deleted: false, ...extra }) as Occurrence;
const ids = () => { let next = 0; return () => `operation-${++next}`; };

describe('captured collection batches', () => {
  it('deduplicates the selection and freezes each native identity/revision before work', () => {
    const original = item('a'), job = captureBulk('Reopen', [original, original, item('b', { completed: false, skipped: true })], ids());
    original.title = 'later title'; original.revision++;
    expect(job.entries).toHaveLength(2);
    expect(job.entries[0]).toMatchObject({ id: 'a', title: 'a', revision: 7, operationId: 'operation-2' });
    expect(new Set([job.id, ...job.entries.map(entry => entry.operationId)]).size).toBe(3);
    expect(Object.isFrozen(job.entries[0])).toBe(true);
  });
  it('rejects an empty or ineligible mixed selection before issuing any native operation', () => {
    expect(() => captureBulk('Reopen', [], ids())).toThrow('Select at least one');
    expect(() => captureBulk('Delete', [item('a'), item('b', { completed: false })], ids())).toThrow('selection changed');
    expect(() => captureBulk('UndoDelete', [item('a')], ids())).toThrow('selection changed');
    expect(() => captureBulk('Reopen', [item('a', { deleted: true })], ids())).toThrow('selection changed');
    expect(() => captureBulk('Reopen', [item('a')], () => 'duplicate')).toThrow('identify');
  });
  it('coalesces rapid presses and serializes children without widening the captured set', async () => {
    let release!: (result: CommandResult) => void;
    const perform = vi.fn<(command: ContentCommand) => Promise<CommandResult>>().mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValue({ status: 'Applied' });
    const operation = new BulkOperation(perform), job = captureBulk('Reopen', [item('a'), item('b')], ids());
    const first = operation.run(job), second = operation.run(captureBulk('Delete', [item('c')], ids()));
    expect(second).toBe(first); expect(perform).toHaveBeenCalledTimes(1);
    release({ status: 'Applied' }); await first;
    expect(perform.mock.calls.map(([command]) => [command.kind, command.occurrenceId])).toEqual([['Reopen', 'a'], ['Reopen', 'b']]);
    expect(operation.progress).toMatchObject({ confirmed: 2, pending: 0 });
  });
  it('pauses a lost reply and retries that exact committed child before unattempted children', async () => {
    const receipts = new Set<string>(), mutations: string[] = [], calls: ContentCommand[] = [];
    const perform = async (command: ContentCommand): Promise<CommandResult> => {
      calls.push(command);
      if (!receipts.has(command.operationId)) {
        receipts.add(command.operationId); mutations.push(command.occurrenceId);
        if (command.occurrenceId === 'b') throw new Error('Reply lost after commit');
      }
      return { status: 'Applied' };
    };
    const operation = new BulkOperation(perform), job = captureBulk('Reopen', [item('a'), item('b'), item('c')], ids());
    await expect(operation.run(job)).rejects.toThrow('Reply lost');
    expect(operation.progress).toMatchObject({ confirmed: 1, pending: 2 });
    operation.clear(); expect(operation.job).toBe(job);
    await operation.run(captureBulk('Delete', [item('other')], ids()));
    expect(calls.map(command => command.occurrenceId)).toEqual(['a', 'b', 'b', 'c']);
    expect(calls[1]).toEqual(calls[2]); expect(mutations).toEqual(['a', 'b', 'c']);
    expect(operation.progress).toMatchObject({ confirmed: 3, pending: 0 });
  });
  it('counts definitive rejections separately and retains their reasons while continuing the batch', async () => {
    const perform = vi.fn<(command: ContentCommand) => Promise<CommandResult>>().mockResolvedValueOnce({ status: 'Rejected', errorCode: 'STALE_REVISION', errorMessage: 'Reminder changed.' }).mockResolvedValueOnce({ status: 'Blocked' }).mockResolvedValueOnce({ status: 'Pending' });
    const operation = new BulkOperation(perform);
    await operation.run(captureBulk('Reopen', [item('a'), item('b'), item('c')], ids()));
    expect(operation.progress).toEqual({ total: 3, confirmed: 2, rejected: 1, pending: 0, deliveryProblems: 2 });
    expect(operation.outcomes[0].result.errorMessage).toBe('Reminder changed.');
    operation.clear(); expect(operation.job).toBeUndefined();
  });
  it('restores only deleted items using captured revisions and independent receipt identities', async () => {
    const perform = vi.fn<(command: ContentCommand) => Promise<CommandResult>>().mockResolvedValue({ status: 'Applied' });
    const operation = new BulkOperation(perform), job = captureBulk('UndoDelete', [item('a', { deleted: true }), item('b', { deleted: true, completed: false, skipped: true })], ids());
    await operation.run(job);
    expect(perform.mock.calls.map(([command]) => command)).toEqual(job.entries.map(entry => ({ kind: 'UndoDelete', occurrenceId: entry.id, expectedRevision: entry.revision, operationId: entry.operationId })));
  });
});
