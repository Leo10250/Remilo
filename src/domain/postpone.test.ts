import { describe, expect, it, vi } from 'vitest';
import type { PostponeTimeInput, TimeConversion } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { capturePostpone, PostponeDraft, postponeCaptureMatches, postponeChoices, postponeTimeInput } from './postpone';
import { civilAt } from './time';

const start = Date.parse('2026-10-28T10:00:00Z');
const conversion = (instantMs: number): TimeConversion => ({ instantMs, zoneId: 'UTC', local: civilAt(instantMs, 'UTC'), offsetSeconds: 0, adjustment: 'none' });
const capture = () => capturePostpone({ id: 'one', generation: 4, title: 'A reminder' }, undefined, start, 'UTC');
const resolve = async (input: PostponeTimeInput) => {
  if (input.kind === 'Relative') return conversion(input.referenceAtMs + input.minutes * 60_000);
  if (input.kind === 'Tomorrow') return conversion(Date.parse(civilAt(input.referenceAtMs, 'UTC').slice(0, 10) + 'T00:00:00Z') + 86_400_000 + input.minutesOfDay * 60_000);
  const value = conversion(Date.parse(input.local + 'Z'));
  if (value.instantMs <= input.referenceAtMs) throw new Error('past');
  return value;
};
const deferred = () => { let finish!: (value: TimeConversion) => void; const promise = new Promise<TimeConversion>(done => { finish = done; }); return { promise, finish }; };

