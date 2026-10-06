import { describe, expect, it, vi } from 'vitest';
import type { TimeConversionInput } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { changeDraftZone, chooseConflict, editorDraft, moveDraftDue, moveDraftEvent, reviewChoicesComplete, reviewEditorDraft, type EditorState } from './editor-draft';
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
