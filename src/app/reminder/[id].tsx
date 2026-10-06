import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import type { ContentCommand, DeliveryCommand, Occurrence } from '../../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback } from '../../domain/actions';
import type { Tone } from '../../domain/actions';
import { rootRoute } from '../../domain/navigation';
import { canAdjustAlert, deliveryExplanation, recordedCompletionTime, repeatSummary, scheduleDateTime, stateIcon, stateLabel, stateTone } from '../../domain/presentation';
import { deviceZone } from '../../domain/time';
import { ActionFeedback, BottomActionBar, Button, Copy, DateField, formatTime, Group, IconButton, Page, QueryState, SettingRow, Sheet, shortDateTime, shortTime, Status } from '../../ui/components';
import { notifyTrash } from '../../ui/navigation';
import { CommandError, engine, nativeAvailable, useCommand, useSettings } from '../../ui/native';
import { typography } from '../../ui/tokens';
import { Schedule, ScheduleDetails, ZoneSummary } from '../../ui/schedule';
import { useTheme } from '../../ui/theme';

const activity: Record<string, string> = { TimedOut: 'Alarm timed out', UndoDelete: 'Restored', Delete: 'Moved to Trash', Reopen: 'Reopened', Done: 'Completed',
  Stop: 'Alarm stopped', StopAll: 'Ringing stopped', Snooze: 'Snoozed', Postpone: 'Postponed', Skip: 'Occurrence skipped', Edit: 'Edited', Create: 'Created',
  Interrupted: 'Alarm interrupted', Failed: 'Alarm failed', Missed: 'Alarm missed', Notified: 'Notification sent', PauseSeries: 'Repeat paused', ResumeSeries: 'Repeat resumed' };
