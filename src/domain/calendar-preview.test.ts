import { describe, expect, it } from 'vitest';
import { previewCalendar } from '../../verification/ui/preview-calendar';

const savedRequestId = 'synthetic-saved-calendar-sync';
const savedAtMs = Date.UTC(2026, 9, 29, 17, 24);
describe('Saved Calendar status preview fixtures', () => {
  it('seeds a deterministic completed global result without dispatch or change notification', async () => {
    let changes = 0;
    const api = previewCalendar(new URLSearchParams('reviewManaged=enabled&reviewSyncSaved=NoChanges'), () => undefined, () => changes++);
    expect((await api.getCalendarSyncSummary()).syncRequestId).toBe(savedRequestId);
    expect(await api.getCalendarOperationStatus(savedRequestId)).toMatchObject({
      kind: 'Sync', stage: 'Confirmed', currentScope: true, confirmed: 1,
      syncResult: { scope: { kind: 'AllAuthorized' }, outcome: 'NoChanges', changed: 0, checked: 1, startedAtMs: savedAtMs, finishedAtMs: savedAtMs },
    });
    expect(changes).toBe(0);
    await api.applyCalendarCommand({ kind: 'RequestCalendarSync', operationId: savedRequestId, scope: { kind: 'AllAuthorized' } });
    expect(changes).toBe(0);
    await expect(api.applyCalendarCommand({ kind: 'RequestCalendarSync', operationId: savedRequestId, scope: { kind: 'Association', occurrenceId: 'other' } })).rejects.toMatchObject({ code: 'OPERATION_REUSED' });
  });
  it('keeps Checking, Pending and blocked saved results distinct', async () => {
    for (const [outcome, stage] of [['Checking', 'CheckingEvents'], ['Pending', 'Waiting'], ['AccessRequired', 'NeedsAccess'], ['Failed', 'Failed']] as const) {
      const api = previewCalendar(new URLSearchParams(`reviewManaged=enabled&reviewSyncSaved=${outcome}`), () => undefined, () => {});
      expect((await api.getCalendarSyncSummary()).syncRequestId).toBe(savedRequestId);
      expect(await api.getCalendarOperationStatus(savedRequestId)).toMatchObject({ stage, currentScope: true, confirmed: 0,
        syncResult: { outcome, checked: 0, finishedAtMs: outcome === 'Checking' ? null : savedAtMs } });
    }
  });
  it('preserves Paused mode even when a previous saved check succeeded', async () => {
    const api = previewCalendar(new URLSearchParams('reviewManaged=paused&reviewSyncSaved=Synced'), () => undefined, () => {});
    expect((await api.getManagedCalendarState()).mode).toBe('Paused');
    expect((await api.getCalendarOperationStatus(savedRequestId))?.syncResult).toMatchObject({ outcome: 'Synced', changed: 1 });
  });
  it('fences saved results after a connection change without losing their receipt identity', async () => {
    const api = previewCalendar(new URLSearchParams('reviewSyncSaved=NoChanges'), () => undefined, () => {});
    const connection = await api.getCalendarConnection();
    await api.applyCalendarCommand({ kind: 'DisconnectCalendar', operationId: 'disconnect', expectedConnectionRevision: connection.revision });
    expect((await api.getCalendarSyncSummary()).syncRequestId).toBeUndefined();
    expect(await api.getCalendarOperationStatus(savedRequestId)).toMatchObject({ stage: 'Cancelled', currentScope: false, syncResult: { outcome: 'ScopeChanged' } });
  });
  it('does not expose a stale-scope or invalid fixture as the current global result', async () => {
    const stale = previewCalendar(new URLSearchParams('reviewSyncSaved=ScopeChanged'), () => undefined, () => {});
    expect((await stale.getCalendarSyncSummary()).syncRequestId).toBeUndefined();
    expect(await stale.getCalendarOperationStatus(savedRequestId)).toMatchObject({ currentScope: false, syncResult: { outcome: 'ScopeChanged' } });
    for (const query of ['', 'reviewSyncSaved=MadeUp']) {
      const api = previewCalendar(new URLSearchParams(query), () => undefined, () => {});
      expect((await api.getCalendarSyncSummary()).syncRequestId).toBeUndefined();
      expect(await api.getCalendarOperationStatus(savedRequestId)).toBeNull();
    }
  });
  it('keeps a later association-scoped check separate from the seeded global check', async () => {
    const api = previewCalendar(new URLSearchParams('reviewSyncSaved=NoChanges&reviewSyncOutcome=Synced'), () => undefined, () => {});
    await api.applyCalendarCommand({ kind: 'RequestCalendarSync', operationId: 'association', scope: { kind: 'Association', occurrenceId: 'reminder' } });
    expect((await api.getCalendarSyncSummary()).syncRequestId).toBe(savedRequestId);
    expect((await api.getCalendarOperationStatus('association'))?.syncResult).toMatchObject({ scope: { kind: 'Association', occurrenceId: 'reminder' }, outcome: 'Synced' });
  });
});
