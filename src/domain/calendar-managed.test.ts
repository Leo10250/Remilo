import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { CalendarReviewIssue, ManagedCalendarPreview, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarDispositionLabel, calendarReviewIssueReason, calendarReviewRoute, managedCalendarCapture, managedCalendarItemReason, managedCalendarStatus } from './calendar-managed';
import { previewCalendar } from '../../verification/ui/preview-calendar';

const reminder = { id: 'review', revision: 1, title: 'Local reminder', notes: '', zoneId: 'UTC', completed: false, deleted: false, skipped: false,
  eventStartMs: Date.now() + 3_600_000, eventEndMs: Date.now() + 5_400_000 } as Occurrence;
const fixture = (query: string) => previewCalendar(new URLSearchParams(query), id => id === 'review' ? reminder : undefined, () => {});

describe('Managed Calendar projection and deliberate permission boundary', () => {
  it('distinguishes paused work from unavailable access and unconfirmed creation', async () => {
    expect(managedCalendarStatus(await fixture('reviewManaged=paused').getManagedCalendarState())).toBe('Automatic sync paused');
    expect(managedCalendarStatus(await fixture('reviewManaged=access').getManagedCalendarState())).toBe('Google access needed');
    expect(managedCalendarStatus(await fixture('reviewManaged=unknown').getManagedCalendarState())).toBe('Calendar creation not confirmed');
  });
  it('states the alert consequences of an unimported or quietly recovered item accurately', () => {
    expect(managedCalendarItemReason({ kind: 'Import', reason: 'ElapsedAlert' })).toBe('No Remilo alert yet. Choose a future alert or No alert before importing.');
    expect(managedCalendarItemReason({ kind: 'RecoveredAlert', reason: 'ElapsedAlert' })).toContain('still has No alert');
    expect(managedCalendarItemReason({ kind: 'Transfer', reason: 'ElapsedAlert' })).toContain('current local target is kept');
  });
  it('labels the read-only contents sample without treating it as a complete import total', async () => {
    const preview = await fixture('reviewManaged=recognized').previewManagedCalendarSetup({});
    expect(preview.sample).toMatchObject({ inspectedCount: 100, complete: false });
    expect(preview.sample?.items).toHaveLength(2);
  });
  it('sends only reviewed native identities, selecting ready work and preserving calendar adoption guards', () => {
    const preview = { previewId: 'native-preview', kind: 'Setup', selectedCalendarId: 'owned-calendar', items: [{ itemId: 'ready', kind: 'Import', ready: true, title: 'Private title' },
      { itemId: 'unsafe', kind: 'Import', ready: false, title: 'Private title' }] } as ManagedCalendarPreview;
    expect(managedCalendarCapture(preview, 'operation', ['unsafe', 'ready', 'invented'])).toEqual({ kind: 'ConfirmManagedCalendarSetup', operationId: 'operation', previewId: 'native-preview', selectedItemIds: ['ready'], selectedCalendarId: 'owned-calendar' });
  });
  it('requires an explicit choice between multiple matching calendars and rejects unreviewed retargeting', async () => {
    const api = fixture('reviewManaged=multiple');
    const ambiguous = await api.previewManagedCalendarSetup({}); expect(ambiguous.complete).toBe(false);
    await expect(api.applyCalendarCommand(managedCalendarCapture(ambiguous, 'ambiguous', []))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const chosen = await api.previewManagedCalendarSetup({ selectedCalendarId: 'fixture-managed-calendar-2' });
    await expect(api.applyCalendarCommand({ ...managedCalendarCapture(chosen, 'chosen', []), selectedCalendarId: 'fixture-managed-calendar' })).rejects.toMatchObject({ code: 'STALE_PREVIEW' });
    expect((await api.getManagedCalendarState()).mode).toBe('Disabled');
  });
  it('recovers the same captured setup after a lost reply without granting another setup operation', async () => {
    const api = fixture('reviewManaged=create&reviewLostReply=1'), preview = await api.previewManagedCalendarSetup({}), command = managedCalendarCapture(preview, 'setup', ['incoming-future']);
    await expect(api.applyCalendarCommand(command)).rejects.toThrow('reply lost');
    const after = await api.getManagedCalendarState(); await api.applyCalendarCommand(command);
    expect(await api.getManagedCalendarState()).toEqual(after);
    await expect(api.applyCalendarCommand({ ...command, selectedItemIds: [] })).rejects.toMatchObject({ code: 'OPERATION_REUSED' });
  });
  it('keeps initial fresh-install recovery quiet while future import defaults remain Alarm', async () => {
    const api = fixture('reviewManaged=fresh'), preview = await api.previewManagedCalendarSetup({});
    expect(preview.initialMode).toBe('None'); expect(preview.policy.importMode).toBe('Alarm');
    await api.applyCalendarCommand(managedCalendarCapture(preview, 'setup', ['incoming-future']));
    const state = await api.getManagedCalendarState();
    const changed = await api.previewManagedCalendarPolicyChange({ expectedRevision: state.policy.revision, importMode: 'Notification' });
    await api.applyCalendarCommand(managedCalendarCapture(changed, 'policy', []));
    expect((await api.getManagedCalendarState()).initialMode).toBe('None');
    const alerts = await api.previewManagedCalendarRecoveredAlerts([]);
    expect(managedCalendarCapture(alerts, 'alerts', ['recovered-review', 'recovered-elapsed'])).toMatchObject({ selectedItemIds: ['recovered-review'] });
  });
  it('saves creation preferences separately and holds new intent while paused', async () => {
    const api = fixture('reviewManaged=paused');
    api.captureCalendarCreation('new-local', 'LocalOnly'); api.captureCalendarCreation('new-synced', 'Default');
    expect(await api.getCalendarReminderDisposition('new-local')).toMatchObject({ disposition: 'LocalOnly', state: 'LocalOnly' });
    const held = await api.getCalendarReminderDisposition('new-synced');
    expect(held?.state).toBe('Held'); expect(calendarDispositionLabel(held!)).toBe('Not linked · Waiting to publish · Sync paused');
    const resume = await api.previewManagedCalendarResume();
    await api.applyCalendarCommand(managedCalendarCapture(resume, 'resume', ['export:new-synced']));
    expect((await api.getCalendarReminderDisposition('new-synced'))?.state).toBe('WaitingToPublish');
    expect((await api.getCalendarReminderDisposition('new-local'))?.state).toBe('LocalOnly');
    expect((await api.getCalendarReminderDisposition('review'))?.state).toBe('Held');
  });
  it('routes incoming and setup issues without manufacturing reminder identities', async () => {
    const api = fixture('reviewManaged=candidate&reviewCalendarSync=conflict'), page = await api.getCalendarReviewIssues(null);
    expect(page.items.map(issue => issue.kind).sort()).toEqual(['Association', 'Candidate']);
    const candidate = page.items.find(issue => issue.kind === 'Candidate')!;
    expect(calendarReviewRoute(candidate)).toEqual({ pathname: '/calendar-review', params: { candidateId: 'synthetic-incoming' } });
    expect('occurrenceId' in candidate).toBe(false);
    expect(calendarReviewIssueReason(candidate)).toBe('Choose a future alert or No alert before importing.');
    expect(calendarReviewRoute({ kind: 'Setup', issueId: 'setup', title: 'Calendar access', reason: 'AccessRequired', discoveredAtMs: 1 } satisfies CalendarReviewIssue)).toEqual({ pathname: '/calendar' });
    expect((await api.getCalendarSyncSummary()).reviewCount).toBe(2);
    expect(page.counts).toEqual({ reminders: 1, candidates: 1, setup: 0, total: 2 });
    await api.applyCalendarCommand({ kind: 'IgnoreManagedCalendarCandidate', operationId: 'ignore', candidateId: 'synthetic-incoming', expectedRevision: 1 });
    expect((await api.getCalendarReviewIssues(null)).items.map(issue => issue.kind)).toEqual(['Association']);
  });
  it('keeps partial discovery unconfirmable and supports named-zone creation review', async () => {
    const incomplete = fixture('reviewManaged=incomplete'), partial = await incomplete.previewManagedCalendarSetup({});
    expect(partial.complete).toBe(false);
    await expect(incomplete.applyCalendarCommand(managedCalendarCapture(partial, 'partial', []))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const create = await fixture('reviewManaged=create').previewManagedCalendarSetup({ calendarZone: 'Asia/Shanghai' });
    expect(create.calendarZone).toBe('Asia/Shanghai');
    const renamed = await fixture('reviewManaged=renamed').previewManagedCalendarSetup({});
    expect(renamed.calendarCandidates[0]).toMatchObject({ recognition: 'Bound', name: 'My renamed reminders / 已更名日历' });
  });
  it('stops new export capture while disabled without resuming historical held work', async () => {
    const api = fixture('reviewManaged=paused'), saved = await api.getManagedCalendarState();
    await api.applyCalendarCommand({ kind: 'DisableManagedCalendar', operationId: 'disable', expectedRevision: saved.revision });
    api.captureCalendarCreation('after-disable', 'Default');
    expect(await api.getCalendarReminderDisposition('after-disable')).toBeNull();
    expect((await api.getCalendarReminderDisposition('review'))?.state).toBe('LocalOnly');
  });
  it('requires reviewed field choices when adopting an exact existing local copy', async () => {
    const api = fixture('reviewManaged=adoption'), preview = await api.previewManagedCalendarCandidate('synthetic-incoming', {});
    expect(preview.local?.title).toBe(reminder.title);
    const command = { kind: 'ImportManagedCalendarCandidate', operationId: 'adopt', previewId: preview.previewId, automaticSync: true } as const;
    await expect(api.applyCalendarCommand(command)).rejects.toMatchObject({ code: 'RESOLUTION_REQUIRED' });
    await api.applyCalendarCommand({ ...command, selections: { title: 'remilo', notes: 'remilo', schedule: 'remilo' } });
    expect((await api.getCalendarLinks()).map(link => link.occurrenceId)).toEqual(['review']);
  });
  it('rejects a stale account before setup capture and preserves deliberate Local only revisions', async () => {
    const api = fixture('reviewManaged=local-only'), preview = await api.previewManagedCalendarSetup({}); await api.authorizeCalendar(null);
    await expect(api.applyCalendarCommand(managedCalendarCapture(preview, 'stale', []))).rejects.toMatchObject({ code: 'STALE_PREVIEW' });
    const disposition = await api.getCalendarReminderDisposition('review');
    await expect(api.applyCalendarCommand({ kind: 'SetCalendarReminderDisposition', operationId: 'local', occurrenceId: 'review', expectedRevision: disposition!.revision + 1, disposition: 'LocalOnly' })).rejects.toMatchObject({ code: 'STALE_REVISION' });
  });
  it('keeps all new fixture operations inside the memory-only adapter', () => {
    const source = readFileSync('verification/ui/preview-calendar-managed.ts', 'utf8');
    expect(source).not.toMatch(/fetch\s*\(|XMLHttpRequest|https:\/\/|RemiloAlarmModule|AuthorizationClient|requireNativeModule|axios|localStorage|indexedDB/);
  });
});
