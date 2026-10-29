import { describe, expect, it, vi } from 'vitest';
import type { AppSettings, CommandResult, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { PostponeController, postponeHostPresentation, requestStillEligible, type PostponeOperation, type PostponeRead } from './postpone-controller';
import type { PostponeRequest } from './postpone-request';

const start = Date.parse('2026-10-28T10:00:00Z');
const settings = { tomorrowMorning: 600, tomorrowAfternoon: 840, tomorrowEvening: 1020 } as AppSettings;
const item = (id = 'one', generation = 7) => ({ id, generation, title: id, completed: false, deleted: false, skipped: false, mode: 'Alarm', deliveryState: 'Alerting' }) as Occurrence;
const single: PostponeRequest = { kind: 'Single', occurrenceId: 'one', expectedGeneration: 7 };
const group: PostponeRequest = { kind: 'Group', expectedSessionId: 'session', members: [{ occurrenceId: 'one', expectedGeneration: 7 }, { occurrenceId: 'two', expectedGeneration: 3 }] };
const read = (): PostponeRead => ({ items: [item(), item('two', 3)], settings: { ...settings }, sessionId: 'session' });
const settle = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function fixture() {
  let now = start;
  const source = vi.fn(async () => read()), send = vi.fn(async (_command: PostponeOperation): Promise<CommandResult> => ({ status: 'Scheduled' })), id = vi.fn(() => 'operation-one');
  return { source, send, id, advance: (value: number) => { now = value; }, controller: new PostponeController({ read: source, send, id, now: () => now, zone: () => 'UTC' }) };
}
describe('Home captured Postpone controller', () => {
  it('opens and cancels without mutating, preserving opening settings and identities', async () => {
    const f = fixture(), data = read(); f.source.mockResolvedValue(data);
    f.controller.open(single); await settle();
    expect(f.controller.snapshot()).toMatchObject({ eligible: true, loading: false, capture: { expectedGeneration: 7, zoneId: 'UTC', tomorrowMinutes: [600, 840, 1020] } });
    data.settings.tomorrowMorning = 1; data.items[0]!.generation = 8;
    expect(f.controller.snapshot().capture).toMatchObject({ expectedGeneration: 7, tomorrowMinutes: [600, 840, 1020] });
    expect(f.controller.close()).toBe(true); expect(f.controller.snapshot().request).toBeNull(); expect(f.send).not.toHaveBeenCalled();
  });
  it('cancels an in-flight read without allowing its late reply to replace a newer draft', async () => {
    const f = fixture(), first = deferred<PostponeRead>(); f.source.mockImplementationOnce(() => first.promise);
    f.controller.open(single); expect(f.controller.close()).toBe(true);
    f.controller.open({ kind: 'Single', occurrenceId: 'two', expectedGeneration: 3 }); await settle();
    const capture = f.controller.snapshot().capture;
    first.resolve(read()); await settle();
    expect(f.controller.snapshot().capture).toBe(capture); expect(f.controller.snapshot().request).toMatchObject({ occurrenceId: 'two' });
  });
  it('retains a recoverable loading failure without guessing shortcuts', async () => {
    const f = fixture(); f.source.mockRejectedValueOnce(new Error('transport'));
    f.controller.open(single); await settle();
    expect(f.controller.snapshot()).toMatchObject({ capture: null, failure: 'load', loading: false });
    await f.controller.load(); expect(f.controller.snapshot().eligible).toBe(true); expect(f.send).not.toHaveBeenCalled();
  });
  it('rejects changed, missing, terminal, Routine and wrong-session captured members', () => {
    const regular = read(); expect(requestStillEligible(group, regular)).toBe(true);
    expect(requestStillEligible(group, { ...regular, sessionId: 'another' })).toBe(false);
    for (const changed of [null, item('one', 8), { ...item(), completed: true }, { ...item(), routine: { routineId: 'routine' } as NonNullable<Occurrence['routine']> }, { ...item(), kind: 'RoutineFamily' as const }]) {
      expect(requestStillEligible(single, { items: [changed] })).toBe(false);
    }
  });
  it('allows later uncaptured Routine arrivals without broadening an ordinary group', async () => {
    const f = fixture(); f.source.mockResolvedValue({ ...read(), items: [...read().items, { ...item('routine'), routine: { routineId: 'r' } as NonNullable<Occurrence['routine']> }] });
    f.controller.open(group); await settle(); f.controller.submit(start + 900000); await settle();
    expect(f.send.mock.calls[0][0]).toEqual({ kind: 'PostponeAll', expectedSessionId: 'session', members: group.kind === 'Group' ? group.members : [], alarmAtMs: start + 900000, operationId: 'operation-one' });
  });
  it('does not submit a stale route or expired target', async () => {
    const f = fixture(); f.source.mockResolvedValue({ ...read(), items: [item('one', 8)] });
    f.controller.open(single); await settle(); f.controller.submit(start + 900000);
    expect(f.controller.snapshot()).toMatchObject({ eligible: false, failure: 'stale' }); expect(f.send).not.toHaveBeenCalled();
    f.controller.close(); f.source.mockResolvedValue(read()); f.controller.open(single); await settle();
    f.controller.submit(start); f.controller.submit(NaN); expect(f.send).not.toHaveBeenCalled();
  });
  it('freezes the exact operation through unknown replies, setting/clock changes and later requests', async () => {
    const f = fixture(); f.send.mockRejectedValueOnce(new Error('lost reply'));
    f.controller.open(group); await settle(); f.controller.submit(start + 900000); await settle();
    const command = f.send.mock.calls[0][0], capture = f.controller.snapshot().capture;
    expect(f.controller.snapshot().uncertain).toBe(true); expect(f.controller.close()).toBe(false);
    f.advance(start + 86400000); f.controller.open(single); f.controller.select(); f.controller.submit(start + 999999999); await f.controller.refresh();
    expect(f.controller.snapshot().capture).toBe(capture); expect(f.controller.snapshot()).toMatchObject({ queued: true, targetMs: start + 900000 });
    f.controller.retry(); await settle();
    expect(f.send.mock.calls[1][0]).toBe(command); expect(f.id).toHaveBeenCalledTimes(1);
    expect(f.controller.snapshot()).toMatchObject({ acknowledged: true, uncertain: false });
    f.controller.close(); await settle(); expect(f.controller.snapshot().request).toEqual(single);
  });
  it('deduplicates the same visible request, then permits an identical deliberate reopen', async () => {
    const f = fixture(); f.controller.open(single); await settle(); const capture = f.controller.snapshot().capture;
    f.controller.open({ ...single }); expect(f.controller.snapshot().capture).toBe(capture); expect(f.controller.snapshot().queued).toBe(false);
    f.controller.close(); f.advance(start + 1000); f.controller.open(single); await settle();
    expect(f.controller.snapshot().capture?.referenceAtMs).toBe(start + 1000); expect(f.send).not.toHaveBeenCalled();
  });
  it('prevents duplicate dispatch while busy and preserves truthful partial acknowledgement', async () => {
    const f = fixture(), pending = deferred<CommandResult>(); f.send.mockImplementationOnce(() => pending.promise);
    f.controller.open(group); await settle(); f.controller.submit(start + 900000); f.controller.submit(start + 1800000); f.controller.retry();
    expect(f.send).toHaveBeenCalledTimes(1); expect(f.controller.close()).toBe(false);
    const partial: CommandResult = { status: 'Partial', memberResults: [{ occurrenceId: 'one', generation: 8, status: 'Blocked' }, { occurrenceId: 'two', generation: 4, status: 'Pending' }] };
    pending.resolve(partial); await settle(); expect(f.controller.snapshot()).toMatchObject({ acknowledged: true, result: partial, targetMs: start + 900000 });
    f.controller.submit(start + 3600000); expect(f.send).toHaveBeenCalledTimes(1);
  });
  it('refreshes authoritative eligibility after a known rejection and never substitutes generations', async () => {
    const f = fixture(); f.controller.open(single); await settle();
    f.send.mockResolvedValueOnce({ status: 'Rejected', errorCode: 'STALE' }); f.source.mockResolvedValue({ ...read(), items: [item('one', 8)] });
    f.controller.submit(start + 900000); await settle();
    expect(f.controller.snapshot()).toMatchObject({ uncertain: false, eligible: false, failure: 'stale', capture: { expectedGeneration: 7 } });
    expect(f.controller.close()).toBe(true);
  });
});


describe('shared Details and Home Postpone ownership', () => {
  it('hands an unsubmitted Details draft to Home without replacing it when another notification arrives', async () => {
    const f = fixture(); f.controller.open(single, 'details'); await settle();
    const capture = f.controller.snapshot().capture;
    f.controller.open(group, 'home');
    expect(f.controller.snapshot()).toMatchObject({ destination: 'home', queued: true, request: single });
    expect(f.controller.snapshot().capture).toBe(capture);
    f.controller.close(); await settle();
    expect(f.controller.snapshot()).toMatchObject({ destination: 'home', request: group });
    expect(f.send).not.toHaveBeenCalled();
  });
  it('keeps a Details unknown command and exact target when the requested surface becomes Home', async () => {
    const f = fixture(); f.send.mockRejectedValueOnce(new Error('lost reply'));
    f.controller.open(single, 'details'); await settle(); f.controller.submit(start + 900000); await settle();
    const command = f.send.mock.calls[0][0], capture = f.controller.snapshot().capture;
    f.controller.open(group, 'home');
    expect(f.controller.snapshot()).toMatchObject({ destination: 'home', uncertain: true, queued: true, targetMs: start + 900000 });
    expect(f.controller.snapshot().capture).toBe(capture); expect(f.controller.close()).toBe(false);
    expect(postponeHostPresentation(f.controller.snapshot().destination, 'details', true, f.controller.isGuarded())).toEqual({ visible: true, navigateHome: false });
    f.controller.retry(); await settle(); expect(f.send.mock.calls[1][0]).toBe(command);
    expect(f.controller.snapshot()).toMatchObject({ destination: 'home', acknowledged: true });
    expect(postponeHostPresentation(f.controller.snapshot().destination, 'details', true, f.controller.isGuarded())).toEqual({ visible: false, navigateHome: true });
  });
});


describe('successive Postpone requests', () => {
  it('keeps distinct waiting requests in arrival order and deduplicates repeated taps', async () => {
    const f = fixture(); f.controller.open(single); await settle();
    const second: PostponeRequest = { kind: 'Single', occurrenceId: 'two', expectedGeneration: 3 };
    const third: PostponeRequest = { kind: 'Single', occurrenceId: 'three', expectedGeneration: 9 };
    f.controller.open(second); f.controller.open(third); f.controller.open(second);
    f.controller.close(); await settle(); expect(f.controller.snapshot()).toMatchObject({ request: second, queued: true });
    f.controller.close(); await settle(); expect(f.controller.snapshot()).toMatchObject({ request: third, queued: false });
    f.controller.close(); expect(f.controller.snapshot().request).toBeNull(); expect(f.send).not.toHaveBeenCalled();
  });
});
