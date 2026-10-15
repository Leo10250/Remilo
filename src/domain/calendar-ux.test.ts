import { describe, expect, it } from 'vitest';
import { previewCalendar } from '../../verification/ui/preview-calendar';
import { calendarOperationTitle, calendarStatusPresentation, calendarTransferText } from './calendar-ux';

const fixture = (query: string) => previewCalendar(new URLSearchParams(query), () => undefined, () => {});
describe('Calendar setup feedback and recovery', () => {
  it('does not describe launch or cancelled authorization as a connection', async () => {
    for (const [choice, stage] of [['waiting', 'AwaitingAuthorization'], ['cancel', 'Cancelled'], ['denied', 'Failed']] as const) {
      const api = fixture(`reviewCalendar=disconnected&reviewCalendarConsent=${choice}`);
      expect(await api.beginCalendarAuthorization('request', null)).toEqual({ operationId: 'request', launched: true });
      expect((await api.getCalendarOperationStatus('request'))?.stage).toBe(stage);
      expect((await api.getCalendarConnection()).connected).toBe(false);
      expect(await api.beginCalendarAuthorization('request', null)).toEqual({ operationId: 'request', launched: false });
      await expect(api.beginCalendarAuthorization('request', 'other-work')).rejects.toMatchObject({ code: 'OPERATION_REUSED' });
    }
  });
  it('shows success only after authorization has actually updated verified state', async () => {
    const api = fixture('reviewCalendar=disconnected');
    await api.beginCalendarAuthorization('connect', null);
    expect((await api.getCalendarOperationStatus('connect'))?.stage).toBe('Authorized');
    expect((await api.getCalendarConnection()).connected).toBe(true);
    expect(calendarStatusPresentation(await api.getCalendarConnection(), await api.getManagedCalendarState()).action).toBe('Setup');
  });
  it('retains progress after reading another screen and does not infer completion from Ready', async () => {
    const api = fixture('reviewManaged=partial');
    const state = await api.getManagedCalendarState();
    expect(state.phase).toBe('Ready'); expect(state.progress?.pending).toBe(1);
    expect(calendarStatusPresentation(await api.getCalendarConnection(), state).action).toBe('Progress');
    await api.getCalendarLinks();
    const status = await api.getCalendarOperationStatus(state.operationId!);
    expect(status?.stage).toBe('AddingReminders');
    expect(calendarOperationTitle(status!)).not.toMatch(/finished|complete|Everything/);
  });
  it('keeps uncertain creation inspection distinct from authorization and new setup', async () => {
    const unknown = fixture('reviewManaged=unknown'), access = fixture('reviewManaged=access');
    expect(calendarStatusPresentation(await unknown.getCalendarConnection(), await unknown.getManagedCalendarState())).toMatchObject({ action: 'InspectCreation', label: 'Check creation result' });
    expect(calendarStatusPresentation(await access.getCalendarConnection(), await access.getManagedCalendarState()).action).toBe('Authorize');
  });
  it('describes directional changes with user-facing field names', () => {
    expect(calendarTransferText([], [], true)).toBe('Already matches');
    expect(calendarTransferText(['Schedule'], ['title'])).toBe('Update event time in Remilo · Update title in Google');
  });
  it('uses reviewed resume after reconnection and does not re-authorize a completed setup', async () => {
    const api = fixture('reviewManaged=enabled'), state = await api.getManagedCalendarState(), connection = await api.getCalendarConnection();
    expect(calendarStatusPresentation(connection, { ...state, phase: 'AccessRequired', problem: { reason: 'NEEDS_ACCESS', action: 'Connect' } }).action).toBe('Connect');
    expect(calendarStatusPresentation(connection, { ...state, phase: 'Reviewing' }).action).toBe('Resume');
  });
});
