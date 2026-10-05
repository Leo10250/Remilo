import { expect, it } from 'vitest';
import { civilAt, mergeCivil, pickerCivil } from './time';
it('projects the selected zone across civil-day boundaries', () => {
  const instant = Date.parse('2026-10-05T02:30:00Z');
  expect(civilAt(instant, 'America/Los_Angeles')).toBe('2026-10-04T19:30:00');
  expect(civilAt(instant, 'Asia/Tokyo')).toBe('2026-10-05T11:30:00');
});
it('uses picker offset instead of the host timezone, and merges only the edited parts', () => {
  expect(pickerCivil(Date.parse('2026-11-01T09:30:00Z'), -480)).toBe('2026-11-01T01:30:00');
  expect(mergeCivil('2026-10-05T09:45:12', '2026-10-08T12:00:00', 'date')).toBe('2026-10-08T09:45:12');
  expect(mergeCivil('2026-10-05T09:45:12', '2026-10-08T14:20:00', 'time')).toBe('2026-10-05T14:20:00');
});
