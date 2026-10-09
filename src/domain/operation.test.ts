import { describe, expect, it } from 'vitest';
import { CapturedOperation } from './operation';
describe('captured UI operations', () => {
  it('coalesces taps and retries the frozen identity after a lost reply', async () => {
    const seen: { id: string; revision: number }[] = [];
    let resolve!: (result: string) => void;
    let calls = 0;
    const operation = new CapturedOperation(async (job: { id: string; revision: number }) => {
      seen.push(job); calls++;
      if (calls === 1) return new Promise<string>((_, reject) => { resolve = () => reject(new Error('lost reply')); });
      return 'applied';
    }, () => false);
    const first = operation.run({ id: 'first', revision: 3 });
    expect(operation.run({ id: 'second', revision: 4 })).toBe(first);
    resolve(''); await expect(first).rejects.toThrow('lost reply');
    expect(operation.pending).toBe(true);
    await expect(operation.run({ id: 'replacement', revision: 9 })).resolves.toBe('applied');
    expect(seen).toEqual([{ id: 'first', revision: 3 }, { id: 'first', revision: 3 }]);
    expect(operation.pending).toBe(false);
  });
  it('releases a definitive rejection so a new deliberate action can capture a revision', async () => {
    const seen: number[] = [];
    const operation = new CapturedOperation(async (revision: number) => { seen.push(revision); if (revision === 1) throw 'stale'; return revision; }, (error) => error === 'stale');
    await expect(operation.run(1)).rejects.toBe('stale');
    expect(operation.pending).toBe(false);
    await expect(operation.run(2)).resolves.toBe(2);
    expect(seen).toEqual([1, 2]);
  });
});
