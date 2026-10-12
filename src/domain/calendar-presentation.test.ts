import { describe, expect, it } from 'vitest';
import type { CalendarLink, CalendarLinkedOperation, CalendarPublication, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarCancellation, calendarSummary } from './calendar-presentation';
import { previewCalendar } from '../../verification/ui/preview-calendar';

const link: CalendarLink = { occurrenceId: 'review', revision: 1, calendarName: 'Source', state: 'Linked', checkedAtMs: null, message: '', htmlLink: '', readOnly: false, differs: false,
  accountEmail: 'owner@example.test', availability: 'Available', availabilityReason: '', observedAtMs: 1000, lastCheckAttemptAtMs: 1000, lastCheckErrorCode: '', remoteDiffers: false, requiresReview: false };
const item = { id: 'review', mode: 'Alarm', deleted: false, completed: false, skipped: false } as Occurrence;
describe('Calendar hierarchy and independent cancellation', () => {
  it('distinguishes published copies, unknown checks, differences and detached links', () => {
    expect(calendarSummary(link)).toBe('Linked');
    expect(calendarSummary({ ...link, observedAtMs: null })).toBe('Linked · Check for changes');
    expect(calendarSummary({ ...link, remoteDiffers: true })).toBe('Changes to review');
    expect(calendarSummary({ ...link, requiresReview: true })).toBe('Review linked updates');
    expect(calendarSummary({ ...link, state: 'Detached', availability: 'Deleted' })).toBe('Unlinked');
    expect(calendarSummary(undefined, { state: 'Published' } as CalendarPublication)).toBe('Published copy');
  });
  it('never presents an inaccessible or unsupported event as deleted', () => {
    expect(calendarCancellation(item, { ...link, availability: 'Unavailable' })).toBeNull();
    expect(calendarSummary({ ...link, availability: 'Unavailable' })).toBe('Google event unavailable');
    expect(calendarCancellation(item, { ...link, availability: 'Unsupported' })).toBeNull();
    expect(calendarSummary({ ...link, source: null })).toBe('Google access needed');
  });
  it('keeps a confirmed cancellation through a failed check and uses mode-specific consequences', () => {
    const deleted = { ...link, availability: 'Deleted' as const, lastCheckErrorCode: 'NETWORK' };
    expect(calendarCancellation(item, deleted)?.row).toContain('Remilo alarm unchanged');
    expect(calendarCancellation({ ...item, mode: 'Notification' }, deleted)?.row).toContain('notification unchanged');
    expect(calendarCancellation({ ...item, mode: 'None' }, deleted)?.detail).toContain('no Remilo alert is set');
    for (const state of ['completed', 'deleted', 'skipped']) expect(calendarCancellation({ ...item, [state]: true }, deleted)).toBeNull();
    expect(calendarCancellation(item, { ...deleted, state: 'Detached' })).toBeNull();
  });
  it('separates captured pending work from locally saved unknown remote outcomes', () => {
    const job = { state: 'Waiting', localApplied: false } as CalendarLinkedOperation;
    expect(calendarSummary(link, undefined, [job])).toBe('Request pending');
    expect(calendarSummary(link, undefined, [{ ...job, localApplied: true, state: 'Unconfirmed' }])).toBe('Google update not confirmed');
  });
  it('checks synthetic terminal links without changing the reminder or enabling updates', async () => {
    const reminder = { ...item, completed: true }, fixture = previewCalendar(new URLSearchParams('reviewCalendarLink=deleted&reviewCalendarOffline=1'), () => reminder, () => {});
    const before = { ...reminder }, checked = await fixture.checkCalendarLink('review');
    expect(checked.availability).toBe('Deleted'); expect(checked.lastCheckErrorCode).toBe('NETWORK');
    expect(reminder).toEqual(before); expect(checked.requiresReview).toBe(true);
  });
});
