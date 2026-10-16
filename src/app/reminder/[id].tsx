import { errorText, t, live } from '../../localization';
import { useLocalizedState, useTranslation } from '../../localization/react';
import { RootNotice, notifyTrash } from '../../ui/navigation';
import { useTimeFormatting } from '../../ui/time-display';
import { useQuery } from '@tanstack/react-query';
import { router, useIsFocused, useLocalSearchParams, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { CalendarCommand, ContentCommand, DeliveryCommand, Occurrence } from '../../../modules/remilo-alarm/src/RemiloAlarm.types';
import { recoveryPresentation, commandFeedback, type Tone } from '../../domain/actions';

import { creationOrigin, originParams, reminderListRoute, secondaryOriginRoute, type OriginParams } from '../../domain/navigation';
import { modeLabel, canAdjustAlert, deliveryExplanation, overduePresentation, recordedCompletionTime, repeatSummary, stateIcon, stateLabel, stateTone } from '../../domain/presentation';
import { deviceZone } from '../../domain/time';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, DateField, Icon, IconButton, Page, QueryState, SettingRow, Sheet, Status } from '../../ui/components';

import { CommandError, engine, nativeAvailable, useCommand, useSettings } from '../../ui/native';
import { typography } from '../../ui/tokens';
import { InformationRow, Schedule, ScheduleDetails, SchedulePrimary, ZoneSummary } from '../../ui/schedule';
import { useAppearanceHold, useFontScaleOverride, useTheme } from '../../ui/theme';
import { useAppearanceConfirmation } from '../../ui/confirmation';
import { PurgeConfirmation } from '../../ui/purge-confirmation';
import { TrashConfirmation } from '../../ui/trash-confirmation';
import { CalendarExceptionNotice, CalendarSummaryRow } from '../../ui/calendar-association';
import { calendarCaptureRejected } from '../../domain/calendar-link';
import { calendarError } from '../../domain/calendar';

const activity: Record<string, string> = live(() => ({ Purge: t('m_ddba37fd352b'), TimedOut: t('m_ba0c9f7afee3'), UndoDelete: t('m_5d561a1e3f17'), Delete: t('m_2d65f262cc64'), Reopen: t('m_53a4ae1c597a'), Done: t('m_22a970d2e5b1'),
  Stop: t('m_f36a51f323bf'), StopAll: t('m_f9435c3c51ce'), Snooze: t('m_88096584e4a8'), Postpone: t('m_fd4879b3f653'), Skip: t('m_9151e9a2464d'), Edit: t('m_7117f0807129'), Create: t('m_d70b9e24bca2'),
  Interrupted: t('m_a48a8f6a3fa3'), Failed: t('m_510ed464f04a'), Missed: t('m_5c12863b4f4d'), Notified: t('m_02e87bf90c4c'), PauseSeries: t('m_83e8432c0130'), ResumeSeries: t('m_b0bfe35718ef') }));
