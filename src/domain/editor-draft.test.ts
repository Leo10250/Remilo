import { describe, expect, it, vi } from 'vitest';
import type { TimeConversionInput } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { changeDraftAllDay, changeDraftZone, chooseConflict, editorDraft, editorPreviewPayload, moveDraftDue, moveDraftEvent, relinkTimedSnapshot, reviewedTimedSnapshot, reviewChoicesComplete, reviewEditorDraft, type EditorState, type TimedDraftSnapshot } from './editor-draft';
const state = (): EditorState => ({ draft: editorDraft({ title: 'Original', zoneId: 'UTC', eventStartMs: Date.UTC(2027, 0, 5, 9) }) });
const utc = async (input: TimeConversionInput) => ({ zoneId: input.zoneId, instantMs: input.instantMs ?? Date.parse(input.local + 'Z'),
  local: input.local ?? new Date(input.instantMs!).toISOString().slice(0, 19), offsetSeconds: 0, adjustment: 'none' as const });

describe('editor conflict review', () => {
  it('preserves local edits and accepts unrelated latest changes', () => {
    const base = state(), yours = { draft: { ...base.draft, title: 'My title' } }, latest = { draft: { ...base.draft, notes: 'New native notes', listName: 'Work' } };
    const review = reviewEditorDraft(base, yours, latest);
    expect(review.conflicts).toEqual([]);
    expect(review.merged.draft).toMatchObject({ title: 'My title', notes: 'New native notes', listName: 'Work' });
    expect(base.draft.title).toBe('Original');
  });
  it('reviews competing timing and repeat changes as one atomic schedule', () => {
    const base = state(), yours = { draft: { ...base.draft, dueLinked: false, dueAtMs: base.draft.dueAtMs + 60_000 } };
    const latest: EditorState = { draft: { ...base.draft, zoneId: 'Asia/Tokyo' }, recurrence: { frequency: 'daily', interval: 2, zoneMode: 'pinned' } };
    const review = reviewEditorDraft(base, yours, latest);
    expect(review.conflicts.map((conflict) => conflict.key)).toEqual(['schedule']);
    const chosen = chooseConflict(review.merged, review.conflicts[0], 'latest');
    expect(chosen).toEqual(latest);
    expect(review.merged).toEqual(yours);
  });
  it('accepts identical changes without a conflict and never copies runtime fields', () => {
    const base = state(), changed = { draft: { ...base.draft, title: 'Same title' } };
    expect(reviewEditorDraft(base, changed, changed).conflicts).toEqual([]);
    const record = { ...base.draft, generation: 17, deliveryState: 'Alerting' };
    expect(editorDraft(record)).not.toHaveProperty('generation');
    expect(editorDraft(record)).not.toHaveProperty('deliveryState');
  });
  it('requires an explicit choice for every conflict before adopting a reviewed revision', () => {
    const base = state(), yours = { draft: { ...base.draft, title: 'My title', dueLinked: false } };
    const latest = { draft: { ...base.draft, title: 'Latest title', alarmLinked: false } };
    const review = reviewEditorDraft(base, yours, latest);
    expect(reviewChoicesComplete(review.conflicts, {})).toBe(false);
    expect(reviewChoicesComplete(review.conflicts, { title: 'yours' })).toBe(false);
    expect(reviewChoicesComplete(review.conflicts, { title: 'yours', schedule: 'latest' })).toBe(true);
    expect(reviewChoicesComplete([], {})).toBe(true);
  });
  it('preserves list identity and reviews competing membership changes independently of renamed display text', () => {
    const base = { draft: editorDraft({ title: 'Original', listId: 'work', listName: 'Work' }) };
    const yours = { draft: { ...base.draft, listId: null } };
    const latest = { draft: { ...base.draft, listId: 'home', listName: 'Household' } };
    const review = reviewEditorDraft(base, yours, latest);
    expect(review.conflicts.map((conflict) => conflict.key)).toEqual(['listId']);
    expect(chooseConflict(review.merged, review.conflicts[0], 'latest').draft.listId).toBe('home');
    const renamed = { draft: { ...base.draft, listName: 'Office' } };
    expect(reviewEditorDraft(base, base, renamed).conflicts).toEqual([]);
    expect(reviewEditorDraft(base, base, renamed).merged.draft.listId).toBe('work');
    expect(editorDraft(base.draft).listId).toBe('work');
  });
});
describe('linked civil offsets across clock changes', () => {
  const la = 'America/Los_Angeles';
  const native = (known: Record<string, string>) => vi.fn(async (input: TimeConversionInput) => {
    if (!input.local || !known[input.local]) throw new Error('Unexpected native conversion request: ' + input.local);
    return { zoneId: input.zoneId, instantMs: Date.parse(known[input.local]), local: input.local,
      offsetSeconds: known[input.local].endsWith('-07:00') ? -7 * 3600 : -8 * 3600, adjustment: 'none' as const };
  });
  it('moves When away from spring DST without changing a linked one-day due or alarm offset', async () => {
    const draft = editorDraft({ title: 'Civil links', zoneId: la, eventStartMs: Date.parse('2026-03-07T09:00:00-08:00'),
      eventEndMs: Date.parse('2026-03-07T09:45:00-08:00'), dueAtMs: Date.parse('2026-03-08T09:00:00-07:00'), alarmAtMs: Date.parse('2026-03-08T08:30:00-07:00') });
    const convert = native({ '2026-03-11T09:00:00': '2026-03-11T09:00:00-07:00', '2026-03-11T08:30:00': '2026-03-11T08:30:00-07:00' });
    const moved = (await moveDraftEvent(draft, Date.parse('2026-03-10T09:00:00-07:00'), convert)).draft;
    expect(moved.dueAtMs).toBe(Date.parse('2026-03-11T09:00:00-07:00'));
    expect(moved.alarmAtMs).toBe(Date.parse('2026-03-11T08:30:00-07:00'));
    expect(moved.eventEndMs - moved.eventStartMs).toBe(45 * 60_000);
    expect(convert.mock.calls.map(([input]) => input.local)).toEqual(['2026-03-11T09:00:00', '2026-03-11T08:30:00']);
  });
  it('moves due while preserving a linked civil-day alarm offset and keeping event timing unchanged', async () => {
    const draft = editorDraft({ title: 'Due link', zoneId: la, eventStartMs: Date.parse('2026-03-06T12:00:00-08:00'), dueLinked: false,
      dueAtMs: Date.parse('2026-03-07T09:00:00-08:00'), alarmAtMs: Date.parse('2026-03-08T09:00:00-07:00') });
    const convert = native({ '2026-03-11T09:00:00': '2026-03-11T09:00:00-07:00' });
    const moved = (await moveDraftDue(draft, Date.parse('2026-03-10T09:00:00-07:00'), convert)).draft;
    expect(moved.alarmAtMs).toBe(Date.parse('2026-03-11T09:00:00-07:00'));
    expect(moved.eventStartMs).toBe(draft.eventStartMs);
    expect(moved.eventEndMs).toBe(draft.eventEndMs);
  });
  it('preserves a one-day due through the fall fold while leaving an independent alarm exact', async () => {
    const independent = Date.parse('2026-11-01T01:30:00-08:00');
    const draft = editorDraft({ title: 'Fall links', zoneId: la, eventStartMs: Date.parse('2026-10-31T09:00:00-07:00'),
      dueAtMs: Date.parse('2026-11-01T09:00:00-08:00'), alarmAtMs: independent, alarmLinked: false });
    const convert = native({ '2026-11-06T09:00:00': '2026-11-06T09:00:00-08:00' });
    const moved = (await moveDraftEvent(draft, Date.parse('2026-11-05T09:00:00-08:00'), convert)).draft;
    expect(moved.dueAtMs).toBe(Date.parse('2026-11-06T09:00:00-08:00'));
    expect(moved.alarmAtMs).toBe(independent);
    expect(convert).toHaveBeenCalledTimes(1);
  });
  it('resolves all-day next midnight and 9 AM through native conversion on a 23-hour date', async () => {
    const draft = editorDraft({ title: 'All-day boundary', zoneId: la, allDay: true,
      eventStartMs: Date.parse('2026-03-07T00:00:00-08:00'), eventEndMs: Date.parse('2026-03-08T00:00:00-08:00') });
    const convert = native({ '2026-03-08T00:00:00': '2026-03-08T00:00:00-08:00',
      '2026-03-09T00:00:00': '2026-03-09T00:00:00-07:00', '2026-03-08T09:00:00': '2026-03-08T09:00:00-07:00' });
    const moved = (await moveDraftEvent(draft, Date.parse('2026-03-08T00:00:00-08:00'), convert)).draft;
    expect(moved.eventEndMs - moved.eventStartMs).toBe(23 * 3_600_000);
    expect(moved.dueAtMs).toBe(moved.eventEndMs);
    expect(moved.alarmAtMs).toBe(Date.parse('2026-03-08T09:00:00-07:00'));
  });
  it('retains independent due and alarm instants exactly when moving When', async () => {
    const draft = editorDraft({ title: 'Independent', zoneId: la, dueLinked: false, alarmLinked: false });
    const convert = native({});
    const moved = (await moveDraftEvent(draft, draft.eventStartMs + 4 * 86_400_000, convert)).draft;
    expect(moved.dueAtMs).toBe(draft.dueAtMs);
    expect(moved.alarmAtMs).toBe(draft.alarmAtMs);
    expect(convert).not.toHaveBeenCalled();
  });
});
describe('clock-preserving zone selection', () => {
  it('keeps authored clock times while preserving event elapsed duration', async () => {
    const draft = editorDraft({ title: 'Travel', zoneId: 'America/Los_Angeles', eventStartMs: Date.UTC(2027, 0, 5, 17),
      eventEndMs: Date.UTC(2027, 0, 5, 18), dueAtMs: Date.UTC(2027, 0, 5, 19), alarmAtMs: Date.UTC(2027, 0, 5, 16), dueLinked: false, alarmLinked: false });
    const resolve = vi.fn(utc), result = await changeDraftZone(draft, 'UTC', resolve);
    expect(result.draft).toMatchObject({ eventStartMs: Date.UTC(2027, 0, 5, 9), eventEndMs: Date.UTC(2027, 0, 5, 10),
      dueAtMs: Date.UTC(2027, 0, 5, 11), alarmAtMs: Date.UTC(2027, 0, 5, 8), zoneId: 'UTC' });
    expect(resolve.mock.calls.map(([input]) => input.local)).toEqual(['2027-01-05T09:00:00', '2027-01-05T11:00:00', '2027-01-05T08:00:00']);
    expect(draft.eventStartMs).toBe(Date.UTC(2027, 0, 5, 17));
  });
  it('derives all-day next midnight and 9 AM in the new zone', async () => {
    const draft = editorDraft({ title: 'All day', zoneId: 'America/Los_Angeles', allDay: true,
      eventStartMs: Date.UTC(2027, 0, 5, 8), eventEndMs: Date.UTC(2027, 0, 6, 8) });
    const result = await changeDraftZone(draft, 'UTC', utc);
    expect(result.draft).toMatchObject({ eventStartMs: Date.UTC(2027, 0, 5), eventEndMs: Date.UTC(2027, 0, 6),
      dueAtMs: Date.UTC(2027, 0, 6), alarmAtMs: Date.UTC(2027, 0, 5, 9) });
  });
  it('leaves an untouched later-fold instant exactly unchanged', async () => {
    const laterFold = Date.UTC(2027, 10, 7, 9, 30), draft = editorDraft({ title: 'Imported fold', zoneId: 'America/Los_Angeles', eventStartMs: laterFold });
    const convert = vi.fn(utc), result = await changeDraftZone(draft, 'America/Los_Angeles', convert);
    expect(result.draft.eventStartMs).toBe(laterFold);
    expect(convert).not.toHaveBeenCalled();
  });
  it('surfaces native gap and fold adjustments without inventing a resolution policy', async () => {
    const resolve = vi.fn(async (input: TimeConversionInput) => ({ ...await utc(input), adjustment: 'gapForward' as const }));
    expect((await changeDraftZone(state().draft, 'Europe/London', resolve)).warnings[0]).toContain('moves a selected time forward');
  });
});

