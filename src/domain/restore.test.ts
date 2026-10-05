import { describe, expect, it, vi } from 'vitest';
import type { CommandResult } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { RestoreOperation, type RestoreJob } from './restore';

describe('retry-safe backup restore', () => {
  it('retains the same backup, copy selection and operation after a lost acknowledgement', async () => {
    const committed = new Set<string>();
    const restore = vi.fn(async (job: RestoreJob): Promise<CommandResult> => {
      if (committed.has(job.operationId)) return { status: 'Applied', retry: true };
      committed.add(job.operationId);
      throw new Error('Reply lost after saving');
    });
    const id = vi.fn(() => 'restore-1');
    const operation = new RestoreOperation({ restore, id });
    const copies = ['family-a'];
    await expect(operation.run('backup-a', copies)).rejects.toThrow('Reply lost');
    expect(operation.pending).toBe(true);
    copies.push('family-b');
    await expect(operation.run('backup-b', copies)).resolves.toMatchObject({ retry: true });
    expect(restore.mock.calls.map(([job]) => job)).toEqual([
      { json: 'backup-a', copies: ['family-a'], operationId: 'restore-1' },
      { json: 'backup-a', copies: ['family-a'], operationId: 'restore-1' },
    ]);
    expect(committed.size).toBe(1);
    expect(id).toHaveBeenCalledTimes(1);
    expect(operation.pending).toBe(false);
  });

  it('coalesces a second press while native is processing', async () => {
    let acknowledge!: (result: CommandResult) => void;
    const restore = vi.fn(() => new Promise<CommandResult>((resolve) => { acknowledge = resolve; }));
    const operation = new RestoreOperation({ restore, id: () => 'restore-1' });
    const first = operation.run('backup-a', ['family-a']);
    const second = operation.run('backup-b', []);
    expect(first).toBe(second);
    expect(restore).toHaveBeenCalledTimes(1);
    acknowledge({ status: 'Applied', added: 1 });
    await first;
    expect(operation.pending).toBe(false);
  });

  it('allows reviewed changes after an explicit rejection and allocates a new operation', async () => {
    let nextId = 0;
    const restore = vi.fn<(job: RestoreJob) => Promise<CommandResult>>()
      .mockResolvedValueOnce({ status: 'Rejected', errorMessage: 'Selection invalid' })
      .mockResolvedValueOnce({ status: 'Applied' });
    const operation = new RestoreOperation({ restore, id: () => 'restore-' + ++nextId });
    await expect(operation.run('backup-a', ['bad'])).rejects.toThrow('Selection invalid');
    expect(operation.pending).toBe(false);
    await operation.run('backup-a', ['good']);
    expect(restore.mock.calls[1][0]).toEqual({ json: 'backup-a', copies: ['good'], operationId: 'restore-2' });
  });

  it('accepts a confirmed restore with blocked delivery without retaining an uncertain job', async () => {
    const result: CommandResult = { status: 'Blocked', added: 2, preserved: 1, blocked: 1 };
    const restore = vi.fn(async () => result);
    const operation = new RestoreOperation({ restore, id: () => 'restore-1' });
    await expect(operation.run('backup-a', [])).resolves.toEqual(result);
    expect(operation.pending).toBe(false);
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('protects the frozen copy selection from adapter mutation before a lost reply', async () => {
    const submitted: RestoreJob[] = [];
    const restore = vi.fn(async (job: RestoreJob): Promise<CommandResult> => {
      submitted.push({ ...job, copies: [...job.copies] });
      if (submitted.length === 1) {
        job.copies.push('unexpected-copy');
        throw new Error('Reply lost');
      }
      return { status: 'Applied', retry: true };
    });
    const operation = new RestoreOperation({ restore, id: () => 'restore-1' });
    await expect(operation.run('backup-a', ['family-a'])).rejects.toThrow('Reply lost');
    await operation.run('backup-b', ['family-b']);
    expect(submitted).toEqual([
      { json: 'backup-a', copies: ['family-a'], operationId: 'restore-1' },
      { json: 'backup-a', copies: ['family-a'], operationId: 'restore-1' },
    ]);
  });
});