type Feedback = { message: string; tone: Tone };
export default function ReminderDetails() {
  const { id, action } = useLocalSearchParams<{ id: string; action?: string }>();
  const query = useQuery({ queryKey: ['occurrence', id], queryFn: () => engine().getOccurrence(id), enabled: nativeAvailable });
  const item = query.data, settings = useSettings(), command = useCommand(), colors = useTheme();
  const itemId = item?.id, segmentId = item?.segmentId;
  const series = useQuery({ queryKey: ['series', item?.segmentId], queryFn: () => engine().getSeries(item!.segmentId!), enabled: nativeAvailable && !!item?.segmentId });
  const families = useQuery({ queryKey: ['repeat-families'], queryFn: () => engine().queryRepeatFamilies(), enabled: nativeAvailable && !!item?.segmentId });
  const family = families.data?.find((candidate) => candidate.seriesId === series.data?.seriesId);
  const [postpone, setPostpone] = useState(action === 'postpone'), [scope, setScope] = useState(action === 'edit'), [menu, setMenu] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [target, setTarget] = useState(() => Date.now() + 900_000), [feedback, setFeedback] = useState<Feedback | null>(null), [sheetFeedback, setSheetFeedback] = useState<Feedback | null>(null);
  const pendingOperation = useRef<{ command: ContentCommand | DeliveryCommand; item: Occurrence; success: string } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  usePreventRemove(command.isPending || uncertain, () => {
    Alert.alert('Change not yet confirmed', 'Wait for this change, or retry it before leaving.');
  });
  useEffect(() => { if (action !== 'edit' || !itemId) return;
    if (!segmentId) router.replace({ pathname: '/edit', params: { id: itemId } });
  }, [action, itemId, segmentId]);
  useEffect(() => { if (!postpone) return; const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick); }, [postpone]);
  const runPending = async () => {
    const operation = pendingOperation.current;
    if (!operation || command.isPending) return;
    setFeedback(null); setSheetFeedback(null);
    try {
      const result = await command.mutateAsync(operation.command);
      pendingOperation.current = null; setUncertain(false);
      const next = commandFeedback(result, operation.success);
      setFeedback(next);
      if (operation.command.kind === 'Delete') {
        notifyTrash(operation.item, result);
        // Allow the confirmed-operation guard to settle before navigation.
        setDeleted(true);
      } else if ('expectedGeneration' in operation.command) {
        if (result.status === 'Blocked' || result.status === 'Pending') setSheetFeedback(next); else setPostpone(false);
      }
    } catch (error) {
      if (error instanceof CommandError) { pendingOperation.current = null; setUncertain(false); }
      else setUncertain(true);
      const next: Feedback = { message: error instanceof Error ? error.message : 'Could not confirm this change. Retry it.', tone: 'danger' };
      setFeedback(next); if ('expectedGeneration' in operation.command) setSheetFeedback(next);
    }
  };
  const [deleted, setDeleted] = useState(false);
  useEffect(() => { if (deleted && !command.isPending && !uncertain) { if (router.canGoBack()) router.back(); else router.replace('/'); } }, [deleted, command.isPending, uncertain]);
  const content = async (kind: ContentCommand['kind']) => {
    if (!item || command.isPending || pendingOperation.current) return;
    pendingOperation.current = { command: { kind, occurrenceId: id, expectedRevision: item.revision, operationId: engine().createOperationId() }, item, success: activity[kind] ?? 'Reminder updated' };
    await runPending();
  };
  const moveToTrash = () => {
    setMenu(false);
    if (!item) return;
    if (item.completed || item.skipped) { void content('Delete'); return; }
    Alert.alert(item.segmentId ? 'Move this occurrence to Trash?' : 'Move reminder to Trash?',
      'Its alert will be cancelled. You can restore it from Trash.', [{ text: 'Keep reminder', style: 'cancel' },
        { text: 'Move to Trash', style: 'destructive', onPress: () => void content('Delete') }]);
  };
  const delivery = async (kind: DeliveryCommand['kind'], alarmAtMs?: number) => {
    if (!item || command.isPending || pendingOperation.current || !canAdjustAlert(item) || kind === 'Stop' && item.deliveryState !== 'Alerting') return;
    pendingOperation.current = { command: { kind, occurrenceId: id, expectedGeneration: item.generation, alarmAtMs, operationId: engine().createOperationId() }, item,
      success: kind === 'Stop' ? 'Alarm stopped. Still unfinished.' : kind === 'Postpone' ? 'Next alert postponed to ' + shortDateTime(alarmAtMs!) : 'Next alert snoozed' };
    await runPending();
  };
  const edit = () => { setMenu(false); if (item?.segmentId) setScope(true); else router.push({ pathname: '/edit', params: { id } }); };
  const openPostpone = () => { const current = Date.now(); setNow(current); setTarget(current + 900_000); setSheetFeedback(null); setPostpone(true); };
  const tomorrow = (minutes: number) => { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); setTarget(date.getTime()); setSheetFeedback(null); };
  const active = item && !item.deleted && !item.completed && !item.skipped;
  const adjust = item && canAdjustAlert(item), completion = recordedCompletionTime(item?.history);
  const explanation = item ? deliveryExplanation(item) : null;
  return <Page title="Reminder" actions={item ? <>{!item.deleted && <IconButton icon="edit" label="Edit reminder" onPress={edit} />}
    <IconButton icon="more_vert" label="Reminder actions" onPress={() => setMenu(true)} /></> : undefined}
    footer={item && (active || item.completed || item.skipped || item.deleted) ? <BottomActionBar>
      {active && adjust && item.deliveryState === 'Alerting' && <View style={{ width: '100%', gap: 8 }}>
        <Copy muted size={typography.supporting}>Alarm ringing · these actions leave the reminder unfinished</Copy>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ flexGrow: 1, flexBasis: 120 }}><Button icon="stop" label="Stop alarm" variant="secondary" disabled={command.isPending || uncertain} onPress={() => void delivery('Stop')} /></View>
          <View style={{ flexGrow: 1, flexBasis: 120 }}><Button icon="snooze" label={'Snooze ' + (settings.data?.snoozeMinutes ?? 10) + ' min'} variant="secondary" disabled={command.isPending || uncertain} onPress={() => void delivery('Snooze')} /></View>
        </View>
      </View>}
      {active && <>
      <View style={{ flexGrow: 1, flexBasis: 120 }}><Button icon="check" label="Done" disabled={command.isPending || uncertain} onPress={() => void content('Done')} /></View>
      {adjust && <View style={{ flexGrow: 1, flexBasis: 120 }}><Button icon="schedule" label="Postpone" variant="secondary" disabled={command.isPending || uncertain} onPress={openPostpone} /></View>}
      </>}
      {item.deleted ? <View style={{ flex: 1 }}><Button icon="undo" label="Restore reminder" disabled={command.isPending || uncertain} onPress={() => void content('UndoDelete')} /></View> :
        (item.completed || item.skipped) && <View style={{ flex: 1 }}><Button icon="undo" label={item.skipped ? 'Reopen occurrence' : 'Reopen reminder'} variant="secondary" disabled={command.isPending || uncertain} onPress={() => void content('Reopen')} /></View>}
    </BottomActionBar> : undefined}>
    <QueryState loading={query.isLoading && nativeAvailable} error={query.error} empty={!item && !query.isLoading} emptyMessage="This reminder is unavailable." onRetry={() => void query.refetch()} />
    {item && <>
      <Copy heading size={typography.title}>{item.title}</Copy>
      {item.deleted ? <Status icon="delete" label="In Trash" /> : item.completed ?
        <Status label={completion == null ? 'Completed' : 'Completed ' + scheduleDateTime(completion)} tone="success" /> :
        <View style={{ gap: 8 }}>{item.overdue && <Status icon="warning" label="Overdue — still unfinished" tone="danger" />}
          {!explanation && item.mode !== 'None' && !!stateLabel(item) && <Status icon={stateIcon(item)} label={stateLabel(item)} tone={stateTone(item)} />}</View>}
      {explanation && <Status icon={stateIcon(item)} label={explanation} tone={stateTone(item)} />}
      {item.deliveryState === 'Blocked' && active && <Button icon="settings" label="Check alert permissions" variant="secondary" onPress={() => router.push('/settings')} />}
      <Schedule item={item} details={false} />
      {!!item.notes && <View style={{ gap: 8 }}><Copy muted size={typography.label}>NOTES</Copy><Copy>{item.notes}</Copy></View>}
      {!!item.listName && <SettingRow icon="folder" label="List" value={item.listName} onPress={() => router.push(rootRoute({ kind: 'list', listId: item.listId ?? null }))} />}
      {feedback && <ActionFeedback {...feedback} />}
      {uncertain && <><ActionFeedback message="Change not confirmed. Retry the same change before leaving." tone="warning" />
        <Button label="Retry change" variant="secondary" disabled={command.isPending} onPress={() => void runPending()} /></>}
      {command.isPending && <ActionFeedback loading message="Applying change…" />}
      {item.segmentId && <Group title="Repeat">
        <SettingRow icon="repeat" label={repeatSummary(item) ?? 'Repeating'} description={(family?.state === 'Paused' ? 'Repeat paused' : family?.state === 'Ended' ? 'Repeat ended' : 'This occurrence') +
          (item.exception ? item.deliveryState === 'Scheduled' ? ' · Independent alert scheduled' : item.deliveryState === 'Blocked' ? ' · Independent alert blocked' : item.deliveryState === 'Pending' ? ' · Independent alert pending' : ' · Individual change' : '')}
          onPress={() => router.push({ pathname: '/series/[id]', params: { id: item.segmentId!, ...(family ? { seriesId: family.seriesId } : {}) } })} />
        <QueryState loading={series.isLoading} error={series.error} onRetry={() => void series.refetch()} />
        {series.data?.state === 'Archived' && <View style={{ padding: 16 }}><Copy muted size={typography.supporting}>This occurrence belongs to a previous schedule. Repeat details shows the current family.</Copy></View>}
      </Group>}
      <ScheduleDetails item={item} />
    </>}
    <Sheet title="Reminder actions" visible={menu} onClose={() => setMenu(false)}>
      {item && !item.deleted && <SettingRow icon="edit" label="Edit" onPress={edit} />}
      <SettingRow icon="content_copy" label="Duplicate" onPress={() => { setMenu(false); router.push({ pathname: '/edit', params: { duplicate: id } }); }} />
      <SettingRow icon="history" label="Activity" onPress={() => { setMenu(false); router.push({ pathname: '/activity', params: { id } }); }} />
      {adjust && item?.deliveryState !== 'Alerting' && <SettingRow icon="snooze" label={'Snooze ' + (settings.data?.snoozeMinutes ?? 10) + ' minutes'} disabled={command.isPending || uncertain} onPress={() => { setMenu(false); void delivery('Snooze'); }} />}
      {active && item.segmentId && <SettingRow label="Skip this occurrence" disabled={command.isPending || uncertain} onPress={() => { setMenu(false); void content('Skip'); }} />}
      {item && !item.deleted && <View style={{ marginTop: 12, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border }}>
        <SettingRow icon="delete" label="Move to Trash" description="Cancels its alert. Recoverable from Trash." disabled={command.isPending || uncertain} onPress={moveToTrash} />
      </View>}
    </Sheet>
    <Sheet title="Edit repeating reminder" visible={scope && !!item?.segmentId} onClose={() => setScope(false)}>
      <SettingRow label="This occurrence" onPress={() => { setScope(false); router.push({ pathname: '/edit', params: { id } }); }} />
      <QueryState loading={series.isLoading} error={series.error} onRetry={() => void series.refetch()} />
      {item?.segmentId && series.data && series.data.state !== 'Archived' && <>
        <SettingRow label="This and following" onPress={() => { setScope(false); router.push({ pathname: '/edit', params: { segmentId: item.segmentId!, following: item.nominalSlot! } }); }} />
        <SettingRow label="Entire series" onPress={() => { setScope(false); router.push({ pathname: '/edit', params: { segmentId: item.segmentId! } }); }} />
      </>}
      {series.data?.state === 'Archived' && <Copy muted size={typography.supporting}>This occurrence belongs to a previous schedule. Use Repeat details to review the current reminder.</Copy>}
    </Sheet>
    <Sheet title="Postpone" visible={postpone} onClose={() => { if (!command.isPending) setPostpone(false); }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[15, 30, 60].map((minutes) => <Button key={minutes} label={minutes + ' min'} variant="secondary" disabled={command.isPending || uncertain}
        onPress={() => { setTarget(Date.now() + minutes * 60_000); setSheetFeedback(null); }} />)}</View>
      {[settings.data?.tomorrowMorning ?? 600, settings.data?.tomorrowAfternoon ?? 840, settings.data?.tomorrowEvening ?? 1020].map((minutes, index) => {
        const date = new Date(); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        return <SettingRow key={index} label={'Tomorrow ' + shortTime(date.getTime())} disabled={command.isPending || uncertain} onPress={() => tomorrow(minutes)} />;
      })}
      <DateField label="Custom time" value={target} disabled={command.isPending || uncertain} onChange={(value) => { setTarget(value); setSheetFeedback(null); }} />
      <Copy>Next alert {formatTime(target)}</Copy><ZoneSummary zoneId={deviceZone()} atMs={target} /><Copy muted size={typography.supporting}>When and due time stay unchanged. This replaces Snooze.</Copy>
      {target <= now && <Status label="Choose a future time." tone="danger" />}
      {!adjust && item && <Status label="This reminder has no eligible alert to postpone." tone="warning" />}
      <Button label={command.isPending ? 'Postponing…' : 'Postpone'} disabled={!adjust || command.isPending || uncertain || target <= now} onPress={() => void delivery('Postpone', target)} />
      {sheetFeedback && <ActionFeedback {...sheetFeedback} />}
    </Sheet>
  </Page>;
}