describe('all-day editor conversion', () => {
  const timed = () => editorDraft({ title: 'Remember this', notes: 'Keep my notes', listId: 'work', zoneId: 'UTC',
    eventStartMs: Date.UTC(2027, 0, 5, 14), eventEndMs: Date.UTC(2027, 0, 5, 16),
    dueAtMs: Date.UTC(2027, 0, 6, 14), alarmAtMs: Date.UTC(2027, 0, 6, 13, 45) });
  it('keeps the selected date and restores the timed clock, duration and linked civil offsets', async () => {
    const original = timed(), before = structuredClone(original);
    const on = await changeDraftAllDay(original, true, null, utc);
    expect(on.draft).toMatchObject({ allDay: true, eventStartMs: Date.UTC(2027, 0, 5), eventEndMs: Date.UTC(2027, 0, 6),
      dueAtMs: Date.UTC(2027, 0, 6), alarmAtMs: Date.UTC(2027, 0, 5, 9), dueLinked: true, alarmLinked: true });
    const moved = await moveDraftEvent(on.draft, Date.UTC(2027, 0, 8), utc);
    const off = await changeDraftAllDay(moved.draft, false, on.snapshot, utc);
    expect(off.draft).toMatchObject({ allDay: false, eventStartMs: Date.UTC(2027, 0, 8, 14), eventEndMs: Date.UTC(2027, 0, 8, 16),
      dueAtMs: Date.UTC(2027, 0, 9, 14), alarmAtMs: Date.UTC(2027, 0, 9, 13, 45), title: original.title, notes: original.notes, listId: 'work' });
    expect(off.snapshot).toBeNull(); expect(original).toEqual(before);
  });
  it('never moves or relinks independent times through all-day conversion or date changes', async () => {
    const original = { ...timed(), dueLinked: false, alarmLinked: false };
    const on = await changeDraftAllDay(original, true, null, utc);
    const moved = await moveDraftEvent(on.draft, Date.UTC(2027, 0, 20), utc);
    const off = await changeDraftAllDay(moved.draft, false, on.snapshot, utc);
    for (const draft of [on.draft, moved.draft, off.draft]) {
      expect(draft).toMatchObject({ dueAtMs: original.dueAtMs, alarmAtMs: original.alarmAtMs, dueLinked: false, alarmLinked: false });
    }
    expect(off.draft.eventStartMs).toBe(Date.UTC(2027, 0, 20, 14));
  });
  it('restores a linked alert offset against an independently edited live due time', async () => {
    const original = { ...timed(), dueLinked: false };
    const on = await changeDraftAllDay(original, true, null, utc);
    const changed = await moveDraftDue(on.draft, Date.UTC(2027, 0, 10, 11), utc);
    const off = await changeDraftAllDay(changed.draft, false, on.snapshot, utc);
    expect(off.draft).toMatchObject({ dueLinked: false, alarmLinked: true, dueAtMs: Date.UTC(2027, 0, 10, 11),
      alarmAtMs: Date.UTC(2027, 0, 10, 10, 45) });
  });
  it('keeps an explicit alert edit made while all day instead of restoring a former link', async () => {
    const on = await changeDraftAllDay(timed(), true, null, utc), alarm = Date.UTC(2027, 0, 12, 18);
    const off = await changeDraftAllDay({ ...on.draft, alarmAtMs: alarm, alarmLinked: false }, false, on.snapshot, utc);
    expect(off.draft).toMatchObject({ alarmAtMs: alarm, alarmLinked: false, dueAtMs: Date.UTC(2027, 0, 6, 14) });
  });
  it('uses zero offsets after deliberate relinking rather than resurrecting remembered offsets', async () => {
    const on = await changeDraftAllDay(timed(), true, null, utc);
    const reset = relinkTimedSnapshot(relinkTimedSnapshot(on.snapshot, 'due'), 'alarm');
    const off = await changeDraftAllDay(on.draft, false, reset, utc);
    expect(off.draft.dueAtMs).toBe(off.draft.eventStartMs);
    expect(off.draft.alarmAtMs).toBe(off.draft.eventStartMs);
    expect(on.snapshot).toMatchObject({ dueOffsetMs: 86_400_000, alarmOffsetMs: -900_000 });
    expect(relinkTimedSnapshot(null, 'alarm')).toBeNull();
  });
  it('uses 9 AM and a 30-minute duration for an initially all-day record without changing independent values', async () => {
    for (const independent of [false, true]) {
      const original = editorDraft({ title: 'Existing all day', zoneId: 'UTC', allDay: true, eventStartMs: Date.UTC(2027, 0, 8),
        eventEndMs: Date.UTC(2027, 0, 9), dueAtMs: Date.UTC(2027, 0, 9), alarmAtMs: Date.UTC(2027, 0, 8, 11),
        dueLinked: !independent, alarmLinked: !independent });
      const off = await changeDraftAllDay(original, false, null, utc);
      expect(off.draft).toMatchObject({ eventStartMs: Date.UTC(2027, 0, 8, 9), eventEndMs: Date.UTC(2027, 0, 8, 9, 30),
        dueLinked: !independent, alarmLinked: !independent });
      expect(off.draft.dueAtMs).toBe(independent ? original.dueAtMs : off.draft.eventStartMs);
      expect(off.draft.alarmAtMs).toBe(independent ? original.alarmAtMs : off.draft.eventStartMs);
    }
  });
  it('restores remembered civil clocks in the currently chosen zone after all-day date and zone edits', async () => {
    const original = editorDraft({ title: 'Travel', zoneId: 'America/Los_Angeles', eventStartMs: Date.parse('2027-01-05T14:00:00-08:00'),
      eventEndMs: Date.parse('2027-01-05T15:00:00-08:00'), dueAtMs: Date.parse('2027-01-05T15:00:00-08:00'),
      alarmAtMs: Date.parse('2027-01-05T14:45:00-08:00') });
    const la = async (input: TimeConversionInput) => ({ ...await utc(input), instantMs: Date.parse(input.local + '-08:00'), offsetSeconds: -8 * 3600 });
    const on = await changeDraftAllDay(original, true, null, la);
    const zoned = await changeDraftZone(on.draft, 'UTC', utc);
    const moved = await moveDraftEvent(zoned.draft, Date.UTC(2027, 0, 8), utc);
    const off = await changeDraftAllDay(moved.draft, false, on.snapshot, utc);
    expect(off.draft).toMatchObject({ zoneId: 'UTC', eventStartMs: Date.UTC(2027, 0, 8, 14), eventEndMs: Date.UTC(2027, 0, 8, 15),
      dueAtMs: Date.UTC(2027, 0, 8, 15), alarmAtMs: Date.UTC(2027, 0, 8, 14, 45) });
  });
  it.each([
    ['2026-03-08', '-08:00', '-07:00', 23],
    ['2026-11-01', '-07:00', '-08:00', 25],
  ])('derives local all-day boundaries on %s without an elapsed-day shortcut', async (day, midnightOffset, laterOffset, hours) => {
    const next = day === '2026-03-08' ? '2026-03-09' : '2026-11-02';
    const original = editorDraft({ title: 'Clock change', zoneId: 'America/Los_Angeles',
      eventStartMs: Date.parse(day + 'T14:00:00' + laterOffset) });
    const convert = async (input: TimeConversionInput) => {
      const local = input.local!, offset = local === day + 'T00:00:00' ? midnightOffset : laterOffset;
      return { zoneId: input.zoneId, local, instantMs: Date.parse(local + offset), offsetSeconds: offset === '-07:00' ? -25_200 : -28_800, adjustment: 'none' as const };
    };
    const on = await changeDraftAllDay(original, true, null, convert);
    expect(on.draft.eventEndMs - on.draft.eventStartMs).toBe(Number(hours) * 3_600_000);
    expect(on.draft.dueAtMs).toBe(Date.parse(next + 'T00:00:00' + laterOffset));
    expect(on.draft.alarmAtMs).toBe(Date.parse(day + 'T09:00:00' + laterOffset));
  });
  it('uses native gap resolution and retains an independent later-fold instant exactly', async () => {
    const snapshot: TimedDraftSnapshot = { clock: '02:30:00', durationMs: 2_700_000, dueOffsetMs: 0, alarmOffsetMs: 0 };
    const laterFold = Date.parse('2026-11-01T01:30:00-08:00');
    const original = editorDraft({ title: 'Gap', zoneId: 'America/Los_Angeles', allDay: true,
      eventStartMs: Date.parse('2026-03-08T00:00:00-08:00'), alarmAtMs: laterFold, alarmLinked: false });
    const convert = async (input: TimeConversionInput) => {
      const gap = input.local === '2026-03-08T02:30:00', local = gap ? '2026-03-08T03:30:00' : input.local!;
      return { zoneId: input.zoneId, local, instantMs: Date.parse(local + '-07:00'), offsetSeconds: -25_200,
        adjustment: gap ? 'gapForward' as const : 'none' as const };
    };
    const off = await changeDraftAllDay(original, false, snapshot, convert);
    expect(off.draft.eventStartMs).toBe(Date.parse('2026-03-08T03:30:00-07:00'));
    expect(off.draft.eventEndMs - off.draft.eventStartMs).toBe(2_700_000);
    expect(off.draft.dueAtMs).toBe(off.draft.eventStartMs);
    expect(off.draft.alarmAtMs).toBe(laterFold);
    expect(off.warnings).toHaveLength(1);
  });
  it('does not overwrite the snapshot for a no-op and leaves the input unchanged on conversion failure', async () => {
    const original = timed(), before = structuredClone(original), fail = vi.fn(async () => { throw new Error('Native conversion failed'); });
    const snapshot = { clock: '14:00:00', durationMs: 7_200_000, dueOffsetMs: 0, alarmOffsetMs: 0 };
    expect((await changeDraftAllDay(original, false, snapshot, fail)).snapshot).toBe(snapshot);
    expect(fail).not.toHaveBeenCalled();
    await expect(changeDraftAllDay(original, true, null, fail)).rejects.toThrow('Native conversion failed');
    expect(original).toEqual(before);
  });
  it('keeps its snapshot for content-only review but clears it after adopting another schedule or reloading', () => {
    const original = { draft: timed() }, snapshot = { clock: '14:00:00', durationMs: 7_200_000, dueOffsetMs: 0, alarmOffsetMs: 0 };
    expect(reviewedTimedSnapshot(snapshot, original, { draft: { ...original.draft, title: 'Renamed', notes: 'Latest' } })).toBe(snapshot);
    expect(reviewedTimedSnapshot(snapshot, original, { draft: { ...original.draft, eventStartMs: Date.UTC(2027, 0, 8) } })).toBeNull();
    expect(reviewedTimedSnapshot(snapshot, original, original, true)).toBeNull();
  });
});