describe('Postpone presentation capture', () => {
  it('captures identity, generation, zone and copied configured shortcuts without adopting later data', () => {
    const item = { id: 'one', generation: 4, title: 'First title' };
    const settings = { tomorrowMorning: 123, tomorrowAfternoon: 456, tomorrowEvening: 789 };
    const selected = capturePostpone(item, settings, start, 'America/Los_Angeles');
    item.generation++; item.title = 'Later title'; settings.tomorrowMorning = 600;
    expect(selected).toMatchObject({ expectedGeneration: 4, title: 'First title', zoneId: 'America/Los_Angeles', tomorrowMinutes: [123, 456, 789] });
    expect(postponeCaptureMatches(selected, item)).toBe(false);
    expect(postponeCaptureMatches(selected, { id: 'one', generation: 4 })).toBe(true);
    expect(postponeCaptureMatches(selected, { id: 'other', generation: 4 })).toBe(false);
    expect(postponeTimeInput('tomorrow-1', selected, start + 1)).toEqual({ kind: 'Tomorrow', zoneId: 'America/Los_Angeles', referenceAtMs: start + 1, minutesOfDay: 456 });
    expect(postponeTimeInput('1440', selected, start)).toMatchObject({ kind: 'Relative', minutes: 1440 });
    expect(postponeChoices).toHaveLength(8);
  });
  it('defaults to a concrete native +15-minute target and refreshes only unselected previews', async () => {
    const policy = vi.fn(resolve), draft = new PostponeDraft(capture(), policy);
    await draft.initialize();
    const original = draft.snapshot().target;
    expect(draft.snapshot().choice).toBe('15');
    expect(original?.instantMs).toBe(start + 900_000);
    expect(policy.mock.calls).toHaveLength(7);
    await draft.refreshPreviews(start + 1_200_000);
    expect(draft.snapshot().target).toBe(original);
    expect(draft.snapshot().targets['15']).toBe(original);
    expect(draft.snapshot().targets['30']?.instantMs).toBe(start + 3_000_000);
    await draft.select('15', start + 1_200_000);
    expect(draft.snapshot().target?.instantMs).toBe(start + 2_100_000);
  });
});
describe('Postpone draft races and custom selection', () => {
  it('ignores late initialization and selection replies without losing other clock previews', async () => {
    const waits: ReturnType<typeof deferred>[] = [];
    const draft = new PostponeDraft(capture(), () => { const wait = deferred(); waits.push(wait); return wait.promise; });
    const initial = draft.initialize(); await Promise.resolve();
    const older = draft.select('30', start + 1), newer = draft.select('60', start + 2);
    waits[8].finish(conversion(start + 3_600_002)); await newer;
    waits[7].finish(conversion(start + 1_800_001)); await older;
    waits.slice(0, 7).forEach((wait, index) => wait.finish(conversion(start + (index + 1) * 900_000))); await initial;
    expect(draft.snapshot().choice).toBe('60');
    expect(draft.snapshot().target?.instantMs).toBe(start + 3_600_002);
    expect(draft.snapshot().targets['30']?.instantMs).toBe(start + 1_800_000);
    expect(draft.snapshot().targets['60']?.instantMs).toBe(start + 3_600_002);
  });
  it('freezes exact selection during submission/unknown replies and ignores closed-owner replies', async () => {
    const wait = deferred(), policy = vi.fn(resolve);
    const draft = new PostponeDraft(capture(), policy);
    await draft.initialize(); const original = draft.snapshot().target;
    policy.mockImplementationOnce(() => wait.promise);
    const pending = draft.select('60', start);
    draft.setFrozen(true); wait.finish(conversion(start + 3_600_000)); await pending;
    await draft.select('30', start); await draft.refreshPreviews(start + 5_000);
    expect(draft.snapshot().target).toBe(original);
    draft.setFrozen(false);
    const late = deferred(); policy.mockImplementationOnce(() => late.promise);
    const operation = draft.select('30', start); draft.close(); late.finish(conversion(start + 1_800_000)); await operation;
    expect(draft.snapshot().target).toBe(original);
  });
  it('retains an invalid custom draft and restores the prior selection on Back', async () => {
    const draft = new PostponeDraft(capture(), resolve);
    await draft.initialize(); await draft.select('60', start); const original = draft.snapshot().target;
    await draft.openCustom(start); await draft.editCustom(start - 60_000, start);
    expect(draft.snapshot().customInstantMs).toBe(start - 60_000);
    expect(draft.snapshot().error).toBeTruthy();
    expect(await draft.useCustom(start)).toBe(false);
    draft.backToChoices();
    expect(draft.snapshot()).toMatchObject({ choice: '60', target: original, customOpen: false, error: null });
    await draft.openCustom(start + 7_200_000);
    expect(draft.snapshot().customInstantMs).toBe(start + 8_100_000);
    draft.backToChoices(); expect(draft.snapshot().target).toBe(original);
  });
  it('commits custom only after Use and validates against that action instant', async () => {
    const policy = vi.fn(resolve), draft = new PostponeDraft(capture(), policy);
    await draft.initialize(); const original = draft.snapshot().target;
    await draft.openCustom(start); await draft.editCustom(start + 7_200_000, start + 1_000);
    expect(draft.snapshot().target).toBe(original);
    expect(await draft.useCustom(start + 2_000)).toBe(true);
    expect(policy.mock.calls.at(-1)?.[0]).toEqual({ kind: 'Custom', referenceAtMs: start + 2_000, zoneId: 'UTC', local: '2026-10-28T12:00:00' });
    expect(draft.snapshot()).toMatchObject({ choice: 'custom', customOpen: false, target: { instantMs: start + 7_200_000 } });
  });
  it('cancels a pending custom resolver when returning to choices', async () => {
    const wait = deferred(), policy = vi.fn(resolve), draft = new PostponeDraft(capture(), policy);
    await draft.initialize(); const original = draft.snapshot().target;
    await draft.openCustom(start); policy.mockImplementationOnce(() => wait.promise);
    const editing = draft.editCustom(start + 7_200_000, start);
    draft.backToChoices(); wait.finish(conversion(start + 7_200_000)); await editing;
    expect(draft.snapshot()).toMatchObject({ choice: '15', target: original, customOpen: false, customDraft: null });
  });
});
