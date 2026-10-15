import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmLanguage } from '../localization';
import { Preferences } from './preferences';
import type { AppSettings } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
const initial: AppSettings = { revision: 1, snoozeMinutes: 10, tomorrowMorning: 600, tomorrowAfternoon: 840,
  tomorrowEvening: 1020, sound: 'remilo', vibration: true, theme: 'system', atmosphere: 'automatic', language: 'system' };
function fixture() {
  let saved = { ...initial }, count = 0;
  const applied = new Set<string>();
  const read = vi.fn(async () => ({ ...saved }));
  const write = vi.fn(async (job: { revision: number; operationId: string; patch: Partial<AppSettings> }) => {
    if (applied.has(job.operationId)) return;
    if (job.revision !== saved.revision) throw Object.assign(new Error('Stale revision'), { code: 'STALE_REVISION' });
    saved = { ...saved, ...job.patch, revision: saved.revision + 1 }; applied.add(job.operationId);
  });
  const controller = new Preferences({ read, write, id: () => 'operation-' + ++count });
  controller.prime(initial);
  return { controller, read, write, applied, get saved() { return saved; } };
}
const settled = async (controller: Preferences) => vi.waitFor(() => expect(controller.snapshot().saving).toBe(false));
afterEach(() => confirmLanguage('en'));
describe('serialized preference writes', () => {
  it('coalesces rapid edits and sends only changed fields', async () => {
    const f = fixture(); f.controller.change({ snoozeMinutes: 5 }); f.controller.change({ snoozeMinutes: 15, theme: 'dark' });
    await settled(f.controller);
    expect(f.write).toHaveBeenCalledTimes(1);
    expect(f.write.mock.calls[0][0].patch).toEqual({ snoozeMinutes: 15, theme: 'dark' });
    expect(f.saved.revision).toBe(2);
  });
  it('waits for acknowledgement and refresh before the next revision', async () => {
    const f = fixture(); let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    f.read.mockImplementationOnce(async () => { await barrier; return { ...f.saved }; });
    f.controller.change({ vibration: false });
    await vi.waitFor(() => expect(f.read).toHaveBeenCalledTimes(1));
    f.controller.change({ snoozeMinutes: 5 }); f.controller.change({ snoozeMinutes: 30 });
    expect(f.write).toHaveBeenCalledTimes(1); release(); await settled(f.controller);
    expect(f.write.mock.calls.map(([job]) => job.revision)).toEqual([1, 2]);
    expect(f.saved).toMatchObject({ vibration: false, snoozeMinutes: 30, revision: 3 });
  });
  it('rolls back failed optimistic values and preserves the operation ID on retry', async () => {
    const f = fixture(); f.write.mockRejectedValueOnce(new Error('Storage unavailable'));
    f.controller.change({ theme: 'dark' }); await settled(f.controller);
    expect(f.controller.snapshot()).toMatchObject({ data: { theme: 'system' }, error: 'Could not save this change. Retry.' });
    f.controller.retry(); await settled(f.controller);
    expect(f.write.mock.calls[0][0].operationId).toBe(f.write.mock.calls[1][0].operationId);
    expect(f.saved.theme).toBe('dark');
  });
  it('retains affected fields for contextual errors across subscriptions and clears them after acknowledgement', async () => {
    const f = fixture(); f.write.mockRejectedValueOnce(new Error('Lost acknowledgement'));
    f.controller.change({ atmosphere: 'night', snoozeMinutes: 15 }); await settled(f.controller);
    const unsubscribe = f.controller.subscribe(() => {}); unsubscribe();
    expect(f.controller.snapshot().fields).toEqual(['atmosphere', 'snoozeMinutes']);
    expect(f.controller.snapshot().data).toMatchObject({ atmosphere: 'automatic', snoozeMinutes: 10 });
    f.controller.retry(); await settled(f.controller);
    expect(f.controller.snapshot().fields).toEqual([]);
    expect(f.saved).toMatchObject({ atmosphere: 'night', snoozeMinutes: 15 });
  });
  it('recovers a lost acknowledgement without duplicating the saved operation', async () => {
    const f = fixture(); const actual = f.write.getMockImplementation()!;
    f.write.mockImplementationOnce(async (job) => { await actual(job); throw new Error('Acknowledgement lost'); });
    f.controller.change({ snoozeMinutes: 5 }); await settled(f.controller);
    f.controller.change({ snoozeMinutes: 15 }); f.controller.retry(); await settled(f.controller);
    expect(f.write.mock.calls.map(([job]) => job.operationId)).toEqual(['operation-1', 'operation-1', 'operation-2']);
    expect(f.saved.snoozeMinutes).toBe(15); expect(f.saved.revision).toBe(3);
  });
  it('retains uncertain jobs when refreshing fails and survives screen unsubscribe', async () => {
    const f = fixture(); const unsubscribe = f.controller.subscribe(() => {});
    f.read.mockRejectedValueOnce(new Error('Read failed'));
    f.controller.change({ vibration: false }); unsubscribe(); await settled(f.controller);
    f.controller.retry(); await settled(f.controller);
    expect(f.applied.size).toBe(1); expect(f.saved.revision).toBe(2);
    expect(f.controller.snapshot().data?.vibration).toBe(false);
  });
  it('refreshes external revisions and retains newer selections after a stale rejection', async () => {
    const f = fixture();
    await f.write({ revision: 1, operationId: 'external', patch: { sound: 'system' } });
    f.controller.change({ theme: 'dark' }); await settled(f.controller);
    expect(f.controller.snapshot().error).toContain('changed elsewhere');
    f.controller.change({ theme: 'light' }); f.controller.retry(); await settled(f.controller);
    expect(f.saved).toMatchObject({ theme: 'light', sound: 'system', revision: 3 });
  });
  it('does not replay a captured language over a newer Android selection', async () => {
    const f = fixture();
    await f.write({ revision: 1, operationId: 'android-language', patch: { language: 'en' } });
    f.controller.change({ language: 'zh-Hans' }); await settled(f.controller);
    expect(f.controller.snapshot()).toMatchObject({ data: { language: 'en' }, fields: ['language'] });
    f.controller.retry(); await settled(f.controller);
    expect(f.saved.language).toBe('en'); expect(f.write).toHaveBeenCalledTimes(2);
    f.controller.change({ language: 'zh-Hans' }); await settled(f.controller);
    expect(f.saved.language).toBe('zh-Hans');
  });
  it('retains a failed preference message as a descriptor through a language change', async () => {
    const f = fixture(); f.write.mockRejectedValueOnce(new Error('private platform exception'));
    f.controller.change({ vibration: false }); await settled(f.controller);
    const english = f.controller.snapshot().error;
    confirmLanguage('zh-Hans');
    expect(f.controller.snapshot().error).not.toBe(english);
    expect(f.controller.snapshot().error).toMatch(/[\u4e00-\u9fff]/);
    expect(f.controller.snapshot().error).not.toContain('private platform');
    expect(f.write).toHaveBeenCalledTimes(1);
  });
});