describe('schedule-only editor preview', () => {
  it('previews blank titles without including content, membership or sound in its query identity', () => {
    const original = state(), changed = { draft: { ...original.draft, title: '', notes: 'Long private notes', listId: 'home', sound: 'system' as const, vibration: false } };
    expect(editorPreviewPayload(changed)).toEqual(editorPreviewPayload(original));
    expect(editorPreviewPayload(changed).title).toBe('Preview');
    expect(editorPreviewPayload(changed)).not.toHaveProperty('notes');
    expect(editorPreviewPayload(changed)).not.toHaveProperty('listId');
    expect(editorPreviewPayload(changed)).not.toHaveProperty('sound');
    expect(editorPreviewPayload({ draft: { ...original.draft, alarmAtMs: original.draft.alarmAtMs + 600_000 } })).not.toEqual(editorPreviewPayload(original));
  });
  it('omits linked all-day values for native defaults and retains explicit independent values and recurrence', () => {
    const original: EditorState = { draft: { ...state().draft, allDay: true }, recurrence: { frequency: 'daily', interval: 2, zoneMode: 'floating' } };
    expect(editorPreviewPayload(original)).not.toHaveProperty('dueAtMs');
    expect(editorPreviewPayload(original)).not.toHaveProperty('alarmAtMs');
    expect(editorPreviewPayload(original).recurrence).toEqual(original.recurrence);
    const independent = editorPreviewPayload({ ...original, draft: { ...original.draft, dueLinked: false, alarmLinked: false } });
    expect(independent).toMatchObject({ dueAtMs: original.draft.dueAtMs, alarmAtMs: original.draft.alarmAtMs });
  });
});
