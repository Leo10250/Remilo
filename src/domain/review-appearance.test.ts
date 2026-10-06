import { describe, expect, it } from 'vitest';
import { reviewCategories, reviewPalette, reviewPalettes, reviewPeriodAt, reviewPeriodForMinute, reviewReminderAppearance } from '../ui/review-appearance';
import { reviewCollectionItems, reviewDescriptor, reviewItems, reviewNowMs, reviewRepeatFamilies, reviewScenarios, reviewScenarioState, reviewZone } from '../../verification/ui/design-review-fixtures';

function luminance(hex: string): number {
  const rgb = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + .05) / (dark + .05);
}

describe('candidate review palette roles', () => {
  for (const entry of reviewPalettes) {
    it.each(['light', 'dark'] as const)(`${entry.name} %s body, status and controls remain readable`, (brightness) => {
      const colors = reviewPalette(entry.id, brightness);
      for (const backdrop of ['background', 'surface', 'soft'] as const) {
        for (const role of ['ink', 'muted', 'accent', 'danger', 'warning', 'success'] as const) {
          expect(contrast(colors[role], colors[backdrop]), `${role} on ${backdrop}`).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(colors.outline, colors[backdrop]), `essential outline on ${backdrop}`).toBeGreaterThanOrEqual(3);
      }
      expect(contrast(colors.accentInk, colors.accent), 'primary action text').toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.accent, colors.surface), 'selection icon and focus indicator').toBeGreaterThanOrEqual(3);
    });
  }
  it('keeps decorative swatches separate from essential outlines and readable colors', () => {
    expect(reviewPalettes).toHaveLength(8);
    expect(new Set(reviewPalettes.map((entry) => entry.id)).size).toBe(8);
    expect(new Set(reviewPalettes.map((entry) => reviewPalette(entry.id, 'light').accent)).size).toBe(8);
    expect(reviewCategories).toHaveLength(9);
  });
});

describe('five authored time periods', () => {
  it.each([[359, 'night'], [360, 'morning'], [599, 'morning'], [600, 'midday'], [959, 'midday'],
    [960, 'afternoon'], [1199, 'afternoon'], [1200, 'evening'], [1379, 'evening'], [1380, 'night'],
    [1439, 'night'], [1440, 'night'], [-1, 'night']] as const)('minute %i resolves %s', (minute, expected) => {
    expect(reviewPeriodForMinute(minute).id).toBe(expected);
  });
  it('uses the occurrence zone rather than the host zone', () => {
    expect(reviewPeriodAt(reviewNowMs, reviewZone).id).toBe('morning');
    expect(reviewPeriodAt(reviewNowMs, 'Asia/Shanghai').id).toBe('night');
    expect(reviewPeriodAt(reviewNowMs, 'Europe/London').id).toBe('afternoon');
  });
});

