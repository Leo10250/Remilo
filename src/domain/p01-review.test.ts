import { describe, expect, it } from 'vitest';
import { p01Colors, p01LandscapeBounds } from '../ui/p01-review';
import { reviewItems, reviewNowMs } from '../../verification/ui/design-review-fixtures';
import { reviewContentAction } from '../../verification/ui/review-actions';

describe('P01 isolated composition', () => {
  it('uses safe light/dark fallback roles when review tokens fail', () => {
    for (const dark of [false, true]) {
      const fallback = p01Colors(dark, true);
      expect(fallback.dark).toBe(dark);
      expect(fallback.ink).not.toBe(fallback.background);
      expect(fallback.accentInk).not.toBe(fallback.accent);
    }
  });
  it('preserves the environmental motif and aspect ratio when content needs more space', () => {
    for (const [width, height] of [[360, 800], [412, 915], [800, 1024]]) {
      const normal = p01LandscapeBounds(width, height, 1), large = p01LandscapeBounds(width, height, 2);
      expect(large.height).toBeGreaterThan(200);
      expect(large.height).toBeLessThan(normal.height);
      expect(large.width / large.imageHeight).toBe(1.5);
      expect(large.width).toBeGreaterThanOrEqual(width);
      expect(large.left + large.width / 2).toBe(width / 2);
    }
  });
  it('keeps occurrence identity, times and memory-only revision-safe completion', () => {
    const original = reviewItems('populated')[0];
    const { item: completed } = reviewContentAction(original, 'done', reviewNowMs);
    expect(completed.id).toBe(original.id);
    expect(completed.eventStartMs).toBe(original.eventStartMs);
    expect(completed.dueAtMs).toBe(original.dueAtMs);
    expect(completed.alarmAtMs).toBe(original.alarmAtMs);
    expect(completed.completed).toBe(true);
    expect(original.completed).toBe(false);
  });
});
