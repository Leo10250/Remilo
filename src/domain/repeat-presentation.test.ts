import { describe, expect, it } from 'vitest';
import { matchesRepeatPreset, repeatExplanation } from './repeat';
import { editorDraft, editorPreviewPayload } from './editor-draft';
import type { RecurrenceDraft } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
const base: RecurrenceDraft = { frequency: 'daily', interval: 1, weekdays: [6], day: 10, month: 10, zoneMode: 'floating' };
describe('contextual recurrence presentation', () => {
  it('explains only rules with consequential date semantics', () => {
    expect(repeatExplanation(base)).toBeNull();
    expect(repeatExplanation({ ...base, frequency: 'monthlyDay', day: 28 })).toBeNull();
    for (const day of [29, 30, 31]) expect(repeatExplanation({ ...base, frequency: 'monthlyDay', day })).toBe('missingMonthDate');
    expect(repeatExplanation({ ...base, frequency: 'monthlyOrdinal', ordinal: 5 })).toBe('fifthWeekday');
    expect(repeatExplanation({ ...base, frequency: 'monthlyOrdinal', ordinal: -1 })).toBeNull();
    expect(repeatExplanation({ ...base, frequency: 'lastWeekday' })).toBe('lastWeekday');
    expect(repeatExplanation({ ...base, frequency: 'yearly', month: 2, day: 29 })).toBe('leapYear');
    expect(repeatExplanation({ ...base, frequency: 'yearly', month: 4, day: 31 })).toBe('missingYearDate');
  });
  it('distinguishes simple presets from custom endings, intervals and dates', () => {
    expect(matchesRepeatPreset(base, base, 'daily')).toBe(true);
    for (const patch of [{ count: 10 }, { until: '2027-01-01' }, { interval: 2 }]) expect(matchesRepeatPreset({ ...base, ...patch }, base, 'daily')).toBe(false);
    expect(matchesRepeatPreset({ ...base, frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] }, base, 'weekly', [1, 2, 3, 4, 5])).toBe(true);
    expect(matchesRepeatPreset({ ...base, frequency: 'monthlyDay', day: 31 }, base, 'monthlyDay')).toBe(false);
  });
  it('keeps custom preview identity independent of content while retaining schedule and rule', () => {
    const draft = editorDraft({ title: 'A', notes: 'Private', zoneId: 'UTC', eventStartMs: 2_000_000_000_000 });
    const first = editorPreviewPayload({ draft, recurrence: base });
    expect(editorPreviewPayload({ draft: { ...draft, title: 'Changed', notes: 'Different' }, recurrence: base })).toEqual(first);
    expect(editorPreviewPayload({ draft, recurrence: { ...base, interval: 2 } })).not.toEqual(first);
    expect(editorPreviewPayload({ draft: { ...draft, alarmAtMs: draft.alarmAtMs + 60_000 }, recurrence: base })).not.toEqual(first);
  });
});