describe('explicit appearance expectations shared by the comparison', () => {
  const defaults = { fixedPalette: 'classic', colorMode: 'time', smartColors: true } as const;
  it('shows content identity inside one ambient morning, with a deterministic time fallback', () => {
    const items = reviewItems('populated');
    const resolve = (id: string, smartColors = true) => {
      const item = items.find((candidate) => candidate.id === id)!;
      return reviewReminderAppearance(item, { ...defaults, smartColors, descriptor: reviewDescriptor(item) });
    };
    expect(resolve('water').palette).toBe('meadow');
    expect(resolve('medicine').palette).toBe('sky');
    expect(resolve('read').palette).toBe('classic');
    expect(resolve('read', false)).toMatchObject({ palette: 'mist', source: 'event-time', category: 'general' });
  });
  it('manual choice wins even when Smart Colors are disabled', () => {
    const item = reviewItems('multilingual').find((candidate) => candidate.id === 'manual')!;
    expect(reviewReminderAppearance(item, { ...defaults, smartColors: false, descriptor: reviewDescriptor(item) }))
      .toMatchObject({ palette: 'rose', source: 'manual' });
    const descriptor = reviewDescriptor(item);
    delete descriptor.manualPalette;
    expect(reviewReminderAppearance(item, { ...defaults, descriptor })).toMatchObject({ palette: 'sky', source: 'content' });
  });
  it('Snooze and Postpone do not change the authored event identity', () => {
    const item = reviewItems('overdue').find((candidate) => candidate.id === 'postponed')!;
    const options = { ...defaults, smartColors: false, descriptor: reviewDescriptor(item) };
    const initial = reviewReminderAppearance(item, options);
    expect(initial).toMatchObject({ palette: 'sky', source: 'event-time' });
    expect(reviewReminderAppearance({ ...item, nextAlertMs: reviewNowMs + 8 * 3_600_000, alertAdjustment: 'Snoozed' }, options)).toEqual(initial);
    expect(reviewReminderAppearance({ ...item, eventStartMs: reviewNowMs + 10 * 3_600_000 }, options).palette).toBe('peach');
  });
  it('all-day content uses its confident descriptor or the ambient color, never midnight', () => {
    const [general, birthday] = reviewItems('all-day');
    expect(reviewReminderAppearance(general, { ...defaults, ambientPalette: 'sunrise', descriptor: reviewDescriptor(general) }))
      .toMatchObject({ palette: 'sunrise', source: 'global' });
    expect(reviewReminderAppearance(general, { ...defaults, colorMode: 'fixed', ambientPalette: 'sunrise', descriptor: reviewDescriptor(general) }))
      .toMatchObject({ palette: 'classic', source: 'global' });
    expect(reviewReminderAppearance(birthday, { ...defaults, ambientPalette: 'sunrise', descriptor: reviewDescriptor(birthday) }))
      .toMatchObject({ palette: 'rose', source: 'content' });
  });
  it('uses explicit Chinese, emoji and ambiguous examples without pretending to classify arbitrary text', () => {
    const items = reviewItems('multilingual');
    expect(reviewDescriptor(items[0]).category).toBe('health');
    expect(reviewDescriptor(items[1]).category).toBe('nature');
    expect(reviewDescriptor(items[2]).category).toBe('nature');
    for (const id of ['ambiguous', 'unsupported']) {
      const item = items.find((candidate) => candidate.id === id)!;
      expect(reviewReminderAppearance(item, { ...defaults, colorMode: 'fixed', descriptor: reviewDescriptor(item) }))
        .toMatchObject({ palette: 'classic', category: 'general', source: 'global' });
    }
    expect(reviewDescriptor({ id: 'unknown-title' })).toMatchObject({ category: 'general', confidence: 'general' });
  });
});

describe('shared frozen review content', () => {
  it.each(reviewScenarios)('$name returns independent copies unchanged by ambient period', ({ id }) => {
    const expected = reviewItems(id);
    const changed = reviewItems(id, 'night');
    expect(changed).toEqual(expected);
    if (changed.length) {
      changed[0].title = 'A local review edit';
      changed[0].history!.push({ kind: 'Local fixture edit', atMs: reviewNowMs, targetMs: null });
      expect(reviewItems(id)).toEqual(expected);
    }
  });
  it('preserves independent due and alert instants plus unfinished delivery outcomes', () => {
    const independent = reviewItems('independent')[0];
    expect(independent.alarmAtMs).toBeLessThan(independent.dueAtMs);
    expect(independent.dueAtMs).toBeLessThan(independent.eventStartMs);
    expect(independent).toMatchObject({ dueLinked: false, alarmLinked: false });
    const [stopped, postponed] = reviewItems('overdue');
    expect(stopped).toMatchObject({ completed: false, overdue: true, deliveryState: 'Stopped', nextAlertMs: null });
    expect(postponed.nextAlertMs).toBeGreaterThan(reviewNowMs);
    expect(postponed.eventStartMs).toBeLessThan(reviewNowMs);
    expect(reviewItems('error')).toEqual(reviewItems('populated'));
    expect(reviewScenarioState('error')).toEqual({ loading: false, error: true, empty: false });
  });
  it('represents Active, Paused and Ended families with correct local repeat previews', () => {
    const families = reviewRepeatFamilies();
    expect(families.map((value) => value.state)).toEqual(['Active', 'Paused', 'Ended']);
    expect(families[1].current.registered).toBe(0);
    expect(families[1].upcoming.map((slot) => slot.nominalSlot)).toEqual(['2026-10-08T17:00:00', '2026-10-13T17:00:00', '2026-10-15T17:00:00']);
    expect(families[2].upcoming).toEqual([]);
    expect(families[2].unfinishedCount).toBe(1);
  });
  it('provides distinct completed and recoverable Trash records with recorded timestamps', () => {
    const completed = reviewCollectionItems('completed');
    const trash = reviewCollectionItems('trash');
    expect(completed.every((item) => !item.deleted && (item.completed || item.skipped))).toBe(true);
    expect(trash[0]).toMatchObject({ deleted: true, completed: false, nextAlertMs: null, deliveryState: 'Deleted' });
    expect(trash[0].history?.find((entry) => entry.kind === 'Delete')?.atMs).toBe(trash[0].collectionAtMs);
    expect(reviewItems('populated').some((item) => item.deleted)).toBe(false);
    trash[0].deleted = false;
    expect(reviewCollectionItems('trash')[0].deleted).toBe(true);
  });
});
