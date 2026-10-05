import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import type { ContentCommand, DeliveryCommand } from '../../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback } from '../../domain/actions';
import type { Tone } from '../../domain/actions';
import { nextAlertTime, repeatSummary, stateLabel, stateTone } from '../../domain/presentation';
import { deviceZone } from '../../domain/time';
import { ActionFeedback, BottomActionBar, Button, Copy, DateField, Disclosure, formatTime, Group, IconButton, Page, QueryState, SettingRow, Sheet, shortDate, shortDateTime, shortTime, Status } from '../../ui/components';
import { notify } from '../../ui/feedback';
import { engine, nativeAvailable, useCommand, useSettings } from '../../ui/native';
import { typography } from '../../ui/tokens';

const activity: Record<string, string> = { TimedOut: 'Alarm timed out', UndoDelete: 'Restored', Delete: 'Moved to Trash', Reopen: 'Reopened', Done: 'Completed',
  Stop: 'Alarm stopped', StopAll: 'Ringing stopped', Snooze: 'Snoozed', Postpone: 'Postponed', Skip: 'Occurrence skipped', Edit: 'Edited', Create: 'Created',
  Interrupted: 'Alarm interrupted', Failed: 'Alarm failed', Missed: 'Alarm missed', Notified: 'Notification sent', PauseSeries: 'Repeat paused', ResumeSeries: 'Repeat resumed' };
