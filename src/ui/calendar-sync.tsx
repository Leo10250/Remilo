import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { CalendarOperationStatus, CalendarSyncScope, ManagedCalendarReviewItem } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from '../domain/actions';
import { CalendarAction } from '../domain/calendar-action';
import { calendarOperationTitle, calendarSyncOutcome, calendarTransferText } from '../domain/calendar-ux';
import { managedCalendarItemReason } from '../domain/calendar-managed';
import { calendarError } from '../domain/calendar';
import { ActionFeedback, Button, CheckRow, ConnectedGroup, Copy, Icon, RowSupport, SettingRow } from './components';
import { engine, nativeAvailable } from './native';
import { useTheme } from './theme';
import { useTimeFormatting } from './time-display';

export function CalendarStatusCard({ title, description, warning = false, tone = warning ? 'warning' : 'muted', busy = false, action, label, secondary = false, announce = false, children }: { title: string; description: string; warning?: boolean; tone?: Tone; busy?: boolean; action?: () => void; label?: string; secondary?: boolean; announce?: boolean; children?: ReactNode }) {
  const colors = useTheme();
  const semantic = ['warning', 'danger', 'success'].includes(tone);
  return <ConnectedGroup><View style={{ padding: 16, gap: 12, borderLeftWidth: semantic ? 3 : 0, borderLeftColor: colors[tone] }}>
    <View accessibilityLiveRegion={announce ? 'polite' : 'none'} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}><Icon name={tone === 'danger' ? 'error' : tone === 'success' ? 'check_circle' : tone === 'warning' ? 'warning' : busy ? 'hourglass_empty' : 'event'} color={colors[tone]} />
      <View style={{ flex: 1, gap: 4 }}><Copy heading>{title}</Copy>{!!description && <Copy muted size={14}>{description}</Copy>}</View></View>
    {busy && <ActionFeedback loading message="Working…" />}
    {children}
    {action && label && <Button label={label} variant={secondary ? 'secondary' : 'primary'} disabled={busy} onPress={action} />}
  </View></ConnectedGroup>;
}
export function CalendarOperationProgress({ operationId, onAction }: { operationId: string; onAction?: (status: CalendarOperationStatus) => void }) {
  const query = useQuery({ queryKey: ['calendar', 'operation-status', operationId], queryFn: () => engine().getCalendarOperationStatus(operationId), enabled: nativeAvailable,
    refetchInterval: query => query.state.data && ['Waiting', 'PreparingCalendar', 'CreatingCalendar', 'CheckingCalendar', 'CheckingEvents', 'AddingReminders'].includes(query.state.data.stage) ? 1500 : false });
  const value = query.data;
  if (!value) return <ActionFeedback loading={query.isLoading} message={query.error ? 'Saved progress couldn’t be read. Check again before retrying this request.' : 'Checking saved request status…'} />;
  const p = value.progress, active = ['Waiting', 'PreparingCalendar', 'CreatingCalendar', 'CheckingCalendar', 'CheckingEvents', 'AddingReminders'].includes(value.stage);
  if (value.syncResult) {
    const presentation = calendarSyncOutcome(value);
    return <CalendarStatusCard {...presentation} announce busy={value.syncResult.outcome === 'Checking'} label={value.action === 'Connect' ? 'Reconnect Google' : value.action === 'ReviewItems' ? 'Review items' : undefined} action={onAction ? () => onAction(value) : undefined}>
      {value.syncResult.outcome !== 'Checking' && (value.syncResult.imported > 0 || value.syncResult.published > 0) && <Copy size={14}>{[value.syncResult.imported ? `${value.syncResult.imported} added to Remilo` : '', value.syncResult.published ? `${value.syncResult.published} published to Google` : ''].filter(Boolean).join(' · ')}</Copy>}
    </CalendarStatusCard>;
  }
  const label = ({ Authorize: 'Continue authorization', Connect: 'Reconnect Google', InspectCreation: 'Check creation result', ReviewItems: 'Review items', ReviewSetup: 'Review setup', Resume: 'Review and resume', Retry: 'Try again', None: '' })[value.action];
  return <CalendarStatusCard announce title={value.correlationComplete === false ? 'Check current Calendar status' : calendarOperationTitle(value)} description={value.stage === 'Cancelled' ? 'This request can’t change the current Calendar setup.' : active ? 'You can keep using Remilo. Progress is saved on this device.' : value.stage === 'Unconfirmed' ? 'The calendar may already exist. Inspect the original request before creating another.' : value.stage === 'NeedsAccess' ? 'Google access must be confirmed before this request can continue.' : 'Your local reminders and alerts remain independent of Google.'}
    busy={false} tone={['NeedsAccess', 'Failed'].includes(value.stage) ? 'danger' : ['Unconfirmed', 'NeedsReview'].includes(value.stage) ? 'warning' : 'muted'} label={label} action={label && onAction ? () => onAction(value) : undefined}>
    {active && <ActionFeedback loading message={value.stage === 'CheckingEvents' ? 'Checking existing events…' : 'Continuing saved work…'} />}
    <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
      {value.correlationComplete === false ? <Copy muted size={14}>This older request has limited progress information. Review current Calendar items for their outcomes.</Copy> : <>
      {p ? <>{!!(p.imported + p.pending) && <Copy size={14}>{[p.imported ? `${p.imported} reminders added` : '', p.pending ? `${p.pending} updates waiting` : ''].filter(Boolean).join(' · ')}</Copy>}
        <Copy muted size={14}>{p.scanComplete ? 'Initial calendar check finished' : 'Still checking existing events'}{p.review ? ` · ${p.review} need review` : ''}{p.held ? ` · ${p.held} held` : ''}</Copy>
        {!!(p.localBlocked + p.localPending) && <Copy muted size={14}>At last Calendar save: {[p.localBlocked ? `${p.localBlocked} local alerts Blocked` : '', p.localPending ? `${p.localPending} Pending` : ''].filter(Boolean).join(' · ')}. Open the reminder for current readiness.</Copy>}</> :
        !!(value.confirmed + value.pending + value.review + value.held) && <Copy size={14}>{[value.confirmed ? `${value.confirmed} confirmed` : '', value.pending ? `${value.pending} waiting` : '', value.review ? `${value.review} need review` : '', value.held ? `${value.held} held` : ''].filter(Boolean).join(' · ')}</Copy>}
      </>}
    </View>
  </CalendarStatusCard>;
}
export function useCalendarAction(scopeKey = 'calendar') {
  const client = useQueryClient();
  const owner = useMemo(() => ({ scopeKey, controller: new CalendarAction(command => engine().applyCalendarCommand(command), id => engine().getCalendarOperationStatus(id)) }), [scopeKey]);
  const controller = owner.controller;
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const run = async (command: Parameters<CalendarAction['run']>[0], message = '') => {
    const applied = await controller.run(command, message); await client.invalidateQueries({ queryKey: ['calendar'] }); return applied;
  };
  const submit = async (command: Parameters<CalendarAction['submit']>[0]) => {
    try { return await controller.submit(command) as Record<string, unknown>; } finally { await client.invalidateQueries({ queryKey: ['calendar'] }); }
  };
  const retry = async () => { const applied = await controller.retry(); await client.invalidateQueries({ queryKey: ['calendar'] }); return applied; };
  return { ...state, run, submit, retry };
}
export function useCalendarSync(scope: CalendarSyncScope, savedId?: string | null) {
  const action = useCalendarAction(scope.kind === 'Association' ? scope.occurrenceId : 'all');
  const requestId = action.operationId || savedId;
  const status = useQuery({ queryKey: ['calendar', 'operation-status', requestId], queryFn: () => engine().getCalendarOperationStatus(requestId!), enabled: nativeAvailable && !!requestId,
    refetchInterval: query => query.state.data && ['Waiting', 'CheckingEvents'].includes(query.state.data.stage) ? 1000 : false });
  return { ...action, requestId, status: status.data, showResult: !!action.operationId || !!status.data && !['NoChanges', 'Synced'].includes(status.data.syncResult?.outcome || ''), working: action.busy || status.data?.stage === 'CheckingEvents' || status.data?.stage === 'Waiting' && status.data.syncResult?.outcome === 'Checking',
    start: () => action.run({ kind: 'RequestCalendarSync', operationId: status.data?.stage === 'Waiting' && requestId ? requestId : engine().createOperationId(), scope }) };
}
export function CalendarAttentionCard({ count, tone = 'warning', disabled, onPress }: { count: number; tone?: 'warning' | 'danger'; disabled?: boolean; onPress: () => void }) {
  const colors = useTheme(), [focused, setFocused] = useState(false);
  return <ConnectedGroup><Pressable accessibilityRole="button" accessibilityLabel={`Calendar items need review. Review ${count} ${count === 1 ? 'item' : 'items'}.`} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => ({ minHeight: 56, padding: 16, gap: 8, borderLeftWidth: 3, borderLeftColor: colors[tone], borderWidth: focused ? 2 : 0, borderColor: colors.accent, backgroundColor: pressed ? colors.soft : colors.surface })}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Icon name={tone === 'danger' ? 'error' : 'warning'} color={colors[tone]} /><View style={{ flex: 1, gap: 4 }}><Copy heading>Calendar items need review</Copy><Copy muted size={14}>Check changes, incoming events or Calendar setup.</Copy><Copy heading size={16}>Review {count} {count === 1 ? 'item' : 'items'}</Copy></View><Icon name="chevron_right" /></View>
  </Pressable></ConnectedGroup>;
}
export function useCalendarReviewTiming(id?: string) {
  const { detailSchedulePresentation } = useTimeFormatting();
  const context = useQuery({ queryKey: ['calendar', 'context', id], queryFn: () => engine().getCalendarContext(id!), enabled: nativeAvailable && !!id });
  const timing = context.data ? detailSchedulePresentation(context.data) : null;
  return timing ? [timing.label, timing.value, timing.supporting].filter(Boolean).join(' · ') : '';
}
export function CalendarReviewTiming({ id }: { id: string }) {
  const timing = useCalendarReviewTiming(id);
  return timing ? <Copy heading size={16}>{timing}</Copy> : null;
}
/** A launch acknowledgement is never a successful authorization. Only a saved native outcome completes this interaction. */
export function useCalendarAuthorization(onAuthorized?: () => void) {
  const client = useQueryClient(), [request, setRequest] = useState<string | null>(null), [message, setMessage] = useState(''), [launching, setLaunching] = useState(false), [verified, setVerified] = useState(false);
  const handled = useRef(''), callback = useRef(onAuthorized);
  useEffect(() => { callback.current = onAuthorized; }, [onAuthorized]);
  const query = useQuery({ queryKey: ['calendar', 'authorization', request], queryFn: () => engine().getCalendarOperationStatus(request!), enabled: nativeAvailable && !!request,
    refetchInterval: query => !query.state.data || query.state.data.stage === 'AwaitingAuthorization' ? 1000 : false });
  useEffect(() => {
    const status = query.data;
    if (!status || status.stage === 'AwaitingAuthorization' || handled.current === request) return;
    handled.current = request!;
    if (status.stage === 'Authorized') void engine().getCalendarConnection().then(connection => {
      setVerified(connection.connected); setMessage(connection.connected ? 'Google access confirmed.' : 'Google access needs another check.');
      void client.invalidateQueries({ queryKey: ['calendar'] }); if (connection.connected) callback.current?.();
    }).catch(() => setMessage('Check the saved Google connection before continuing.'));
  }, [query.data, request, client]);
  const start = async (operationId: string | null = null) => {
    if (launching || request && (!query.data || query.data.stage === 'AwaitingAuthorization')) return;
    const id = engine().createOperationId(); setRequest(id); setVerified(false); setLaunching(true); setMessage('Finish connecting in Google.');
    try { await engine().beginCalendarAuthorization(id, operationId); }
    catch (error) {
      setMessage(calendarError(error));
      // A lost launch reply can already have opened authorization. Inspect this request before permitting another.
      try { if (!await engine().getCalendarOperationStatus(id)) setRequest(null); } catch { /* Saved-status polling retains this identity. */ }
    }
    finally { setLaunching(false); }
  };
  const outcomeMessage = query.data?.stage === 'Cancelled' ? 'Google connection cancelled. Your settings are unchanged.' : query.data?.stage === 'Failed' ? 'Google access wasn’t confirmed. You can try connecting again.' : message;
  const tone: Tone = query.data?.stage === 'Failed' ? 'danger' : verified ? 'success' : 'muted';
  return { start, message: outcomeMessage, tone, waiting: launching || !!request && (!query.data || query.data.stage === 'AwaitingAuthorization') };
}
export function CalendarReviewItems({ items, selected, onToggle, disabled = false, onReview }: { items: ManagedCalendarReviewItem[]; selected: string[]; onToggle: (id: string) => void; disabled?: boolean; onReview: (item: ManagedCalendarReviewItem) => void }) {
  const { scheduleDateTime } = useTimeFormatting();
  const ready = items.filter(item => item.ready), review = items.filter(item => !item.ready);
  return <>
    {!!ready.length && <Copy heading>Ready to apply · {ready.length}</Copy>}
    {ready.map(item => <ConnectedGroup key={item.itemId}><View>
      <CheckRow label={item.title} description={[item.calendarName, item.scope].filter(Boolean).join(' · ')} selected={selected.includes(item.itemId)} disabled={disabled} onPress={() => onToggle(item.itemId)} />
      <RowSupport><Copy muted={!item.alertAtMs} heading={!!item.alertAtMs} size={item.alertAtMs ? 16 : 14}>{item.alertMode === 'None' ? 'No alert' : item.alertAtMs ? `${item.alertMode || 'Alarm'} · ${scheduleDateTime(item.alertAtMs)}` : calendarTransferText(item.inbound, item.outbound)}</Copy>
        {!!((item.inbound?.length || 0) + (item.outbound?.length || 0)) && !!item.alertAtMs && <Copy muted size={14}>{calendarTransferText(item.inbound, item.outbound)}</Copy>}
        {!!item.localStatus && <Copy muted size={14}>Local alert: {item.localStatus}</Copy>}</RowSupport>
    </View></ConnectedGroup>)}
    {!!review.length && <Copy heading>Needs review · {review.length}</Copy>}
    {review.map(item => <ConnectedGroup key={item.itemId}><View>
      <SettingRow prominent label={item.title} description={[item.calendarName, item.scope].filter(Boolean).join(' · ')} />
      <RowSupport><Copy muted size={14}>{managedCalendarItemReason(item)}</Copy>
        {(item.occurrenceId || item.candidateId) && <Button label={item.reason === 'ElapsedAlert' ? 'Choose an alert time' : 'Review changes'} variant="secondary" disabled={disabled} onPress={() => onReview(item)} />}</RowSupport>
    </View></ConnectedGroup>)}
  </>;
}
