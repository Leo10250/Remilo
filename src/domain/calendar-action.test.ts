import { describe, expect, it } from 'vitest';
import type { CalendarCommand } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { CalendarAction } from './calendar-action';
import { calendarActivityLabel, calendarLinkStatus, calendarSyncOutcome } from './calendar-ux';
import { previewCalendar } from '../../verification/ui/preview-calendar';

const command = (id: string): Extract<CalendarCommand, { kind: 'RequestCalendarSync' }> => ({ kind: 'RequestCalendarSync', operationId: id, scope: { kind: 'AllAuthorized' } });
describe('Calendar explicit action feedback', () => {
  it('recovers a lost acknowledgement without dispatching a second request', async () => {
    const api = previewCalendar(new URLSearchParams('reviewLostReply=1'), () => undefined, () => {});
    const action = new CalendarAction(api.applyCalendarCommand, api.getCalendarOperationStatus);
    expect(await action.run(command('one'))).toBe(true);
    expect(action.snapshot()).toMatchObject({ unknown: false, operationId: 'one', error: '' });
    expect((await api.getCalendarOperationStatus('one'))?.syncResult).toMatchObject({ outcome: 'NoChanges', changed: 0 });
    await expect(api.applyCalendarCommand({ ...command('one'), scope: { kind: 'Association', occurrenceId: 'other' } })).rejects.toMatchObject({ code: 'OPERATION_REUSED' });
  });
  it('retains the exact command when both dispatch and inspection are uncertain', async () => {
    const dispatched: CalendarCommand[] = [];
    const action = new CalendarAction(async value => { dispatched.push(value); if (dispatched.length === 1) throw new Error('reply lost'); }, async () => { throw new Error('read unavailable'); });
    expect(await action.run(command('original'))).toBe(false);
    expect(action.snapshot().unknown).toBe(true);
    expect(await action.run(command('replacement'))).toBe(true);
    expect(dispatched.map(value => value.operationId)).toEqual(['original', 'original']);
  });
  it('coalesces simultaneous presses before the first asynchronous acknowledgement', async () => {
    let complete!: () => void; const calls: CalendarCommand[] = [];
    const action = new CalendarAction(value => { calls.push(value); return new Promise<void>(resolve => { complete = resolve; }); }, async () => null);
    const first = action.run(command('one'));
    expect(await action.run(command('two'))).toBe(false); complete(); await first;
    expect(calls).toHaveLength(1); expect(action.snapshot().busy).toBe(false);
  });
  it('keeps association results separate from global results and fences account changes', async () => {
    const api = previewCalendar(new URLSearchParams('reviewSyncOutcome=Synced'), () => undefined, () => {});
    await api.applyCalendarCommand({ ...command('one'), scope: { kind: 'Association', occurrenceId: 'reminder' } });
    expect((await api.getCalendarSyncSummary()).syncRequestId).toBeUndefined();
    const status = (await api.getCalendarOperationStatus('one'))!;
    expect(calendarSyncOutcome(status)).toMatchObject({ title: 'Changes synced', tone: 'success' });
    const connection = await api.getCalendarConnection();
    await api.applyCalendarCommand({ kind: 'DisconnectCalendar', operationId: 'disconnect', expectedConnectionRevision: connection.revision });
    expect((await api.getCalendarOperationStatus('one'))?.syncResult?.outcome).toBe('ScopeChanged');
  });
  it('does not turn queued or unconfirmed work into a green success', async () => {
    for (const [outcome, tone] of [['Pending', 'muted'], ['Unconfirmed', 'warning'], ['AccessRequired', 'danger'], ['NotChecked', 'muted']] as const) {
      const api = previewCalendar(new URLSearchParams(`reviewSyncOutcome=${outcome}`), () => undefined, () => {});
      await api.applyCalendarCommand(command('run'));
      expect(calendarSyncOutcome((await api.getCalendarOperationStatus('run'))!).tone).toBe(tone);
    }
  });
  it('explains recorded field changes without inventing values or operational identifiers', () => {
    expect(calendarActivityLabel('CalendarUpdatedRemilo', ['schedule'])).toBe('Event time updated from Google');
    expect(calendarActivityLabel('CalendarUpdatedGoogle', ['title', 'notes'])).toBe('Title, Notes updated in Google');
    expect(calendarActivityLabel('CalendarUpdatedGoogle', ['private-id'])).toBeNull();
  });
  it('gives current review priority over an automatic mode label', async () => {
    const api = previewCalendar(new URLSearchParams('reviewCalendarSync=conflict'), () => undefined, () => {});
    const link = (await api.getCalendarLinks())[0];
    expect(calendarLinkStatus(link)).toMatchObject({ tone: 'warning', action: 'Review' });
  });
  it('keeps intentional Pause neutral while uncertain writes retain inspection', async () => {
    const api = previewCalendar(new URLSearchParams('reviewCalendarSync=automatic&reviewManaged=paused'), () => undefined, () => {});
    const link = (await api.getCalendarLinks())[0], managed = await api.getManagedCalendarState();
    expect(calendarLinkStatus(link, [], { ...managed, calendarId: link.source!.calendarId, mode: 'Paused' })).toMatchObject({ title: 'Calendar sync is paused', tone: 'muted' });
    expect(calendarLinkStatus({ ...link, syncStatus: 'Unconfirmed' }, [], managed)).toMatchObject({ tone: 'warning', action: 'Inspect' });
  });
});
