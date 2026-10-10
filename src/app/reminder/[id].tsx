import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { ContentCommand, DeliveryCommand, Occurrence } from '../../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback } from '../../domain/actions';
import type { Tone } from '../../domain/actions';
import { creationOrigin, originParams, reminderListRoute, secondaryOriginRoute, type OriginParams } from '../../domain/navigation';
import { alertPresentation, canAdjustAlert, deliveryExplanation, overduePresentation, recordedCompletionTime, repeatSummary, scheduleDateTime, stateIcon, stateLabel, stateTone } from '../../domain/presentation';
import { deviceZone } from '../../domain/time';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, DateField, formatTime, Icon, IconButton, Page, QueryState, SettingRow, Sheet, shortTime, Status } from '../../ui/components';
import { notifyTrash } from '../../ui/navigation';
import { CommandError, engine, nativeAvailable, useCommand, useSettings } from '../../ui/native';
import { typography } from '../../ui/tokens';
import { InformationRow, Schedule, ScheduleDetails, ZoneSummary } from '../../ui/schedule';
import { useAppearanceHold, useFontScaleOverride, useTheme } from '../../ui/theme';
import { useAppearanceConfirmation } from '../../ui/confirmation';
import { PurgeConfirmation } from '../../ui/purge-confirmation';
import { TrashConfirmation } from '../../ui/trash-confirmation';
import { CalendarPublicationStatus } from '../../ui/calendar-publication';

const activity: Record<string, string> = { Purge: 'Reminder permanently deleted.', TimedOut: 'Alarm timed out', UndoDelete: 'Restored', Delete: 'Moved to Trash', Reopen: 'Reopened', Done: 'Completed',
  Stop: 'Alarm stopped', StopAll: 'Ringing stopped', Snooze: 'Snoozed', Postpone: 'Postponed', Skip: 'Occurrence skipped', Edit: 'Edited', Create: 'Created',
  Interrupted: 'Alarm interrupted', Failed: 'Alarm failed', Missed: 'Alarm missed', Notified: 'Notification sent', PauseSeries: 'Repeat paused', ResumeSeries: 'Repeat resumed' };
