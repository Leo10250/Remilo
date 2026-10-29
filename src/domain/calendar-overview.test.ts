import { afterEach, describe, expect, it } from 'vitest';
import type { CalendarOperationStatus } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { previewCalendar } from '../../verification/ui/preview-calendar';
import { confirmLanguage } from '../localization';
import { calendarAutomaticSyncPresentation, calendarOverviewPresentation } from './calendar-overview';

async function fixture(query = 'reviewManaged=enabled&reviewSyncSaved=NoChanges') {
  const api = previewCalendar(new URLSearchParams(query), () => undefined, () => {});
  const connection = await api.getCalendarConnection(), managed = await api.getManagedCalendarState(), summary = await api.getCalendarSyncSummary();
  const status = summary.syncRequestId ? await api.getCalendarOperationStatus(summary.syncRequestId) : null;
  return { connection, managed, summary, status };
}
afterEach(() => confirmLanguage('en'));

describe('Calendar overview separates permission, checked outcome and next action', () => {
  it('restores completed native whole-scope outcomes with their check time, not the per-reminder timestamp', async () => {
    for (const outcome of ['NoChanges', 'Synced']) {
      const f = await fixture(`reviewManaged=enabled&reviewSyncSaved=${outcome}`);
      expect(calendarOverviewPresentation(f.connection, { ...f.managed, successfulAtMs: 999 }, f.summary, f.status)).toMatchObject({
        state: 'UpToDate', title: 'Up to date', tone: 'success', action: 'Sync', checkedAtMs: f.status!.syncResult!.finishedAtMs,
      });
    }
  });
  it('never treats enabled policy, Ready, an observation or one successful reminder as a completed check', async () => {
    const f = await fixture('reviewManaged=enabled');
    const view = calendarOverviewPresentation(f.connection, { ...f.managed, successfulAtMs: 999, lastObservedAtMs: 999 }, f.summary);
    expect(view).toMatchObject({ state: 'Unchecked', tone: 'muted', action: 'Sync' });
    expect(view.checkedAtMs).toBeUndefined();
    expect(calendarAutomaticSyncPresentation(f.managed)).toEqual({ value: 'On', summary: 'Automatic updates are enabled.' });
  });
  it('requires the right scope, native completion and usable check timestamp for green success', async () => {
    const f = await fixture(), status = f.status!;
    const invalid: CalendarOperationStatus[] = [
      { ...status, currentScope: false }, { ...status, kind: 'Setup' }, { ...status, stage: 'Waiting' }, { ...status, correlationComplete: false },
      { ...status, syncResult: { ...status.syncResult!, scope: { kind: 'Association', occurrenceId: 'other' } } },
      { ...status, syncResult: { ...status.syncResult!, finishedAtMs: null } },
      { ...status, syncResult: { ...status.syncResult!, finishedAtMs: NaN } },
    ];
    for (const value of invalid) expect(calendarOverviewPresentation(f.connection, f.managed, f.summary, value).state).not.toBe('UpToDate');
  });
  it('shows genuine active work, but does not animate queued requests or pending background work as syncing', async () => {
    const f = await fixture('reviewManaged=enabled&reviewSyncSaved=Checking');
    expect(calendarOverviewPresentation(f.connection, f.managed, f.summary, f.status)).toMatchObject({ state: 'Syncing', title: 'Syncing changes…', action: 'None' });
    expect(calendarOverviewPresentation(f.connection, f.managed, f.summary, { ...f.status!, stage: 'Waiting' })).toMatchObject({ state: 'Pending', tone: 'muted' });
    expect(calendarOverviewPresentation(f.connection, f.managed, { ...f.summary, pendingCount: 2 })).toMatchObject({ state: 'Pending' });
    const pending = await fixture('reviewManaged=enabled&reviewSyncSaved=Pending');
    expect(calendarOverviewPresentation(pending.connection, pending.managed, pending.summary, pending.status)).toMatchObject({ state: 'Pending', action: 'Sync', description: expect.stringMatching(/connection/i) });
  });
  it('gives new live pending, held and review work precedence over earlier success', async () => {
    const f = await fixture();
    for (const managed of [{ ...f.managed, pendingExportCount: 1 }, { ...f.managed, pendingChangeCount: 1 }, { ...f.managed, heldExportCount: 1 }]) {
      expect(calendarOverviewPresentation(f.connection, managed, f.summary, f.status)).toMatchObject({ state: 'Pending', tone: 'muted' });
    }
    expect(calendarOverviewPresentation(f.connection, f.managed, { ...f.summary, reviewCount: 1 }, f.status)).toMatchObject({ state: 'Review', action: 'ReviewItems', tone: 'warning' });
    expect(calendarOverviewPresentation(f.connection, f.managed, f.summary, { ...f.status!, review: 1 })).toMatchObject({ state: 'Review' });
  });
  it('shows paused permission explicitly and preserves the existing reviewed Resume action', async () => {
    const f = await fixture('reviewManaged=paused&reviewSyncSaved=Paused');
    const view = calendarOverviewPresentation(f.connection, f.managed, f.summary, f.status);
    expect(view).toMatchObject({ state: 'Paused', action: 'Resume', tone: 'muted' });
    expect(view.checkedAtMs).toBeUndefined();
    expect(calendarAutomaticSyncPresentation(f.managed).value).toBe('Paused');
    const off = { ...f.managed, mode: 'Disabled' as const };
    const offView = calendarOverviewPresentation(f.connection, off, f.summary, f.status);
    expect(offView).toMatchObject({ state: 'Setup', action: 'Setup' });
    expect(calendarAutomaticSyncPresentation(off).value).toBe('Off');
    expect(calendarOverviewPresentation(f.connection, { ...off, phase: 'InitialImport' }, f.summary, f.status)).toMatchObject({ state: 'Setup', action: 'Setup', tone: 'muted' });
  });
  it('keeps current access/error recovery prominent and a historical failure timestamp quiet', async () => {
    const f = await fixture('reviewManaged=enabled&reviewSyncSaved=AccessRequired');
    const view = calendarOverviewPresentation(f.connection, f.managed, f.summary, f.status);
    expect(view).toMatchObject({ state: 'Error', title: 'Sync blocked', action: 'Connect', tone: 'danger' });
    expect(calendarAutomaticSyncPresentation(f.managed)).toEqual({ value: 'On', summary: 'Automatic updates are enabled.' });
    const ready = await fixture();
    expect(calendarOverviewPresentation(ready.connection, { ...ready.managed, failedAtMs: 999 }, ready.summary, ready.status).state).toBe('UpToDate');
    const failed = await fixture('reviewManaged=enabled&reviewSyncSaved=Failed');
    expect(calendarOverviewPresentation(failed.connection, failed.managed, failed.summary, failed.status)).toMatchObject({ state: 'Error', action: 'Retry' });
  });
  it('does not hide current global blockers behind the selected calendar’s paused/off controls', async () => {
    const f = await fixture('reviewManaged=enabled&reviewSyncSaved=AccessRequired');
    for (const mode of ['Paused', 'Disabled'] as const) {
      const managed = { ...f.managed, mode };
      const view = calendarOverviewPresentation(f.connection, managed, f.summary, f.status);
      expect(view).toMatchObject({ state: 'Error', action: 'Connect' });
      expect(calendarAutomaticSyncPresentation(managed).value).toBe(mode === 'Paused' ? 'Paused' : 'Off');
      expect(calendarOverviewPresentation(f.connection, managed, { ...f.summary, reviewCount: 1 }, { ...f.status!, currentScope: false })).toMatchObject({ state: 'Review', action: 'ReviewItems' });
      expect(calendarOverviewPresentation(f.connection, managed, f.summary, { ...f.status!, currentScope: false }).state).toBe(mode === 'Paused' ? 'Paused' : 'Setup');
    }
  });
  it('reports a real global check on other authorized calendars even when the selected calendar is paused/off', async () => {
    const f = await fixture('reviewManaged=enabled&reviewSyncSaved=Checking');
    for (const mode of ['Paused', 'Disabled'] as const) {
      const managed = { ...f.managed, mode };
      const view = calendarOverviewPresentation(f.connection, managed, f.summary, f.status);
      expect(view).toMatchObject({ state: 'Syncing', action: 'None' });
      expect(calendarAutomaticSyncPresentation(managed).value).toBe(mode === 'Paused' ? 'Paused' : 'Off');
      expect(calendarOverviewPresentation(f.connection, managed, f.summary, { ...f.status!, currentScope: false }).state).toBe(mode === 'Paused' ? 'Paused' : 'Setup');
    }
  });
  it('does not show old green success while capture or status inspection is uncertain', async () => {
    const f = await fixture();
    expect(calendarOverviewPresentation(f.connection, f.managed, f.summary, f.status, { submitting: true })).toMatchObject({ state: 'Syncing', title: 'Requesting sync…', action: 'None' });
    expect(calendarOverviewPresentation(f.connection, f.managed, f.summary, f.status, { uncertain: true })).toMatchObject({ state: 'Review', action: 'None', tone: 'warning' });
    expect(calendarOverviewPresentation(f.connection, f.managed, f.summary, f.status, { unavailable: true })).toMatchObject({ state: 'Unchecked', action: 'Refresh', tone: 'muted' });
    expect(calendarOverviewPresentation(f.connection, f.managed, f.summary, null, { inspecting: true })).toMatchObject({ state: 'Unchecked', title: 'Reading sync status…', action: 'None' });
    expect(calendarOverviewPresentation(f.connection, f.managed, undefined, f.status).state).not.toBe('UpToDate');
  });
  it('retains setup/access/review ownership rather than turning Ready with pending imports into success', async () => {
    const f = await fixture('reviewManaged=partial&reviewSyncSaved=NoChanges');
    expect(calendarOverviewPresentation(f.connection, f.managed, f.summary, f.status).state).toBe('Pending');
    const access = await fixture('reviewManaged=access');
    expect(calendarOverviewPresentation(access.connection, access.managed, access.summary)).toMatchObject({ state: 'Error', action: 'Authorize' });
    const initial = await fixture('reviewManaged=initial-import');
    expect(calendarOverviewPresentation(initial.connection, initial.managed, initial.summary)).toMatchObject({ state: 'Setup', action: 'Progress' });
  });
  it('uses natural Chinese state and control labels without rewriting authored Calendar content', async () => {
    const f = await fixture(); confirmLanguage('zh-Hans');
    const view = calendarOverviewPresentation(f.connection, f.managed, f.summary, f.status);
    expect(view.title).toBe('已是最新状态');
    expect(calendarAutomaticSyncPresentation(f.managed).value).toBe('已开启');
    expect(f.managed.calendarName).toBe('Remilo / 测试日历');
  });
});
