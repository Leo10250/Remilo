import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import type { ContentCommand, DeliveryCommand } from '../../../modules/remilo-alarm/src/RemiloAlarm.types';
import { nextAlertTime, stateLabel } from '../../domain/presentation';
import { Button, Copy, DateField, Disclosure, formatTime, Group, IconButton, Page, SettingRow, Sheet, shortDateTime, shortTime, Status } from '../../ui/components';
import { engine, nativeAvailable, useCommand, useSettings } from '../../ui/native';
export default function ReminderDetails() {
  const { id, action } = useLocalSearchParams<{ id: string; action?: string }>();
  const query = useQuery({ queryKey: ['occurrence', id], queryFn: () => engine().getOccurrence(id), enabled: nativeAvailable });
  const item = query.data, settings = useSettings(), command = useCommand();
  const series = useQuery({ queryKey: ['series', item?.segmentId], queryFn: () => engine().getSeries(item!.segmentId!), enabled: !!item?.segmentId });
  const [postpone, setPostpone] = useState(action === 'postpone'), [scope, setScope] = useState(action === 'edit');
  const [menu, setMenu] = useState(false), [target, setTarget] = useState(() => Date.now() + 900_000), [message, setMessage] = useState('');
  const content = async (kind: ContentCommand['kind']) => { if (!item) return; try {
    await command.mutateAsync({ kind, occurrenceId: id, expectedRevision: item.revision, operationId: engine().createOperationId() });
    if (kind === 'Delete') { if (router.canGoBack()) router.back(); else router.replace('/'); }
  } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update reminder.'); } };
  const delivery = async (kind: DeliveryCommand['kind'], alarmAtMs?: number) => { if (!item) return; try {
    await command.mutateAsync({ kind, occurrenceId: id, expectedGeneration: item.generation, alarmAtMs, operationId: engine().createOperationId() });
    setPostpone(false);
  } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update alarm.'); } };
  const edit = () => { setMenu(false); if (item?.segmentId) setScope(true); else router.push({ pathname: '/edit', params: { id } }); };
  const tomorrow = (minutes: number) => { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); setTarget(date.getTime()); };
  const active = item && !item.deleted && !item.completed && !item.skipped;
  return <Page title="Reminder" actions={item && !item.deleted ? <IconButton icon="more_vert" label="Reminder actions" onPress={() => setMenu(true)} /> : undefined}>
    {query.isLoading && <Copy>Loading…</Copy>}{query.error && <Button label="Retry" onPress={() => void query.refetch()} />}
    {!query.isLoading && !item && <Copy>This reminder is unavailable.</Copy>}
    {item && <>
      <Copy size={26}>{item.title}</Copy><Copy>{formatTime(item.eventStartMs)}{item.allDay ? ' · All day' : ''}</Copy>
      {item.overdue && <Status label="Overdue" tone="danger" />}
      {!!stateLabel(item) && <Status label={stateLabel(item)} tone={item.completed ? 'success' : 'warning'} />}
      {item.mode !== 'None' && !item.completed && !item.deleted && <Group><SettingRow icon="alarm" label="Next alarm" value={nextAlertTime(item) == null ? 'None scheduled' : shortDateTime(nextAlertTime(item)!)} /></Group>}
      {active && <View style={{ gap: 10 }}>
        <Button label="Done" disabled={command.isPending} onPress={() => void content('Done')} />
        {item.deliveryState === 'Alerting' && <Button label="Stop alarm" variant="secondary" disabled={command.isPending} onPress={() => void delivery('Stop')} />}
        {item.mode !== 'None' && item.deliveryState !== 'Paused' && <Button label="Postpone alarm" variant="secondary" onPress={() => { setTarget(Date.now() + 900_000); setPostpone(true); }} />}
      </View>}
      {!!item.notes && <Group title="Notes"><View style={{ padding: 14 }}><Copy>{item.notes}</Copy></View></Group>}
      {!!item.listName && <Copy muted size={14}>List · {item.listName}</Copy>}
      <Disclosure title="Timing">
        <Copy size={14}>Event: {formatTime(item.eventStartMs)}</Copy>
        {!item.allDay && <Copy size={14}>Ends: {formatTime(item.eventEndMs)}</Copy>}
        <Copy size={14}>Due: {formatTime(item.dueAtMs)}{item.allDay && item.dueLinked ? ' · end of event day' : ''}</Copy>
        <Copy size={14}>Original alarm: {item.mode === 'None' ? 'No alert' : formatTime(item.alarmAtMs)}</Copy>
        <Copy size={14}>Next alarm: {formatTime(nextAlertTime(item))}</Copy>
      </Disclosure>
      {item.segmentId && <Disclosure title={'Repeat · ' + (item.repeatSummary ?? 'Repeating')}>
        <Copy size={14}>{series.data?.state === 'Archived' ? 'Previous series segment' : series.data?.exhausted ? 'Repeat ended' : series.data?.state === 'Paused' ? 'Paused' : 'Active'}{item.exception ? ' · This occurrence has an individual change.' : ''}</Copy>
        {series.data?.upcoming.slice(0, 3).map((slot) => <Copy key={slot.nominalSlot} size={14}>{formatTime(slot.eventStartMs)}</Copy>)}
        <SettingRow label={series.data?.state === 'Archived' ? 'Edit this occurrence' : 'Edit repeating reminder'} icon="edit" onPress={() => setScope(true)} />
        {series.data && series.data.state !== 'Archived' && <SettingRow icon={series.data.state === 'Paused' ? 'play_arrow' : 'pause'}
          label={series.data.state === 'Paused' ? 'Resume repeat' : 'Pause repeat'} disabled={command.isPending} onPress={() => command.mutate({
            kind: series.data!.state === 'Paused' ? 'ResumeSeries' : 'PauseSeries', segmentId: item.segmentId!, expectedRevision: series.data!.revision, operationId: engine().createOperationId() })} />}
        <SettingRow label="Repeat details and ending" onPress={() => router.push({ pathname: '/series/[id]', params: { id: item.segmentId! } })} />
      </Disclosure>}
      {item.completed && !item.deleted && <Button label="Reopen reminder" variant="secondary" disabled={command.isPending} onPress={() => void content('Reopen')} />}
      {item.deleted && <Button label="Restore reminder" disabled={command.isPending} onPress={() => void content('UndoDelete')} />}
      <Disclosure title="Activity">{item.history?.length ? [...item.history].reverse().map((entry, index) => <View key={index} style={{ gap: 2 }}>
        <Copy size={14}>{({ TimedOut: 'Alarm timed out', UndoDelete: 'Restored', Done: 'Completed', Stop: 'Alarm stopped', Snooze: 'Snoozed', Postpone: 'Postponed' } as Record<string, string>)[entry.kind] ?? entry.kind} · {formatTime(entry.atMs)}</Copy>
        {entry.targetMs != null && <Copy muted size={13}>Alarm {formatTime(entry.targetMs)}</Copy>}
      </View>) : <Copy muted>No actions yet.</Copy>}</Disclosure>
    </>}
    {!!message && <Status label={message} tone="danger" />}{command.error && <Status label={command.error.message} tone="danger" />}
    <Sheet title="Reminder actions" visible={menu} onClose={() => setMenu(false)}>
      <SettingRow icon="edit" label="Edit" onPress={edit} />
      <SettingRow icon="content_copy" label="Duplicate" onPress={() => { setMenu(false); router.push({ pathname: '/edit', params: { duplicate: id } }); }} />
      {active && item?.mode !== 'None' && item?.deliveryState !== 'Paused' && <SettingRow icon="snooze" label={'Snooze ' + (settings.data?.snoozeMinutes ?? 10) + ' minutes'}
        onPress={() => { setMenu(false); void delivery('Snooze'); }} />}
      {active && item?.segmentId && <SettingRow label="Skip this occurrence" onPress={() => { setMenu(false); void content('Skip'); }} />}
      <SettingRow icon="delete" label="Move to Trash" onPress={() => { setMenu(false); Alert.alert('Move to Trash?', 'Its alarm will be cancelled. You can restore it from Trash.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Move to Trash', style: 'destructive', onPress: () => void content('Delete') }]); }} />
    </Sheet>
    <Sheet title="Edit reminder" visible={scope} onClose={() => setScope(false)}>
      <SettingRow label={item?.segmentId ? 'This occurrence' : 'This reminder'} onPress={() => { setScope(false); router.push({ pathname: '/edit', params: { id } }); }} />
      {item?.segmentId && series.data?.state !== 'Archived' && <>
        <SettingRow label="This and following" onPress={() => { setScope(false); router.push({ pathname: '/edit', params: { segmentId: item.segmentId!, following: item.nominalSlot! } }); }} />
        <SettingRow label="Entire series" onPress={() => { setScope(false); router.push({ pathname: '/edit', params: { segmentId: item.segmentId! } }); }} />
      </>}
      {series.data?.state === 'Archived' && <Copy muted size={13}>This occurrence belongs to a previous schedule. Open a current occurrence in the agenda to edit the current series.</Copy>}
    </Sheet>
    <Sheet title="Postpone alarm" visible={postpone} onClose={() => setPostpone(false)}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[15, 30, 60].map((minutes) => <Button key={minutes} label={minutes + ' min'} variant="secondary" onPress={() => setTarget(Date.now() + minutes * 60_000)} />)}</View>
      {[settings.data?.tomorrowMorning ?? 600, settings.data?.tomorrowAfternoon ?? 840, settings.data?.tomorrowEvening ?? 1020].map((minutes, index) => {
        const date = new Date(); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        return <SettingRow key={index} label={'Tomorrow ' + shortTime(date.getTime())} onPress={() => tomorrow(minutes)} />;
      })}
      <DateField label="Custom time" value={target} onChange={setTarget} />
      <Copy>Alarm {formatTime(target)}</Copy><Copy muted size={13}>Event and due time stay unchanged. This replaces Snooze.</Copy>
      <Button label="Postpone" disabled={command.isPending} onPress={() => void delivery('Postpone', target)} />
      {!!message && <Status label={message} tone="danger" />}
    </Sheet>
  </Page>;
}