type Feedback = { message: string; tone: Tone };
export default function ReminderDetails() {
  const { id, action } = useLocalSearchParams<{ id: string; action?: string }>();
  const query = useQuery({ queryKey: ['occurrence', id], queryFn: () => engine().getOccurrence(id), enabled: nativeAvailable });
  const item = query.data, settings = useSettings(), command = useCommand();
  const itemId = item?.id, segmentId = item?.segmentId;
  const series = useQuery({ queryKey: ['series', item?.segmentId], queryFn: () => engine().getSeries(item!.segmentId!), enabled: nativeAvailable && !!item?.segmentId });
  const [postpone, setPostpone] = useState(action === 'postpone'), [scope, setScope] = useState(action === 'edit'), [menu, setMenu] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [target, setTarget] = useState(() => Date.now() + 900_000), [feedback, setFeedback] = useState<Feedback | null>(null), [sheetFeedback, setSheetFeedback] = useState<Feedback | null>(null);
  useEffect(() => { if (action !== 'edit' || !itemId) return;
    if (!segmentId) router.replace({ pathname: '/edit', params: { id: itemId } });
  }, [action, itemId, segmentId]);
  useEffect(() => { if (!postpone) return; const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick); }, [postpone]);
  const content = async (kind: ContentCommand['kind']) => { if (!item) return; setFeedback(null); try {
    const result = await command.mutateAsync({ kind, occurrenceId: id, expectedRevision: item.revision, operationId: engine().createOperationId() });
    const next = commandFeedback(result, activity[kind] ?? 'Reminder updated');
    if (kind === 'Delete') { notify({ ...next, persistent: next.tone !== 'success' }); if (router.canGoBack()) router.back(); else router.replace('/'); }
    else setFeedback(next);
  } catch (error) { setFeedback({ message: error instanceof Error ? error.message : 'Could not update reminder.', tone: 'danger' }); } };
  const delivery = async (kind: DeliveryCommand['kind'], alarmAtMs?: number) => { if (!item) return; setFeedback(null); setSheetFeedback(null); try {
    const result = await command.mutateAsync({ kind, occurrenceId: id, expectedGeneration: item.generation, alarmAtMs, operationId: engine().createOperationId() });
    const next = commandFeedback(result, kind === 'Stop' ? 'Alarm stopped. Reminder remains open.' : kind === 'Postpone' ? 'Next alert postponed to ' + shortDateTime(alarmAtMs!) : 'Next alert snoozed');
    setFeedback(next);
    // A blocked/pending saved target remains visible in the sheet until the owner dismisses it.
    if (result.status === 'Blocked' || result.status === 'Pending') setSheetFeedback(next); else setPostpone(false);
  } catch (error) { const next: Feedback = { message: error instanceof Error ? error.message : 'Could not update alert.', tone: 'danger' }; setFeedback(next); setSheetFeedback(next); } };
  const edit = () => { setMenu(false); if (item?.segmentId) setScope(true); else router.push({ pathname: '/edit', params: { id } }); };
  const openPostpone = () => { const current = Date.now(); setNow(current); setTarget(current + 900_000); setSheetFeedback(null); setPostpone(true); };
  const tomorrow = (minutes: number) => { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); setTarget(date.getTime()); setSheetFeedback(null); };
  const active = item && !item.deleted && !item.completed && !item.skipped;
  const zone = item?.zoneId || deviceZone(), nextAlert = item ? nextAlertTime(item) : null;
  const nextZone = item && nextAlert === item.alarmAtMs ? zone : deviceZone();
  return <Page title="Reminder" actions={item && !item.deleted ? <><IconButton icon="edit" label="Edit reminder" onPress={edit} />
    <IconButton icon="more_vert" label="Reminder actions" onPress={() => setMenu(true)} /></> : undefined}
    footer={active ? <BottomActionBar>
      {item.deliveryState === 'Alerting' && <View style={{ width: '100%' }}><Button icon="stop" label="Stop alarm" variant="danger" disabled={command.isPending} onPress={() => void delivery('Stop')} /></View>}
      <View style={{ flexGrow: 1, flexBasis: 120 }}><Button icon="check" label="Done" disabled={command.isPending} onPress={() => void content('Done')} /></View>
      {item.mode !== 'None' && item.deliveryState !== 'Paused' && <View style={{ flexGrow: 1, flexBasis: 120 }}><Button icon="snooze" label="Postpone" variant="secondary" disabled={command.isPending} onPress={openPostpone} /></View>}
    </BottomActionBar> : undefined}>
    <QueryState loading={query.isLoading && nativeAvailable} error={query.error} empty={!item && !query.isLoading} emptyMessage="This reminder is unavailable." onRetry={() => void query.refetch()} />
    {item && <>
      <Copy size={typography.title}>{item.title}</Copy>
      <Group><View style={{ padding: 16, gap: 8 }}>
        <Copy>{item.allDay ? shortDate(item.eventStartMs, zone) + ' · All day' : shortDateTime(item.eventStartMs, zone)}</Copy>
        {(!item.dueLinked || !item.allDay && item.dueAtMs !== item.eventStartMs) && <Copy muted size={typography.supporting}>Due {shortDateTime(item.dueAtMs, zone)}</Copy>}
        {item.overdue && <Status label="Overdue" tone="danger" />}
        {!!stateLabel(item) && <Status label={stateLabel(item)} tone={stateTone(item)} />}
        {item.mode !== 'None' && active && <Copy muted size={typography.supporting}>Next alert: {nextAlert == null ? 'None scheduled' : shortDateTime(nextAlert, nextZone)}</Copy>}
        <Copy muted size={typography.label}>{zone.replace(/_/g, ' ')}</Copy>
      </View></Group>
      {!!item.notes && <View style={{ gap: 8 }}><Copy muted size={typography.label}>NOTES</Copy><Copy>{item.notes}</Copy></View>}
      {!!item.listName && <Copy muted size={typography.supporting}>List · {item.listName}</Copy>}
      {feedback && <ActionFeedback {...feedback} />}
      {command.isPending && <ActionFeedback loading message="Applying change…" />}
      {item.segmentId && <Disclosure title={'Repeat · ' + (repeatSummary(item) ?? 'Repeating')}>
        <QueryState loading={series.isLoading} error={series.error} onRetry={() => void series.refetch()} />
        {series.data && <>
          <Copy size={typography.supporting}>{series.data.state === 'Archived' ? 'Previous schedule' : series.data.exhausted ? 'Repeat ended' : series.data.state === 'Paused' ? 'Paused' : 'Active'}{item.exception ? ' · This occurrence has an individual change.' : ''}</Copy>
          {series.data.upcoming.slice(0, 3).map((slot) => <Copy key={slot.nominalSlot} size={typography.supporting}>{series.data?.state === 'Paused' ? 'Planned: ' : 'Next: '}{shortDateTime(slot.eventStartMs, series.data!.rule.zoneId ?? deviceZone())}</Copy>)}
          <SettingRow label={series.data.state === 'Archived' ? 'Edit this occurrence' : 'Edit repeating reminder'} icon="edit" onPress={() => setScope(true)} />
          {series.data.state !== 'Archived' && !series.data.exhausted && <SettingRow icon={series.data.state === 'Paused' ? 'play_arrow' : 'pause'}
            label={series.data.state === 'Paused' ? 'Resume repeat' : 'Pause repeat'} disabled={command.isPending} onPress={() => {
              setFeedback(null); void command.mutateAsync({ kind: series.data!.state === 'Paused' ? 'ResumeSeries' : 'PauseSeries', segmentId: item.segmentId!, expectedRevision: series.data!.revision, operationId: engine().createOperationId() })
                .then((result) => setFeedback(commandFeedback(result, series.data!.state === 'Paused' ? 'Repeat resumed' : 'Repeat paused')))
                .catch((error: Error) => setFeedback({ message: error.message, tone: 'danger' }));
            }} />}
        </>}
        <SettingRow label="Repeat details and ending" onPress={() => router.push({ pathname: '/series/[id]', params: { id: item.segmentId! } })} />
      </Disclosure>}
      <Disclosure title="Timing">
        <Copy size={typography.supporting}>Event: {formatTime(item.eventStartMs, zone)}</Copy>
        {!item.allDay && <Copy size={typography.supporting}>Ends: {formatTime(item.eventEndMs, zone)}</Copy>}
        <Copy size={typography.supporting}>Due: {formatTime(item.dueAtMs, zone)}{item.allDay && item.dueLinked ? ' · end of event day' : ''}</Copy>
        <Copy size={typography.supporting}>Original alert: {item.mode === 'None' ? 'No alert' : formatTime(item.alarmAtMs, zone)}</Copy>
        <Copy size={typography.supporting}>Next alert: {formatTime(nextAlert, nextZone)}</Copy>
      </Disclosure>
      {item.completed && !item.deleted && <Button label="Reopen reminder" variant="secondary" disabled={command.isPending} onPress={() => void content('Reopen')} />}
      {item.deleted && <Button label="Restore reminder" disabled={command.isPending} onPress={() => void content('UndoDelete')} />}
      <Disclosure title="Activity">{item.history?.length ? [...item.history].reverse().map((entry, index) => <View key={index} style={{ gap: 4 }}>
        <Copy size={typography.supporting}>{activity[entry.kind] ?? entry.kind} · {shortDateTime(entry.atMs)}</Copy>
        {entry.targetMs != null && <Copy muted size={typography.label}>Alert {shortDateTime(entry.targetMs)}</Copy>}
      </View>) : <Copy muted>No actions yet.</Copy>}</Disclosure>
    </>}
    <Sheet title="Reminder actions" visible={menu} onClose={() => setMenu(false)}>
      <SettingRow icon="edit" label="Edit" onPress={edit} />
      <SettingRow icon="content_copy" label="Duplicate" onPress={() => { setMenu(false); router.push({ pathname: '/edit', params: { duplicate: id } }); }} />
      {active && item.mode !== 'None' && item.deliveryState !== 'Paused' && <SettingRow icon="snooze" label={'Snooze ' + (settings.data?.snoozeMinutes ?? 10) + ' minutes'} disabled={command.isPending} onPress={() => { setMenu(false); void delivery('Snooze'); }} />}
      {active && item.segmentId && <SettingRow label="Skip this occurrence" disabled={command.isPending} onPress={() => { setMenu(false); void content('Skip'); }} />}
      <SettingRow icon="delete" label="Move to Trash" disabled={command.isPending} onPress={() => { setMenu(false); Alert.alert('Move to Trash?', 'Its alert will be cancelled. You can restore it from Trash.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Move to Trash', style: 'destructive', onPress: () => void content('Delete') }]); }} />
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[15, 30, 60].map((minutes) => <Button key={minutes} label={minutes + ' min'} variant="secondary" disabled={command.isPending}
        onPress={() => { setTarget(Date.now() + minutes * 60_000); setSheetFeedback(null); }} />)}</View>
      {[settings.data?.tomorrowMorning ?? 600, settings.data?.tomorrowAfternoon ?? 840, settings.data?.tomorrowEvening ?? 1020].map((minutes, index) => {
        const date = new Date(); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        return <SettingRow key={index} label={'Tomorrow ' + shortTime(date.getTime())} disabled={command.isPending} onPress={() => tomorrow(minutes)} />;
      })}
      <DateField label="Custom time" value={target} disabled={command.isPending} onChange={(value) => { setTarget(value); setSheetFeedback(null); }} />
      <Copy>Next alert {formatTime(target)}</Copy><Copy muted size={typography.supporting}>{deviceZone().replace(/_/g, ' ')} · Event and due time stay unchanged. This replaces Snooze.</Copy>
      {target <= now && <Status label="Choose a future time." tone="danger" />}
      <Button label={command.isPending ? 'Postponing…' : 'Postpone'} disabled={command.isPending || target <= now} onPress={() => void delivery('Postpone', target)} />
      {sheetFeedback && <ActionFeedback {...sheetFeedback} />}
    </Sheet>
  </Page>;
}
