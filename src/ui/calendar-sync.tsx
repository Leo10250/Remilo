import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { CalendarOperationStatus, ManagedCalendarReviewItem } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarOperationTitle, calendarTransferText } from '../domain/calendar-ux';
import { managedCalendarItemReason } from '../domain/calendar-managed';
import { calendarError } from '../domain/calendar';
import { ActionFeedback, Button, CheckRow, ConnectedGroup, Copy, Icon, RowSupport, SettingRow } from './components';
import { engine, nativeAvailable } from './native';
import { useTheme } from './theme';
import { useTimeFormatting } from './time-display';

export function CalendarStatusCard({ title, description, warning = false, busy = false, action, label, children }: { title: string; description: string; warning?: boolean; busy?: boolean; action?: () => void; label?: string; children?: ReactNode }) {
  const colors = useTheme();
  return <ConnectedGroup><View style={{ padding: 16, gap: 12, borderLeftWidth: warning ? 3 : 0, borderLeftColor: colors.warning }}>
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}><Icon name={warning ? 'warning' : busy ? 'hourglass_empty' : 'event'} color={warning ? colors.warning : colors.muted} />
      <View style={{ flex: 1, gap: 4 }}><Copy heading>{title}</Copy><Copy muted size={14}>{description}</Copy></View></View>
    {busy && <ActionFeedback loading message="Working…" />}
    {children}
    {action && label && <Button label={label} disabled={busy} onPress={action} />}
  </View></ConnectedGroup>;
}
export function CalendarOperationProgress({ operationId, onAction }: { operationId: string; onAction?: (status: CalendarOperationStatus) => void }) {
  const query = useQuery({ queryKey: ['calendar', 'operation-status', operationId], queryFn: () => engine().getCalendarOperationStatus(operationId), enabled: nativeAvailable,
    refetchInterval: query => query.state.data && ['Waiting', 'PreparingCalendar', 'CreatingCalendar', 'CheckingCalendar', 'CheckingEvents', 'AddingReminders'].includes(query.state.data.stage) ? 1500 : false });
  const value = query.data;
  if (!value) return <ActionFeedback loading={query.isLoading} message={query.error ? 'Saved progress couldn’t be read. Check again before retrying this request.' : 'Checking saved request status…'} />;
  const p = value.progress, active = ['Waiting', 'PreparingCalendar', 'CreatingCalendar', 'CheckingCalendar', 'CheckingEvents', 'AddingReminders'].includes(value.stage);
  const label = ({ Authorize: 'Continue authorization', Connect: 'Reconnect Google', InspectCreation: 'Check creation result', ReviewItems: 'Review items', ReviewSetup: 'Review setup', Resume: 'Review and resume', Retry: 'Try again', None: '' })[value.action];
  return <CalendarStatusCard title={value.correlationComplete === false ? 'Check current Calendar status' : calendarOperationTitle(value)} description={value.stage === 'Cancelled' ? 'This request can’t change the current Calendar setup.' : active ? 'You can keep using Remilo. Progress is saved on this device.' : value.stage === 'Unconfirmed' ? 'The calendar may already exist. Inspect the original request before creating another.' : value.stage === 'NeedsAccess' ? 'Google access must be confirmed before this request can continue.' : 'Your local reminders and alerts remain independent of Google.'}
    busy={false} warning={['NeedsAccess', 'Unconfirmed', 'NeedsReview', 'Failed'].includes(value.stage)} label={label} action={label && onAction ? () => onAction(value) : undefined}>
    {active && <ActionFeedback loading message={value.stage === 'CheckingEvents' ? 'Checking existing events…' : 'Continuing saved work…'} />}
    <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
      {value.correlationComplete === false ? <Copy muted size={14}>This older request has limited progress information. Review current Calendar items for their outcomes.</Copy> : <>
      {p ? <><Copy size={14}>{p.imported} reminders added · {p.pending} updates waiting</Copy>
        <Copy muted size={14}>{p.scanComplete ? 'Initial calendar check finished' : 'Still checking existing events'}{p.review ? ` · ${p.review} need review` : ''}{p.held ? ` · ${p.held} held` : ''}</Copy>
        {!!(p.localBlocked + p.localPending) && <Copy muted size={14}>At last Calendar save: {p.localBlocked} local alerts Blocked · {p.localPending} Pending. Open the reminder for current readiness.</Copy>}</> :
        <Copy size={14}>{value.confirmed} confirmed · {value.pending} waiting{value.review ? ` · ${value.review} need review` : ''}{value.held ? ` · ${value.held} held` : ''}</Copy>}
      </>}
    </View>
  </CalendarStatusCard>;
}
/** A launch acknowledgement is never a successful authorization. Only a saved native outcome completes this interaction. */
export function useCalendarAuthorization(onAuthorized?: () => void) {
  const client = useQueryClient(), [request, setRequest] = useState<string | null>(null), [message, setMessage] = useState(''), [launching, setLaunching] = useState(false);
  const handled = useRef(''), callback = useRef(onAuthorized);
  useEffect(() => { callback.current = onAuthorized; }, [onAuthorized]);
  const query = useQuery({ queryKey: ['calendar', 'authorization', request], queryFn: () => engine().getCalendarOperationStatus(request!), enabled: nativeAvailable && !!request,
    refetchInterval: query => !query.state.data || query.state.data.stage === 'AwaitingAuthorization' ? 1000 : false });
  useEffect(() => {
    const status = query.data;
    if (!status || status.stage === 'AwaitingAuthorization' || handled.current === request) return;
    handled.current = request!;
    if (status.stage === 'Authorized') void engine().getCalendarConnection().then(connection => {
      setMessage(connection.connected ? 'Google access confirmed.' : 'Google access needs another check.');
      void client.invalidateQueries({ queryKey: ['calendar'] }); if (connection.connected) callback.current?.();
    }).catch(() => setMessage('Check the saved Google connection before continuing.'));
  }, [query.data, request, client]);
  const start = async (operationId: string | null = null) => {
    if (launching || request && (!query.data || query.data.stage === 'AwaitingAuthorization')) return;
    const id = engine().createOperationId(); setRequest(id); setLaunching(true); setMessage('Finish connecting in Google.');
    try { await engine().beginCalendarAuthorization(id, operationId); }
    catch (error) {
      setMessage(calendarError(error));
      // A lost launch reply can already have opened authorization. Inspect this request before permitting another.
      try { if (!await engine().getCalendarOperationStatus(id)) setRequest(null); } catch { /* Saved-status polling retains this identity. */ }
    }
    finally { setLaunching(false); }
  };
  const outcomeMessage = query.data?.stage === 'Cancelled' ? 'Google connection cancelled. Your settings are unchanged.' : query.data?.stage === 'Failed' ? 'Google access wasn’t confirmed. You can try connecting again.' : message;
  return { start, message: outcomeMessage, waiting: launching || !!request && (!query.data || query.data.stage === 'AwaitingAuthorization') };
}
export function CalendarReviewItems({ items, selected, onToggle, disabled = false, onReview }: { items: ManagedCalendarReviewItem[]; selected: string[]; onToggle: (id: string) => void; disabled?: boolean; onReview: (item: ManagedCalendarReviewItem) => void }) {
  const { scheduleDateTime } = useTimeFormatting();
  const ready = items.filter(item => item.ready), review = items.filter(item => !item.ready);
  return <>
    {!!ready.length && <Copy heading>Ready to apply · {ready.length}</Copy>}
    {ready.map(item => <ConnectedGroup key={item.itemId}><View>
      <CheckRow label={item.title} description={[item.calendarName, item.scope].filter(Boolean).join(' · ')} selected={selected.includes(item.itemId)} disabled={disabled} onPress={() => onToggle(item.itemId)} />
      <RowSupport><Copy muted size={14}>{item.alertMode === 'None' ? 'No alert' : item.alertAtMs ? `${item.alertMode || 'Alarm'} · ${scheduleDateTime(item.alertAtMs)}` : calendarTransferText(item.inbound, item.outbound)}</Copy>
        {!!item.localStatus && <Copy muted size={14}>Local alert: {item.localStatus}</Copy>}</RowSupport>
    </View></ConnectedGroup>)}
    {!!review.length && <Copy heading>Needs review · {review.length}</Copy>}
    {review.map(item => <ConnectedGroup key={item.itemId}><View>
      <SettingRow label={item.title} description={[item.calendarName, item.scope].filter(Boolean).join(' · ')} />
      <RowSupport><Copy muted size={14}>{managedCalendarItemReason(item)}</Copy>
        {(item.occurrenceId || item.candidateId) && <Button label={item.reason === 'ElapsedAlert' ? 'Choose an alert time' : 'Review changes'} variant="secondary" disabled={disabled} onPress={() => onReview(item)} />}</RowSupport>
    </View></ConnectedGroup>)}
  </>;
}
