import { describe, expect, it, vi } from 'vitest';
import type { CommandResult } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { TestAlarmOperation } from './test-alarm';

describe('identified native Test alarm', () => {
  it('retains the same identity after a lost reply, then allocates a new deliberate test', async () => {
    let next = 0;
    const schedule = vi.fn<(id: string) => Promise<CommandResult>>()
      .mockRejectedValueOnce(new Error('Reply lost'))
      .mockResolvedValueOnce({ status: 'Applied', retry: true })
      .mockResolvedValueOnce({ status: 'Scheduled' });
    const operation = new TestAlarmOperation({ id: () => `test-${++next}`, schedule });
    await expect(operation.run()).rejects.toThrow('Reply lost');
    expect(operation.pending).toBe(true);
    await operation.run();
    expect(operation.pending).toBe(false);
    await operation.run();
    expect(schedule.mock.calls.map(([id]) => id)).toEqual(['test-1', 'test-1', 'test-2']);
  });
  it('coalesces simultaneous presses and releases definitive rejection', async () => {
    let resolve!: (result: CommandResult) => void;
    const schedule = vi.fn(() => new Promise<CommandResult>((done) => { resolve = done; }));
    const operation = new TestAlarmOperation({ id: () => 'test-1', schedule });
    const first = operation.run();
    expect(operation.run()).toBe(first);
    expect(schedule).toHaveBeenCalledTimes(1);
    resolve({ status: 'Rejected', errorCode: 'INVALID_OPERATION_ID' });
    await first;
    expect(operation.pending).toBe(false);
  });
});