type Feedback = { message: string; tone: Tone };
export default function ReminderDetails() {
  const params = useLocalSearchParams<OriginParams & { id: string; action?: string }>(), { id, action } = params;
  const origin = useMemo(() => creationOrigin({ originRoot: params.originRoot, originListId: params.originListId, originNoList: params.originNoList }), [params.originRoot, params.originListId, params.originNoList]);
  const routeParams = useMemo(() => ({ ...originParams(origin), originCollection: params.originCollection, originFamily: params.originFamily,
    originSegmentId: params.originSegmentId, originReminderId: params.originReminderId }), [origin, params.originCollection, params.originFamily, params.originSegmentId, params.originReminderId]);
  const query = useQuery({ queryKey: ['occurrence', id], queryFn: () => engine().getOccurrence(id), enabled: nativeAvailable });
  const item = query.data, settings = useSettings(), command = useCommand(), colors = useTheme();
  const calendar = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(), enabled: nativeAvailable });
  const publication = calendar.data?.find((value) => value.occurrenceId === id);
  const scale = useFontScaleOverride(), { fontScale } = useWindowDimensions();
  const confirm = useAppearanceConfirmation();
  const itemId = item?.id, segmentId = item?.segmentId;
  const series = useQuery({ queryKey: ['series', item?.segmentId], queryFn: () => engine().getSeries(item!.segmentId!), enabled: nativeAvailable && !!item?.segmentId });
  const families = useQuery({ queryKey: ['repeat-families'], queryFn: () => engine().queryRepeatFamilies(), enabled: nativeAvailable && !!item?.segmentId });
  const family = families.data?.find((candidate) => candidate.seriesId === series.data?.seriesId);
  const [postpone, setPostpone] = useState(action === 'postpone'), [scope, setScope] = useState(action === 'edit'), [menu, setMenu] = useState(false);
  const [purgeItem, setPurgeItem] = useState<Occurrence | null>(null);
  const [trashItem, setTrashItem] = useState<Occurrence | null>(null);
  const [now, setNow] = useState(Date.now);
  const [target, setTarget] = useState(() => Date.now() + 900_000), [feedback, setFeedback] = useState<Feedback | null>(null), [sheetFeedback, setSheetFeedback] = useState<Feedback | null>(null);
  const pendingOperation = useRef<{ command: ContentCommand | DeliveryCommand; item: Occurrence; success: string } | null>(null);
  const runningOperation = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const [postponeResult, setPostponeResult] = useState(false), [selection, setSelection] = useState('15');
  useAppearanceHold(command.isPending || uncertain);
  usePreventRemove(command.isPending || uncertain, () => {
    confirm('Change not yet confirmed', 'Wait for this change, or retry it before leaving.');
  });
  useEffect(() => { if (action !== 'edit' || !itemId) return;
    if (!segmentId) router.replace({ pathname: '/edit', params: { id: itemId, ...routeParams, originReminderId: itemId } });
  }, [action, itemId, segmentId, routeParams]);
  useEffect(() => { if (!postpone) return; const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick); }, [postpone]);
  const runPending = async () => {
    const operation = pendingOperation.current;
    if (!operation || command.isPending || runningOperation.current) return;
    runningOperation.current = true;
    setFeedback(null); setSheetFeedback(null);
    try {
      const result = await command.mutateAsync(operation.command);
      pendingOperation.current = null; setUncertain(false);
      const next = 'expectedGeneration' in operation.command && operation.command.kind === 'Postpone' && ['Blocked', 'Pending'].includes(result.status)
        ? { message: `Saved; ${result.status === 'Blocked' ? 'alert blocked' : 'scheduling pending'}. Next alert ${formatTime(operation.command.alarmAtMs!)}. Check its next alert status.`, tone: 'warning' as const }
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
      const next: Feedback = { message: error instanceof Error ? error.message : 'Could not confirm this change. Retry it.', tone: 'danger' };
      setFeedback(next); if ('expectedGeneration' in operation.command) setSheetFeedback(next);
    } finally { runningOperation.current = false; }
  };
  const [deleted, setDeleted] = useState(false);
  useEffect(() => { if (deleted && !command.isPending && !uncertain) { if (router.canGoBack()) router.back(); else router.replace(secondaryOriginRoute(routeParams)); } }, [deleted, command.isPending, uncertain, routeParams]);
  const content = async (kind: ContentCommand['kind'], captured = item) => {
    if (!captured || command.isPending || pendingOperation.current) return;
    pendingOperation.current = { command: { kind, occurrenceId: id, expectedRevision: captured.revision, operationId: engine().createOperationId() }, item: captured, success: activity[kind] ?? 'Reminder updated' };
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
      success: kind === 'Stop' || kind === 'CompleteDelivery' ? 'Reminder completed.' : kind === 'Postpone' ? 'Next alert postponed to ' + formatTime(alarmAtMs!) : 'Next alert snoozed. Still unfinished.' };
    await runPending();
  };
  const edit = () => { if (command.isPending || uncertain) return; setMenu(false); if (item?.segmentId) setScope(true); else router.push({ pathname: '/edit', params: { id, ...routeParams, originReminderId: id } }); };
  const openPostpone = () => { const current = Date.now(); setNow(current); setTarget(current + 900_000); setSelection('15'); setSheetFeedback(null); setPostponeResult(false); setPostpone(true); };
  const tomorrow = (minutes: number) => { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); setTarget(date.getTime()); setSheetFeedback(null); };
  const active = item && !item.deleted && !item.completed && !item.skipped;
  const adjust = item && canAdjustAlert(item), completion = recordedCompletionTime(item?.history);
  const explanation = item ? deliveryExplanation(item) : null;
  const overdueStatus = item ? overduePresentation(item) : null;
  const frozenPostpone = command.isPending || uncertain || postponeResult;
  const closePostpone = () => { if (!command.isPending && !uncertain && !pendingOperation.current) setPostpone(false); };
  return <Page title="Reminder" onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(routeParams))}
    actions={item ? <>{!item.deleted && <IconButton icon="edit" label="Edit reminder" disabled={command.isPending || uncertain} onPress={edit} />}
    <IconButton icon="more_vert" label="Reminder actions" disabled={command.isPending || uncertain} onPress={() => setMenu(true)} /></> : undefined}
    footer={item && (active || item.completed || item.skipped || item.deleted) ? <BottomActionBar>
      {active && <>
      {item.deliveryState === 'Alerting' && <Copy muted size={typography.supporting}>Alarm ringing</Copy>}
      <View style={{ width: '100%' }}><Button icon="check" label="Done" disabled={command.isPending || uncertain}
        onPress={() => void (item.deliveryState === 'Alerting' ? delivery('CompleteDelivery') : content('Done'))} /></View>
      {adjust && item.deliveryState === 'Alerting' && <View style={{ width: '100%' }}><Button icon="snooze" label={'Snooze · ' + item.quickSnoozeMinutes + ' min'} variant="secondary"
        disabled={command.isPending || uncertain} onPress={() => void delivery('Snooze')} /></View>}
      {adjust && <View style={{ width: '100%' }}><Button icon="schedule" label="Postpone alert" variant="secondary" disabled={command.isPending || uncertain} onPress={openPostpone} /></View>}
      </>}
      {item.deleted ? <View style={{ flex: 1 }}><Button icon="undo" label="Restore reminder" disabled={command.isPending || uncertain} onPress={() => void content('UndoDelete')} /></View> :
        (item.completed || item.skipped) && <View style={{ flex: 1 }}><Button icon="undo" label={item.skipped ? 'Reopen occurrence' : 'Reopen reminder'} variant="secondary" disabled={command.isPending || uncertain} onPress={() => void content('Reopen')} /></View>}
    </BottomActionBar> : undefined}>
    <QueryState loading={query.isLoading && nativeAvailable && !item} error={!item ? query.error : undefined} empty={!item && !query.isLoading && !uncertain && !command.isPending} emptyMessage="This reminder is unavailable." onRetry={nativeAvailable ? () => void query.refetch() : undefined} />
    {feedback && <ActionFeedback {...feedback} />}
    {uncertain && <>
      <ActionFeedback message="Change not confirmed. Retry the same change before leaving." tone="warning" />
      <Button label="Retry change" variant="secondary" disabled={command.isPending} onPress={() => void runPending()} /></>}
    {command.isPending && <ActionFeedback loading message="Applying change…" />}
    {item && <>
      {publication && <CalendarPublicationStatus publication={publication} />}
      {query.error && <><ActionFeedback message="Could not refresh. Showing the previous reminder." tone="warning" /><Button label="Retry" variant="secondary" onPress={() => void query.refetch()} /></>}
      <View style={{flexDirection:'row',alignItems:'flex-start',gap:12}}><View style={{height:typography.title*scale*fontScale*1.4,justifyContent:'center'}}><Icon name="event" color={colors.muted} size={28}/></View><View style={{flex:1}}><Copy heading size={typography.title}>{item.title}</Copy></View></View>
      {item.deleted ? <Status icon="delete" label="In Trash" /> : item.completed ?
        <Status label={completion == null ? 'Completed' : 'Completed ' + scheduleDateTime(completion)} tone="success" /> :
        item.skipped ? <Status icon="cancel" label="Skipped" /> : <View style={{ gap: 8 }}>{overdueStatus && <View accessible accessibilityLabel={overdueStatus.spokenLabel}><Status icon="warning" label={overdueStatus.label} tone="warning" /></View>}
          {alertPresentation(item).confirmed && <Status label="Scheduled" tone="success" />}
          {!explanation && item.mode !== 'None' && !!stateLabel(item) && <Status icon={stateIcon(item)} label={stateLabel(item)} tone={stateTone(item)} />}</View>}
      {explanation && !item.deleted && <Status icon={stateIcon(item)} label={explanation} tone={stateTone(item)} />}
      {item.deleted && <><Status label={item.skipped ? 'Previously skipped' : item.completed ? completion == null ? 'Previously completed' : 'Previously completed ' + scheduleDateTime(completion) : 'Previously unfinished'} tone={item.completed ? 'success' : 'muted'} /><Copy muted size={14}>Restore keeps this work state and never replays past alerts.</Copy></>}
      {item.deliveryState === 'Blocked' && active && <Button icon="settings" label="Review alert permissions" variant="secondary" disabled={command.isPending || uncertain} onPress={() => {
        if (!pendingOperation.current && !runningOperation.current) router.push({ pathname: '/settings', params: { ...routeParams, originReminderId: id } });
      }} />}
      <Schedule item={item} details={false} connected>
        <InformationRow key="list" icon="checklist" label="List" value={item.listName || 'No list'} onPress={command.isPending || uncertain ? undefined : () => {
          if (!pendingOperation.current && !runningOperation.current) router.push(reminderListRoute(item.listId ?? null, id, routeParams));
        }} />
        {!!item.notes && <InformationRow key="notes" icon="notes" label="Notes" value={item.notes} />}
      </Schedule>
      {item.segmentId && <ConnectedGroup title="Repeat" footer={series.isLoading || series.error || series.data?.state === 'Archived' ? <>
        <QueryState loading={series.isLoading} error={series.error} onRetry={() => void series.refetch()} />
        {series.data?.state === 'Archived' && <Copy muted size={typography.supporting}>This occurrence belongs to a previous schedule. Repeat details shows the current family.</Copy>}
      </> : undefined}>
        <SettingRow key="repeat" icon="repeat" label={repeatSummary(item) ?? 'Repeating'} description={(family?.state === 'Paused' ? 'Repeat paused' : family?.state === 'Ended' ? 'Repeat ended' : 'This occurrence') +
          (item.exception ? item.deliveryState === 'Scheduled' ? ' · Independent alert scheduled' : item.deliveryState === 'Blocked' ? ' · Independent alert blocked' : item.deliveryState === 'Pending' ? ' · Independent alert pending' : ' · Individual change' : '')}
          disabled={command.isPending || uncertain} onPress={() => {
            if (!pendingOperation.current && !runningOperation.current) router.push({ pathname: '/series/[id]', params: { id: item.segmentId!, ...(family ? { seriesId: family.seriesId } : {}), ...routeParams, originReminderId: id } });
          }} />
      </ConnectedGroup>}
      <ScheduleDetails item={item} />
    </>}
    <Sheet title="Reminder actions" visible={menu} onClose={() => setMenu(false)}>
      {item && !item.deleted && <SettingRow icon="edit" label="Edit" onPress={edit} />}
      {active && !item.segmentId && (!publication || publication.state === 'Cancelled') && <SettingRow icon="event" label="Publish to Google Calendar" disabled={command.isPending || uncertain}
        onPress={() => { setMenu(false); router.push({ pathname: '/calendar-publish', params: { id, ...routeParams, originReminderId: id } }); }} />}
      <SettingRow icon="content_copy" label="Duplicate" disabled={command.isPending || uncertain} onPress={() => { setMenu(false); router.push({ pathname: '/edit', params: { duplicate: id, ...routeParams } }); }} />
      <SettingRow icon="history" label="Activity" disabled={command.isPending || uncertain} onPress={() => { setMenu(false); router.push({ pathname: '/activity', params: { id, ...routeParams, originReminderId: id } }); }} />
      {adjust && item?.deliveryState !== 'Alerting' && <SettingRow icon="snooze" label={'Snooze · ' + item.quickSnoozeMinutes + ' min'} disabled={command.isPending || uncertain} onPress={() => { setMenu(false); void delivery('Snooze'); }} />}
      {active && item.segmentId && <SettingRow label="Skip this occurrence" disabled={command.isPending || uncertain} onPress={() => { setMenu(false); void content('Skip'); }} />}
      {item && !item.deleted && <View style={{ marginTop: 12, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border }}>
        <SettingRow icon="delete" label="Move to Trash" description="Cancels its alert. Recoverable from Trash." disabled={command.isPending || uncertain} onPress={moveToTrash} />
      </View>}
      {item?.deleted && <SettingRow icon="delete_forever" label="Delete permanently" description="Cannot be undone." disabled={command.isPending || uncertain}
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
    <Sheet title="Edit repeating reminder" visible={scope && !!item?.segmentId} onClose={() => setScope(false)}>
      <SettingRow label="This occurrence" description="Changes only this occurrence. Repeat stays read-only family context." onPress={() => { setScope(false); router.push({ pathname: '/edit', params: { id, ...routeParams, originReminderId: id } }); }} />
      <QueryState loading={series.isLoading} error={series.error} onRetry={() => void series.refetch()} />
      {item?.segmentId && series.data && series.data.state !== 'Archived' && <>
        <SettingRow label="This and following" description={'Starts from the original Event ' + formatTime(item.eventStartMs, item.zoneId) + '. Earlier unfinished and postponed occurrences remain separate.'} onPress={() => { setScope(false); router.push({ pathname: '/edit', params: { segmentId: item.segmentId!, following: item.nominalSlot!, ...routeParams, originReminderId: id } }); }} />
        <SettingRow label="Entire series" description="Opens the current series. Earlier unfinished and postponed occurrences remain retained." onPress={() => { setScope(false); router.push({ pathname: '/edit', params: { segmentId: item.segmentId!, ...routeParams, originReminderId: id } }); }} />
      </>}
      {series.data?.state === 'Archived' && <Copy muted size={typography.supporting}>This occurrence belongs to a previous schedule. Use Repeat details to review the current reminder.</Copy>}
    </Sheet>
    <Sheet title="Postpone alert" visible={postpone} onClose={closePostpone} footer={<BottomActionBar><View style={{ flex: 1, gap: 8 }}>
      {sheetFeedback && <ActionFeedback {...sheetFeedback} />}
      {uncertain && <ActionFeedback message="Change not confirmed. Retry the same change before leaving." tone="warning" />}
      {postponeResult ? <><Button label="Return to reminder" onPress={closePostpone} />
        <Button label="Review alert permissions" variant="secondary" onPress={() => { closePostpone(); router.push({ pathname: '/settings', params: { ...routeParams, originReminderId: id } }); }} /></> :
        <Button label={command.isPending ? 'Postponing…' : uncertain ? 'Retry change' : 'Postpone alert'} busy={command.isPending}
          disabled={command.isPending || (!uncertain && (!adjust || target <= now))} onPress={() => void (uncertain ? runPending() : delivery('Postpone', target))} />}
    </View></BottomActionBar>}>
      <Copy heading>{item?.title}</Copy><Copy muted size={14}>Changes the next alert only. Event and due time stay unchanged.</Copy>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[15, 30, 60].map((minutes) => <View key={minutes} style={{ flexGrow: 1, flexBasis: 88 }}>
        <Choice label={minutes === 60 ? '1 hour' : minutes + ' min'} selected={selection === String(minutes)} disabled={frozenPostpone}
          onPress={() => { setTarget(Date.now() + minutes * 60_000); setSelection(String(minutes)); setSheetFeedback(null); }} /></View>)}</View>
      {[settings.data?.tomorrowMorning ?? 600, settings.data?.tomorrowAfternoon ?? 840, settings.data?.tomorrowEvening ?? 1020].map((minutes, index) => {
        const date = new Date(); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        return <Choice key={index} label={'Tomorrow ' + ['morning', 'afternoon', 'evening'][index] + ' · ' + shortTime(date.getTime())} selected={selection === 'tomorrow-' + index} disabled={frozenPostpone} onPress={() => { tomorrow(minutes); setSelection('tomorrow-' + index); }} />;
      })}
      <DateField label={selection === 'custom' ? 'Custom date and time · selected' : 'Custom date and time'} value={target} disabled={frozenPostpone} onChange={(value) => { setTarget(value); setSelection('custom'); setSheetFeedback(null); }} />
      <Copy>Next alert {formatTime(target)}</Copy><ZoneSummary zoneId={deviceZone()} atMs={target} /><Copy muted size={typography.supporting}>When and due time stay unchanged. This replaces Snooze.</Copy>
      {!postponeResult && !uncertain && target <= now && <Status label="Choose a future time." tone="danger" />}
      {!postponeResult && !uncertain && !adjust && item && <Status label="This reminder has no eligible alert to postpone." tone="warning" />}
    </Sheet>
  </Page>;
}
