import { useLocalizedState, useLocale, useTranslation } from '../localization/react';
import { t } from '../localization';
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
  'use no memo';
  const t = useTranslation();
  const colors = useTheme();
  const semantic = ['warning', 'danger', 'success'].includes(tone);
  return <ConnectedGroup><View style={{ padding: 16, gap: 12, borderLeftWidth: semantic ? 3 : 0, borderLeftColor: colors[tone] }}>
    <View accessibilityLiveRegion={announce ? 'polite' : 'none'} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}><Icon name={tone === 'danger' ? 'error' : tone === 'success' ? 'check_circle' : tone === 'warning' ? 'warning' : busy ? 'hourglass_empty' : 'event'} color={colors[tone]} />
      <View style={{ flex: 1, gap: 4 }}><Copy heading>{title}</Copy>{!!description && <Copy muted size={14}>{description}</Copy>}</View></View>
    {busy && <ActionFeedback loading message={t('m_5474eef8d0f1')} />}
    {children}
    {action && label && <Button label={label} variant={secondary ? 'secondary' : 'primary'} disabled={busy} onPress={action} />}
  </View></ConnectedGroup>;
}
export function CalendarOperationProgress({ operationId, onAction }: { operationId: string; onAction?: (status: CalendarOperationStatus) => void }) {
  'use no memo';
  const t = useTranslation();
  const query = useQuery({ queryKey: ['calendar', 'operation-status', operationId], queryFn: () => engine().getCalendarOperationStatus(operationId), enabled: nativeAvailable,
    refetchInterval: query => query.state.data && ['Waiting', 'PreparingCalendar', 'CreatingCalendar', 'CheckingCalendar', 'CheckingEvents', 'AddingReminders'].includes(query.state.data.stage) ? 1500 : false });
  const value = query.data;
  if (!value) return <ActionFeedback loading={query.isLoading} message={query.error ? t('m_34e95ab8c5d6') : t('m_4b9341957087')} />;
  const p = value.progress, active = ['Waiting', 'PreparingCalendar', 'CreatingCalendar', 'CheckingCalendar', 'CheckingEvents', 'AddingReminders'].includes(value.stage);
  if (value.syncResult) {
    const presentation = calendarSyncOutcome(value);
    return <CalendarStatusCard {...presentation} announce busy={value.syncResult.outcome === 'Checking'} label={value.action === 'Connect' ? t('m_b724411569e0') : value.action === 'ReviewItems' ? t('m_e6bc867f7622') : undefined} action={onAction ? () => onAction(value) : undefined}>
      {value.syncResult.outcome !== 'Checking' && (value.syncResult.imported > 0 || value.syncResult.published > 0) && <Copy size={14}>{[value.syncResult.imported ? t('m_c6152e6efac4', { arg0: String(value.syncResult.imported) }) : '', value.syncResult.published ? t('m_24a02223a58b', { arg0: String(value.syncResult.published) }) : ''].filter(Boolean).join(' · ')}</Copy>}
    </CalendarStatusCard>;
  }
  const label = ({ Authorize: t('m_2204c2c3f1b5'), Connect: t('m_b724411569e0'), InspectCreation: t('m_2b9b02919ba1'), ReviewItems: t('m_e6bc867f7622'), ReviewSetup: t('m_5a16e3d43a6a'), Resume: t('m_4a5f846d4f91'), Retry: t('m_d8b8392e2c54'), None: '' })[value.action];
  return <CalendarStatusCard announce title={value.correlationComplete === false ? t('m_049386386c32') : calendarOperationTitle(value)} description={value.stage === 'Cancelled' ? t('m_df0230fa2a35') : active ? t('m_dde954fdf0a2') : value.stage === 'Unconfirmed' ? t('m_7a646c44f31b') : value.stage === 'NeedsAccess' ? t('m_61433b809357') : t('m_fb04da7e6393')}
    busy={false} tone={['NeedsAccess', 'Failed'].includes(value.stage) ? 'danger' : ['Unconfirmed', 'NeedsReview'].includes(value.stage) ? 'warning' : 'muted'} label={label} action={label && onAction ? () => onAction(value) : undefined}>
    {active && <ActionFeedback loading message={value.stage === 'CheckingEvents' ? t('m_27514f607114') : t('m_a9ecc2367f2d')} />}
    <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
      {value.correlationComplete === false ? <Copy muted size={14}>{t('m_eccd1abc57de')}</Copy> : <>
      {p ? <>{!!(p.imported + p.pending) && <Copy size={14}>{[p.imported ? t('m_d7c0f9ea9230', { arg0: String(p.imported) }) : '', p.pending ? t('m_c71a97066294', { arg0: String(p.pending) }) : ''].filter(Boolean).join(' · ')}</Copy>}
        <Copy muted size={14}>{p.scanComplete ? t('m_d873a6787303') : t('m_b2746d389bf2')}{p.review ? t('m_e767fcfcbc61', { arg0: String(p.review) }) : ''}{p.held ? t('m_b0294432a3ba', { arg0: String(p.held) }) : ''}</Copy>
        {!!(p.localBlocked + p.localPending) && <Copy muted size={14}>{t('m_0f87fb764739')}{[p.localBlocked ? t('m_9f613b0bba11', { arg0: String(p.localBlocked) }) : '', p.localPending ? t('m_022449d63367', { arg0: String(p.localPending) }) : ''].filter(Boolean).join(' · ')}{t('m_b7ee2c99f338')}</Copy>}</> :
        !!(value.confirmed + value.pending + value.review + value.held) && <Copy size={14}>{[value.confirmed ? t('m_ebd784235b7f', { arg0: String(value.confirmed) }) : '', value.pending ? t('m_d1f799b71877', { arg0: String(value.pending) }) : '', value.review ? t('m_1607e7f5bb80', { arg0: String(value.review) }) : '', value.held ? t('m_58871cae4446', { arg0: String(value.held) }) : ''].filter(Boolean).join(' · ')}</Copy>}
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
  'use no memo';
  const t = useTranslation();
  const colors = useTheme(), [focused, setFocused] = useState(false);
  return <ConnectedGroup><Pressable accessibilityRole="button" accessibilityLabel={t('calendar_review_count', { count })} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => ({ minHeight: 56, padding: 16, gap: 8, borderLeftWidth: 3, borderLeftColor: colors[tone], borderWidth: focused ? 2 : 0, borderColor: colors.accent, backgroundColor: pressed ? colors.soft : colors.surface })}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Icon name={tone === 'danger' ? 'error' : 'warning'} color={colors[tone]} /><View style={{ flex: 1, gap: 4 }}><Copy heading>{t('m_3d2d5eb3e995')}</Copy><Copy muted size={14}>{t('m_7d87416abd53')}</Copy><Copy heading size={16}>{t('calendar_review_action_count', { count })}</Copy></View><Icon name="chevron_right" /></View>
  </Pressable></ConnectedGroup>;
}
export function useCalendarReviewTiming(id?: string) {
  const { detailSchedulePresentation } = useTimeFormatting();
  const context = useQuery({ queryKey: ['calendar', 'context', id], queryFn: () => engine().getCalendarContext(id!), enabled: nativeAvailable && !!id });
  const timing = context.data ? detailSchedulePresentation(context.data) : null;
  return timing ? [timing.label, timing.value, timing.supporting].filter(Boolean).join(' · ') : '';
}
export function CalendarReviewTiming({ id }: { id: string }) {
  'use no memo';
  useLocale();
  const timing = useCalendarReviewTiming(id);
  return timing ? <Copy heading size={16}>{timing}</Copy> : null;
}
/** A launch acknowledgement is never a successful authorization. Only a saved native outcome completes this interaction. */
export function useCalendarAuthorization(onAuthorized?: () => void) {
  const client = useQueryClient(), [request, setRequest] = useState<string | null>(null), [message, setMessage] = useLocalizedState(''), [launching, setLaunching] = useState(false), [verified, setVerified] = useState(false);
  const handled = useRef(''), callback = useRef(onAuthorized);
  useEffect(() => { callback.current = onAuthorized; }, [onAuthorized]);
  const query = useQuery({ queryKey: ['calendar', 'authorization', request], queryFn: () => engine().getCalendarOperationStatus(request!), enabled: nativeAvailable && !!request,
    refetchInterval: query => !query.state.data || query.state.data.stage === 'AwaitingAuthorization' ? 1000 : false });
  useEffect(() => {
    const status = query.data;
    if (!status || status.stage === 'AwaitingAuthorization' || handled.current === request) return;
    handled.current = request!;
    if (status.stage === 'Authorized') void engine().getCalendarConnection().then(connection => {
      setVerified(connection.connected); setMessage(connection.connected ? t('m_f8278bd3d08e') : t('m_2cb105c80f63'));
      void client.invalidateQueries({ queryKey: ['calendar'] }); if (connection.connected) callback.current?.();
    }).catch(() => setMessage(t('m_35e1683f019c')));
  }, [query.data, request, client, setMessage]);
  const start = async (operationId: string | null = null) => {
    if (launching || request && (!query.data || query.data.stage === 'AwaitingAuthorization')) return;
    const id = engine().createOperationId(); setRequest(id); setVerified(false); setLaunching(true); setMessage(t('m_22c3fbbc38db'));
    try { await engine().beginCalendarAuthorization(id, operationId); }
    catch (error) {
      setMessage(calendarError(error));
      // A lost launch reply can already have opened authorization. Inspect this request before permitting another.
      try { if (!await engine().getCalendarOperationStatus(id)) setRequest(null); } catch { /* Saved-status polling retains this identity. */ }
    }
    finally { setLaunching(false); }
  };
  const outcomeMessage = query.data?.stage === 'Cancelled' ? t('m_639a34a4219e') : query.data?.stage === 'Failed' ? t('m_194e65aa33cb') : message;
  const tone: Tone = query.data?.stage === 'Failed' ? 'danger' : verified ? 'success' : 'muted';
  return { start, message: outcomeMessage, tone, waiting: launching || !!request && (!query.data || query.data.stage === 'AwaitingAuthorization') };
}
export function CalendarReviewItems({ items, selected, onToggle, disabled = false, onReview }: { items: ManagedCalendarReviewItem[]; selected: string[]; onToggle: (id: string) => void; disabled?: boolean; onReview: (item: ManagedCalendarReviewItem) => void }) {
  'use no memo';
  const t = useTranslation();
  const { scheduleDateTime } = useTimeFormatting();
  const ready = items.filter(item => item.ready), review = items.filter(item => !item.ready);
  return <>
    {!!ready.length && <Copy heading>{t('m_bbee1723dacc')}{ready.length}</Copy>}
    {ready.map(item => <ConnectedGroup key={item.itemId}><View>
      <CheckRow label={item.title} description={[item.calendarName, item.scope].filter(Boolean).join(' · ')} selected={selected.includes(item.itemId)} disabled={disabled} onPress={() => onToggle(item.itemId)} />
      <RowSupport><Copy muted={!item.alertAtMs} heading={!!item.alertAtMs} size={item.alertAtMs ? 16 : 14}>{item.alertMode === 'None' ? t('m_d1af410eb4d0') : item.alertAtMs ? `${item.alertMode || 'Alarm'} · ${scheduleDateTime(item.alertAtMs)}` : calendarTransferText(item.inbound, item.outbound)}</Copy>
        {!!((item.inbound?.length || 0) + (item.outbound?.length || 0)) && !!item.alertAtMs && <Copy muted size={14}>{calendarTransferText(item.inbound, item.outbound)}</Copy>}
        {!!item.localStatus && <Copy muted size={14}>{t('m_f44f870665fc')}{item.localStatus}</Copy>}</RowSupport>
    </View></ConnectedGroup>)}
    {!!review.length && <Copy heading>{t('m_33071713d5e1')}{review.length}</Copy>}
    {review.map(item => <ConnectedGroup key={item.itemId}><View>
      <SettingRow intent="action" prominent label={item.title} description={[item.calendarName, item.scope].filter(Boolean).join(' · ')} />
      <RowSupport><Copy muted size={14}>{managedCalendarItemReason(item)}</Copy>
        {(item.occurrenceId || item.candidateId) && <Button label={item.reason === 'ElapsedAlert' ? t('m_2d2f0c2ff330') : t('m_6a47708f4e14')} variant="secondary" disabled={disabled} onPress={() => onReview(item)} />}</RowSupport>
    </View></ConnectedGroup>)}
  </>;
}
