import { describe, expect, it } from 'vitest';
import { publicationCommand } from './calendar';
import { previewCalendar } from '../../verification/ui/preview-calendar';
import type { CalendarPublicationPreview, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { readFileSync } from 'node:fs';

describe('Calendar publication boundary', () => {
  it('sends native guards and identity without accepting replacement private content', () => {
    const preview = { occurrenceId: 'one', reminderRevision: 3, connectionRevision: 4, fingerprint: 'hash', title: 'Private', notes: 'Secret' } as CalendarPublicationPreview;
    expect(publicationCommand(preview, 'operation')).toEqual({ kind: 'PublishOneOff', operationId: 'operation', occurrenceId: 'one', expectedRevision: 3, expectedConnectionRevision: 4, fingerprint: 'hash' });
  });
  it('isolated fixtures cannot authorize accounts or perform network writes', () => {
    const source = readFileSync('verification/ui/preview-calendar.ts', 'utf8');
    expect(source).not.toMatch(/fetch\s*\(|XMLHttpRequest|https:\/\/|RemiloAlarmModule|AuthorizationClient|requireNativeModule|axios/);
  });
  it('fixture cancellation preserves confirmed configuration', async () => {
    const fixture = previewCalendar(new URLSearchParams('reviewCalendarConsent=cancel'), () => undefined, () => {});
    const before = await fixture.getCalendarConnection(); await fixture.authorizeCalendar(null); expect(await fixture.getCalendarConnection()).toEqual(before);
  });
  it('fixture lost reply retains authority and exact retry without replacing publication', async () => {
    const item = { id: 'one', revision: 1, zoneId: 'UTC', title: 'Synthetic', notes: '', eventStartMs: 1000, eventEndMs: 2000 } as Occurrence;
    const fixture = previewCalendar(new URLSearchParams('reviewLostReply=1&reviewCalendarOffline=1'), () => item, () => {});
    const cmd = publicationCommand(await fixture.previewCalendarPublication('one'), 'operation');
    await expect(fixture.applyCalendarCommand(cmd)).rejects.toThrow('reply lost'); await fixture.applyCalendarCommand(cmd);
    expect(await fixture.getCalendarPublications()).toHaveLength(1);
    await expect(fixture.previewCalendarPublication('one')).rejects.toMatchObject({ code: 'ALREADY_PUBLISHED' });
  });
});