type Feedback = { message: string; tone: Tone };
export default function ReminderDetails() {
  'use no memo';
  const t = useTranslation();
  const { formatDate, formatTime, scheduleDateTime, alertPresentation, clockPreferenceLabel } = useTimeFormatting();
  const params = useLocalSearchParams<OriginParams & { id: string; action?: string }>(), { id, action } = params;
  const origin = useMemo(() => creationOrigin({ originRoot: params.originRoot, originListId: params.originListId, originNoList: params.originNoList }), [params.originRoot, params.originListId, params.originNoList]);
  const routeParams = useMemo(() => ({ ...originParams(origin), originCollection: params.originCollection, originFamily: params.originFamily,
    originSegmentId: params.originSegmentId, originReminderId: params.originReminderId }), [origin, params.originCollection, params.originFamily, params.originSegmentId, params.originReminderId]);
  const query = useQuery({ queryKey: ['occurrence', id], queryFn: () => engine().getOccurrence(id), enabled: nativeAvailable });
  useEffect(() => { const routine = query.data?.routine; if (routine && !query.data?.deleted) router.replace({ pathname: '/routine-session', params: { id: routine.routineId, date: routine.date } }); }, [query.data]);
  const item = query.data, settings = useSettings(), command = useCommand(), colors = useTheme();
  const calendar = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(), enabled: nativeAvailable });
  const publication = calendar.data?.find((value) => value.occurrenceId === id);
  const calendarLinks = useQuery({ queryKey: ['calendar', 'links'], queryFn: () => engine().getCalendarLinks(), enabled: nativeAvailable });
  const calendarOperations = useQuery({ queryKey: ['calendar', 'operations'], queryFn: () => engine().getCalendarOperations(), enabled: nativeAvailable });
  const calendarLink = calendarLinks.data?.find(value => value.occurrenceId === id || !!item?.seriesId && value.seriesId === item.seriesId);
  const unlinkCommand = useRef<CalendarCommand | null>(null);
  const [unlinkBusy, setUnlinkBusy] = useState(false), [unlinkUncertain, setUnlinkUncertain] = useState(false);
  const scale = useFontScaleOverride(), { fontScale } = useWindowDimensions();
  const confirm = useAppearanceConfirmation();
  const itemId = item?.id, segmentId = item?.segmentId;
  const series = useQuery({ queryKey: ['series', item?.segmentId], queryFn: () => engine().getSeries(item!.segmentId!), enabled: nativeAvailable && !!item?.segmentId });
  const families = useQuery({ queryKey: ['repeat-families'], queryFn: () => engine().queryRepeatFamilies(), enabled: nativeAvailable && !!item?.segmentId });
  const family = families.data?.find((candidate) => candidate.seriesId === series.data?.seriesId);
  const scopeTrigger = useRef<View>(null), focused = useIsFocused();
  const [postpone, setPostpone] = useState(action === 'postpone'), [scope, setScope] = useState(action === 'edit'), [menu, setMenu] = useState(false);
  const [purgeItem, setPurgeItem] = useState<Occurrence | null>(null);
  const [trashItem, setTrashItem] = useState<Occurrence | null>(null);
  const [now, setNow] = useState(Date.now);
  const [target, setTarget] = useState(() => Date.now() + 900_000), [feedback, setFeedback] = useLocalizedState<Feedback | null>(null), [sheetFeedback, setSheetFeedback] = useLocalizedState<Feedback | null>(null);
  const pendingOperation = useRef<{ command: ContentCommand | DeliveryCommand; item: Occurrence; success: string } | null>(null);
  const runningOperation = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const [recoveryKind, setRecoveryKind] = useState<string>();
  const [postponeResult, setPostponeResult] = useState(false), [selection, setSelection] = useState('15');
  useAppearanceHold(command.isPending || uncertain);
  usePreventRemove(command.isPending || uncertain || unlinkBusy || unlinkUncertain, () => {
    confirm(t('m_62b815b59b7a'), t('m_b920b015452f'));
  });
  useEffect(() => { if (action !== 'edit' || !itemId) return;
    if (!segmentId) router.replace({ pathname: '/edit', params: { id: itemId, ...routeParams, originReminderId: itemId } });
  }, [action, itemId, segmentId, routeParams]);
  useEffect(() => { if (!postpone) return; const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick); }, [postpone]);
  const runPending = async () => {
    const operation = pendingOperation.current;
    if (!operation || command.isPending || runningOperation.current) return;
    runningOperation.current = true;
    setRecoveryKind(operation.command.kind);
    setFeedback(null); setSheetFeedback(null);
    try {
      const result = await command.mutateAsync(operation.command);
      pendingOperation.current = null; setUncertain(false);
      const next = 'expectedGeneration' in operation.command && operation.command.kind === 'Postpone' && ['Blocked', 'Pending'].includes(result.status)
        ? { message: t('m_1740914a5c1b', { arg0: String(result.status === 'Blocked' ? t('m_9b71e79182a6') : t('m_9b69a5f441b4')), arg1: String(formatTime(operation.command.alarmAtMs!)) }), tone: 'warning' as const }
        : commandFeedback(result, operation.success);
      setFeedback(operation.command.kind === 'Delete' && next.tone === 'success' ? null : next);
      if (operation.command.kind === 'Delete') {
        notifyTrash(operation.item, result);
        // Allow the confirmed-operation guard to settle before navigation.
        setDeleted(true);
      } else if (operation.command.kind === 'Purge') {
        setDeleted(true);
      } else if ('expectedGeneration' in operation.command) {
        if (operation.command.kind === 'Postpone' && (result.status === 'Blocked' || result.status === 'Pending')) { setSheetFeedback(next); setPostponeResult(true); }
        else setPostpone(false);
      }
    } catch (error) {
      if (error instanceof CommandError) { pendingOperation.current = null; setUncertain(false); }
      else setUncertain(true);
      const next: Feedback = { message: errorText(error, t('m_e47c7ded09d7')), tone: 'danger' };
      setFeedback(next); if ('expectedGeneration' in operation.command) setSheetFeedback(next);
    } finally { runningOperation.current = false; }
  };
  const [deleted, setDeleted] = useState(false);
  useEffect(() => { if (deleted && !command.isPending && !uncertain) { if (router.canGoBack()) router.back(); else router.replace(secondaryOriginRoute(routeParams)); } }, [deleted, command.isPending, uncertain, routeParams]);
  const content = async (kind: ContentCommand['kind'], captured = item) => {
    if (!captured || command.isPending || pendingOperation.current) return;
    pendingOperation.current = { command: { kind, occurrenceId: id, expectedRevision: captured.revision, operationId: engine().createOperationId() }, item: captured, success: activity[kind] ?? t('m_87124f754c23') };
    await runPending();
  };
  const moveToTrash = () => {
    if (command.isPending || pendingOperation.current || runningOperation.current) return;
    setMenu(false);
    if (!item) return;
    if (item.completed || item.skipped) { void content('Delete'); return; }
    setTrashItem({ ...item });
  };
  const delivery = async (kind: DeliveryCommand['kind'], alarmAtMs?: number) => {
    if (!item || command.isPending || pendingOperation.current || !canAdjustAlert(item) || kind === 'Stop' && item.deliveryState !== 'Alerting') return;
    if (kind === 'CompleteDelivery' && item.deliveryState !== 'Alerting' && !(item.mode === 'Notification' && item.deliveryState === 'Notified')) return;
    pendingOperation.current = { command: { kind, occurrenceId: id, expectedGeneration: item.generation, alarmAtMs,
      ...(kind === 'Snooze' ? { expectedSnoozeMinutes: item.quickSnoozeMinutes } : {}), operationId: engine().createOperationId() }, item,
      success: kind === 'Stop' || kind === 'CompleteDelivery' ? t('m_7b359664f423') : kind === 'Postpone' ? t('m_b47059d04e58') + formatTime(alarmAtMs!) : t('m_5550d1a27260') };
    await runPending();
  };
  const edit = () => { if (command.isPending || uncertain) return; setMenu(false); if (item?.segmentId) setScope(true); else router.push({ pathname: '/edit', params: { id, ...routeParams, originReminderId: id } }); };
  const openPostpone = () => { const current = Date.now(); setNow(current); setTarget(current + 900_000); setSelection('15'); setSheetFeedback(null); setPostponeResult(false); setPostpone(true); };
  const tomorrow = (minutes: number) => { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); setTarget(date.getTime()); setSheetFeedback(null); };
  const active = item && !item.deleted && !item.completed && !item.skipped;
  const unlink = async () => {
    if (unlinkBusy || !calendarLink) return;
    unlinkCommand.current ??= { kind: 'UnlinkCalendar', occurrenceId: calendarLink.occurrenceId, operationId: engine().createOperationId(), expectedLinkRevision: calendarLink.revision };
    setUnlinkBusy(true);
    try { await engine().applyCalendarCommand(unlinkCommand.current); unlinkCommand.current = null; setUnlinkUncertain(false); await calendarLinks.refetch(); await calendarOperations.refetch(); }
    catch (error) { if (calendarCaptureRejected(error)) { unlinkCommand.current = null; setUnlinkUncertain(false); } else setUnlinkUncertain(true); setFeedback({ message: calendarError(error), tone: 'warning' }); }
    finally { setUnlinkBusy(false); }
  };
  const adjust = item && canAdjustAlert(item), completion = recordedCompletionTime(item?.history);
  const explanation = item ? deliveryExplanation(item) : null;
  const overdueStatus = item ? overduePresentation(item) : null;
  const recovery = recoveryPresentation(recoveryKind);
  const frozenPostpone = command.isPending || uncertain || postponeResult;
  const closePostpone = () => { if (!command.isPending && !uncertain && !pendingOperation.current) setPostpone(false); };
  return <Page title={t('m_31757bbfa17e')} scrollKey={'reminder:' + id} onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(routeParams))}
    actions={item ? <>{!item.deleted && <IconButton icon="edit" label={t('m_1f1353b055df')} buttonRef={scopeTrigger} disabled={command.isPending || uncertain} onPress={edit} />}
    <IconButton icon="more_vert" label={t('m_3ddd2c824c07')} disabled={command.isPending || uncertain} onPress={() => setMenu(true)} /></> : undefined}
    footer={<><RootNotice disabled={command.isPending || uncertain} />{item && (active || item.completed || item.skipped || item.deleted) ? <BottomActionBar>
      {active && <>
      {item.deliveryState === 'Alerting' && <Copy muted size={typography.supporting}>{t('m_1ce1890d9f80')}</Copy>}
      <View style={{ width: '100%' }}><Button icon="check" label={t('m_62aa4b87cc52')} disabled={command.isPending || uncertain}
        onPress={() => void (item.deliveryState === 'Alerting' ? delivery('CompleteDelivery') : content('Done'))} /></View>
      {adjust && item.deliveryState === 'Alerting' && <View style={{ width: '100%' }}><Button icon="snooze" label={t('m_44f91ee971e4') + item.quickSnoozeMinutes + t('m_2e75737a6b58')} variant="secondary"
        disabled={command.isPending || uncertain} onPress={() => void delivery('Snooze')} /></View>}
      {adjust && <View style={{ width: '100%' }}><Button icon="schedule" label={t('m_a5200499d443')} variant="secondary" disabled={command.isPending || uncertain} onPress={openPostpone} /></View>}
      </>}
      {item.deleted ? <View style={{ flex: 1 }}><Button icon="undo" label={t('m_8451e1c4f068')} disabled={command.isPending || uncertain} onPress={() => void content('UndoDelete')} /></View> :
        (item.completed || item.skipped) && <View style={{ flex: 1 }}><Button icon="undo" label={item.skipped ? t('m_3d2391eae496') : t('m_a1dceb5971c8')} variant="secondary" disabled={command.isPending || uncertain} onPress={() => void content('Reopen')} /></View>}
    </BottomActionBar> : undefined}</>}>
    <QueryState loading={query.isLoading && nativeAvailable && !item} error={!item ? query.error : undefined} empty={!item && !query.isLoading && !uncertain && !command.isPending} emptyMessage={t('m_7f00c5392527')} onRetry={nativeAvailable ? () => void query.refetch() : undefined} />
    {feedback && !uncertain && <ActionFeedback {...feedback} />}
    {uncertain && <>
      <ActionFeedback message={recovery.message} tone="warning" />
      <Button label={recovery.retry} variant="secondary" disabled={command.isPending} onPress={() => void runPending()} /></>}
    {command.isPending && <ActionFeedback loading message={t('m_290b3d0729bd')} />}
    {item && <>
      {query.error && <><ActionFeedback message={t('m_d31a19e7291e')} tone="warning" /><Button label={t('m_942087cc2d41')} variant="secondary" onPress={() => void query.refetch()} /></>}
      <View style={{flexDirection:'row',alignItems:'flex-start',gap:12}}><View style={{height:typography.title*scale*fontScale*1.4,justifyContent:'center'}}><Icon name="event" color={colors.muted} size={28}/></View><View style={{flex:1}}><Copy heading size={typography.title}>{item.title}</Copy></View></View>
      <SchedulePrimary item={item} />
      {item.deleted ? <Status icon="delete" label={t('m_5693d1b43930')} /> : item.completed ?
        <Status label={completion == null ? t('m_22a970d2e5b1') : t('m_c6af4d5c4f15') + scheduleDateTime(completion)} tone="success" /> :
        item.skipped ? <Status icon="cancel" label={t('m_12698ce1ea5c')} /> : <View style={{ gap: 8 }}>{overdueStatus && <View accessible accessibilityLabel={overdueStatus.spokenLabel}><Status icon="warning" label={overdueStatus.label} tone="warning" /></View>}
          {alertPresentation(item).confirmed && <Status label={t('m_4724f344c1c0')} tone="success" />}
          {!explanation && item.mode !== 'None' && !!stateLabel(item) && <Status icon={stateIcon(item)} label={stateLabel(item)} tone={stateTone(item)} />}</View>}
      {explanation && !item.deleted && <Status icon={stateIcon(item)} label={explanation} tone={stateTone(item)} />}
      {item.deleted && <><Status label={item.skipped ? t('m_6f7c81dca6fc') : item.completed ? completion == null ? t('m_dd7ffd5a0bba') : t('m_66fa7cc10b3a') + scheduleDateTime(completion) : t('m_1649e237dea3')} tone={item.completed ? 'success' : 'muted'} /><Copy muted size={14}>{t('m_66a114557e1d')}</Copy></>}
      {item.deliveryState === 'Blocked' && active && <Button icon="settings" label={t('m_0146bbb12bf3')} variant="secondary" disabled={command.isPending || uncertain} onPress={() => {
        if (!pendingOperation.current && !runningOperation.current) router.push({ pathname: '/alarm-check', params: { ...routeParams, originReminderId: id } });
      }} />}
      <CalendarExceptionNotice item={item} link={calendarLink} jobs={calendarOperations.data?.filter(operation => operation.occurrenceId === id) || []}
        disabled={command.isPending || uncertain || unlinkBusy || unlinkUncertain} onTrash={moveToTrash}
        onManage={() => router.push({ pathname: '/calendar-manage', params: { id: calendarLink?.occurrenceId ?? id, ...routeParams, originReminderId: id } } as Href)} />
      <Schedule item={item} details={false} connected occurrence hasPublication={!!publication || !!calendarLink} />
      {item.segmentId && <ConnectedGroup title={t('m_b6b7a0065808')} footer={series.isLoading || series.error || series.data?.state === 'Archived' ? <>
        <QueryState loading={series.isLoading} error={series.error} onRetry={() => void series.refetch()} />
        {series.data?.state === 'Archived' && <Copy muted size={typography.supporting}>{t('m_cf71ed31217a')}</Copy>}
      </> : undefined}>
        <SettingRow key="repeat" icon="repeat" label={repeatSummary(item) ?? t('m_544d9e42216c')} description={(family?.state === 'Paused' ? t('m_83e8432c0130') : family?.state === 'Ended' ? t('m_2cc4cc84a99e') : t('m_f1f3c6717092')) +
          (item.exception ? item.deliveryState === 'Scheduled' ? t('m_ef0fa85f2b02') : item.deliveryState === 'Blocked' ? t('m_ebd1b267b509') : item.deliveryState === 'Pending' ? t('m_3724a633605f') : t('m_f25081ef1779') : '')}
          disabled={command.isPending || uncertain} onPress={() => {
            if (!pendingOperation.current && !runningOperation.current) router.push({ pathname: '/series/[id]', params: { id: item.segmentId!, ...(family ? { seriesId: family.seriesId } : {}), ...routeParams, originReminderId: id } });
          }} />
      </ConnectedGroup>}
      <ConnectedGroup>
        <InformationRow key="list" icon="checklist" label={t('m_6f202f54a7b2')} value={item.listName || t('m_eacd31d849f9')} onPress={command.isPending || uncertain ? undefined : () => {
          if (!pendingOperation.current && !runningOperation.current) router.push(reminderListRoute(item.listId ?? null, id, routeParams));
        }} />
        {!!item.notes && <InformationRow key="notes" icon="notes" label={t('m_8a7525b1492f')} value={item.notes} />}
      </ConnectedGroup>
      <ScheduleDetails item={item} occurrence hasPublication={!!publication || !!calendarLink} />
      <CalendarSummaryRow id={id} link={calendarLink} publication={publication} jobs={calendarOperations.data?.filter(operation => operation.occurrenceId === id) || []} origin={routeParams} disabled={command.isPending || uncertain || unlinkBusy || unlinkUncertain} />
      {unlinkUncertain && <Button label={t('m_3a8c6f6adf3a')} variant="secondary" disabled={unlinkBusy} onPress={() => void unlink()} />}
    </>}
    <Sheet title={t('m_3ddd2c824c07')} visible={menu} onClose={() => setMenu(false)}>
      {item && !item.deleted && <SettingRow icon="edit" label={t('m_464c4ffd019e')} onPress={edit} />}
      {active && !item.segmentId && !calendarLink && (!publication || publication.state === 'Cancelled') && <SettingRow icon="event" label={t('m_3a4c8285963f')} disabled={command.isPending || uncertain}
        onPress={() => { setMenu(false); router.push({ pathname: '/calendar-publish', params: { id, ...routeParams, originReminderId: id } }); }} />}
      {calendarLink && calendarLink.state !== 'Detached' && <SettingRow icon="close" label={t('m_d9203b69027f')} disabled={unlinkBusy || unlinkUncertain}
        onPress={() => { setMenu(false); confirm(t('m_b89208529acc'), t(calendarOperations.data?.some(operation => operation.occurrenceId === id && operation.remoteAttempted && !['Confirmed', 'Cancelled', 'Conflict', 'Failed'].includes(operation.state)) ? 'unlink_reminder_confirmation_pending' : 'unlink_reminder_confirmation'),
          [{ text: t('m_19766ed6ccb2'), style: 'cancel' }, { text: t('m_b90108da0bd2'), onPress: () => void unlink() }]); }} />}
      <SettingRow icon="content_copy" label={t('m_02cdaabfca80')} disabled={command.isPending || uncertain} onPress={() => { setMenu(false); router.push({ pathname: '/edit', params: { duplicate: id, ...routeParams } }); }} />
      <SettingRow icon="history" label={t('m_38da1505ca83')} disabled={command.isPending || uncertain} onPress={() => { setMenu(false); router.push({ pathname: '/activity', params: { id, ...routeParams, originReminderId: id } }); }} />
      {adjust && item?.deliveryState !== 'Alerting' && <SettingRow icon="snooze" label={t('m_44f91ee971e4') + item.quickSnoozeMinutes + t('m_2e75737a6b58')} disabled={command.isPending || uncertain} onPress={() => { setMenu(false); void delivery('Snooze'); }} />}
      {active && item.segmentId && <SettingRow label={t('m_fb6f0c89eb3c')} disabled={command.isPending || uncertain} onPress={() => { setMenu(false); void content('Skip'); }} />}
      {item && !item.deleted && <View style={{ marginTop: 12, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border }}>
        <SettingRow icon="delete" label={t('m_9adcdf33dce1')} description={t('m_1faff714eac7')} disabled={command.isPending || uncertain} onPress={moveToTrash} />
      </View>}
      {item?.deleted && <SettingRow icon="delete_forever" label={t('m_280b10c89cc4')} description={t('m_a3e8748f021d')} disabled={command.isPending || uncertain}
        onPress={() => { if (command.isPending || pendingOperation.current || runningOperation.current) return; setMenu(false); setPurgeItem({ ...item }); }} />}
    </Sheet>
    <TrashConfirmation item={trashItem} onCancel={() => setTrashItem(null)} onConfirm={() => {
      if (!trashItem || command.isPending || pendingOperation.current || runningOperation.current) return;
      const captured = trashItem; setTrashItem(null); void content('Delete', captured);
    }} />
    <PurgeConfirmation items={purgeItem ? [purgeItem] : []} onCancel={() => setPurgeItem(null)} onConfirm={() => {
      if (!purgeItem || command.isPending || pendingOperation.current || runningOperation.current) return;
      const captured = purgeItem; setPurgeItem(null); void content('Purge', captured);
    }} />
    <Sheet title={t('m_4794fc66cf81')} visible={scope && !!item?.segmentId} returnFocusRef={scopeTrigger} returnFocusWhen={() => focused} onClose={() => setScope(false)}>
      <Copy heading>{item?.title}</Copy>
      {item && <Copy muted>{item.mode === 'None' ? t('m_b7eb137d28d1') + (item.allDay ? formatDate(item.eventStartMs, item.zoneId) + t('m_b3d544d5d55c') : formatTime(item.eventStartMs, item.zoneId)) : t('m_9feb5fc02300') + modeLabel(item.mode).toLowerCase() + ' · ' + formatTime(item.alarmAtMs, item.zoneId)}</Copy>}
      <SettingRow label={t('m_f1f3c6717092')} description={t('m_2e865a55dab6')} onPress={() => { setScope(false); router.push({ pathname: '/edit', params: { id, ...routeParams, originReminderId: id } }); }} />
      <QueryState loading={series.isLoading} error={series.error} onRetry={() => void series.refetch()} />
      {item?.segmentId && series.data && series.data.state !== 'Archived' && <>
        <SettingRow label={t('m_3374941b0ba2')} description={t('m_5f4c9ca214d4')} onPress={() => { setScope(false); router.push({ pathname: '/edit', params: { segmentId: item.segmentId!, following: item.nominalSlot!, ...routeParams, originReminderId: id } }); }} />
        <SettingRow label={t('m_b76950f065f0')} description={t('m_9b8c73c985f1')} onPress={() => { setScope(false); router.push({ pathname: '/edit', params: { segmentId: item.segmentId!, ...routeParams, originReminderId: id } }); }} />
      </>}
      {series.data?.state === 'Archived' && <Copy muted size={typography.supporting}>{t('m_eabe16e1ec41')}</Copy>}
    </Sheet>
    <Sheet title={t('m_a5200499d443')} visible={postpone} onClose={closePostpone} footer={<BottomActionBar><View style={{ flex: 1, gap: 8 }}>
      {sheetFeedback && !uncertain && <ActionFeedback {...sheetFeedback} />}
      {uncertain && <ActionFeedback message={recovery.message} tone="warning" />}
      {postponeResult ? <><Button label={t('m_59f6ec7bb281')} onPress={closePostpone} />
        <Button label={t('m_0146bbb12bf3')} variant="secondary" onPress={() => { closePostpone(); router.push({ pathname: '/alarm-check', params: { ...routeParams, originReminderId: id } }); }} /></> :
        <Button label={command.isPending ? t('m_1622aa101d70') : uncertain ? recovery.retry : t('m_a5200499d443')} busy={command.isPending}
          disabled={command.isPending || (!uncertain && (!adjust || target <= now))} onPress={() => void (uncertain ? runPending() : delivery('Postpone', target))} />}
    </View></BottomActionBar>}>
      <Copy heading>{item?.title}</Copy><Copy muted size={14}>{t('m_b581db28b50e')}</Copy>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[15, 30, 60].map((minutes) => <View key={minutes} style={{ flexGrow: 1, flexBasis: 88 }}>
        <Choice label={minutes === 60 ? t('m_698eab0611ad') : t('m_592b238e52a5') + minutes + t('m_336e6529193b')} selected={selection === String(minutes)} disabled={frozenPostpone}
          onPress={() => { setTarget(Date.now() + minutes * 60_000); setSelection(String(minutes)); setSheetFeedback(null); }} /></View>)}</View>
      {[settings.data?.tomorrowMorning ?? 600, settings.data?.tomorrowAfternoon ?? 840, settings.data?.tomorrowEvening ?? 1020].map((minutes, index) => {
        return <Choice key={index} label={t('m_45f074a10945') + clockPreferenceLabel(minutes)} selected={selection === 'tomorrow-' + index} disabled={frozenPostpone} onPress={() => { tomorrow(minutes); setSelection('tomorrow-' + index); }} />;
      })}
      <DateField label={selection === 'custom' ? t('m_951aba5b302c') : t('m_a8c6ab4d7e5d')} value={target} disabled={frozenPostpone} onChange={(value) => { setTarget(value); setSelection('custom'); setSheetFeedback(null); }} />
      <Copy>{t('m_ac9a908af109')}{formatTime(target)}</Copy><ZoneSummary zoneId={deviceZone()} atMs={target} />
      {!postponeResult && !uncertain && target <= now && <Status label={t('m_d4c558eae719')} tone="danger" />}
      {!postponeResult && !uncertain && !adjust && item && <Status label={t('m_21731204daa0')} tone="warning" />}
    </Sheet>
  </Page>;
}
