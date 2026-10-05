import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import type { ContentCommand, DeliveryCommand } from '../../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Card, Copy, DateField, formatTime, Heading, Page } from '../../ui/components';
import { engine, nativeAvailable, useCommand, useSettings } from '../../ui/native';

export default function ReminderDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: ['occurrence', id], queryFn: () => engine().getOccurrence(id), enabled: nativeAvailable });
  const settings = useSettings();
  const command = useCommand();
  const [postpone, setPostpone] = useState(false);
  const [target, setTarget] = useState(() => Date.now() + 900_000);
  const item = query.data;
  const content = (kind: ContentCommand['kind']) => item && command.mutate({ kind, occurrenceId: id,
    expectedRevision: item.revision, operationId: engine().createOperationId() });
  const delivery = (kind: DeliveryCommand['kind'], alarmAtMs?: number) => item && command.mutate({ kind,
    occurrenceId: id, expectedGeneration: item.generation, alarmAtMs, operationId: engine().createOperationId() });
  const tomorrow = (minutes: number) => {
    const date = new Date();
    date.setDate(date.getDate() + 1); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    setTarget(date.getTime());
  };
  return <Page title={item?.title ?? 'Reminder'} subtitle={item?.listName || undefined}>
    {query.isLoading && <Copy>Loading…</Copy>}{query.error && <Copy>Could not load this reminder. Return and retry.</Copy>}
    {!query.isLoading && query.data === null && <Copy>This reminder is unavailable.</Copy>}
    {item && <>
      <Card><Heading>{item.completed ? 'Done' : item.deleted ? 'Deleted' : item.deliveryState}</Heading>
        {item.overdue && !item.deleted && <Copy>Overdue · unfinished</Copy>}
        <Copy>Event: {formatTime(item.eventStartMs)}{item.allDay ? ' · all day' : ` to ${formatTime(item.eventEndMs)}`}</Copy>
        <Copy>Due: {formatTime(item.dueAtMs)}{item.allDay && item.dueLinked ? ' · exclusive end of day' : ''}</Copy>
        <Copy>Original alert: {item.mode === 'None' ? 'No alert' : formatTime(item.alarmAtMs)}</Copy>
        {!item.completed && !item.deleted && item.mode !== 'None' && <Copy>Next alert: {formatTime(item.nextAlertMs)}</Copy>}
        {item.mode !== 'None' && <Copy muted>{item.mode === 'Alarm' ? 'Alarm' : 'Notification'} · {item.deliveryState}</Copy>}
        <Copy muted>Stop ends a delivery. Done completes the reminder.</Copy>
      </Card>
      {!!item.notes && <Card><Heading>Notes</Heading><Copy>{item.notes}</Copy></Card>}
      {!item.deleted && !item.completed && !item.skipped && <Card><Heading>Actions</Heading>
        <Button label="Mark Done" disabled={command.isPending} onPress={() => content('Done')} />
        {item.deliveryState === 'Alerting' && <Button label="Stop ringing" variant="secondary" disabled={command.isPending} onPress={() => delivery('Stop')} />}
        {item.mode !== 'None' && item.deliveryState !== 'Paused' && <>
          <Button label={`Snooze ${settings.data?.snoozeMinutes ?? 10} minutes`} variant="secondary" disabled={command.isPending}
            onPress={() => delivery('Snooze')} />
          <Button label={postpone ? 'Close postpone options' : 'Postpone alert'} variant="secondary" onPress={() => { setTarget(Date.now() + 900_000); setPostpone(!postpone); }} />
        </>}
        <Button label="Edit reminder" variant="secondary" onPress={() => router.push({ pathname: '/edit', params: { id } })} />
        {item.segmentId && <Button label="Skip this occurrence" variant="secondary" disabled={command.isPending} onPress={() => content('Skip')} />}
      </Card>}
      {item.segmentId && <Card><Heading>Repeating reminder</Heading>
        <Copy muted>Original nominal slot: {item.nominalSlot}. {item.exception ? 'This occurrence has an individual change.' : 'Follows its series definition.'}</Copy>
        <Button label="Manage series" variant="secondary" onPress={() => router.push({ pathname: '/series/[id]', params: { id: item.segmentId! } })} />
        {!item.skipped && <Button label="Edit this and following" variant="secondary" onPress={() => router.push({ pathname: '/edit',
          params: { segmentId: item.segmentId!, following: item.nominalSlot!, source: id } })} />}
      </Card>}
      {postpone && !item.completed && !item.deleted && <Card><Heading>Postpone this alert</Heading>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[15, 30, 60].map((minutes) =>
          <Button key={minutes} label={`${minutes} min`} variant="secondary" onPress={() => setTarget(Date.now() + minutes * 60_000)} />)}</View>
        {[settings.data?.tomorrowMorning ?? 600, settings.data?.tomorrowAfternoon ?? 840, settings.data?.tomorrowEvening ?? 1020].map((minutes, index) =>
          <Button key={index} label={`Tomorrow ${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`}
            variant="secondary" onPress={() => tomorrow(minutes)} />)}
        <DateField label="Resolved alert time" value={target} onChange={setTarget} />
        <Copy muted>The event and due time stay the same. This replaces any pending Snooze.</Copy>
        <Button label={`Postpone to ${formatTime(target)}`} disabled={command.isPending} onPress={() => {
          if (target <= Date.now()) { Alert.alert('Choose a future time'); return; }
          delivery('Postpone', target); setPostpone(false);
        }} />
      </Card>}
      {item.completed && !item.deleted && <Button label="Reopen reminder" variant="secondary" disabled={command.isPending} onPress={() => content('Reopen')} />}
      {item.deleted ? <Button label="Undo deletion" onPress={() => content('UndoDelete')} disabled={command.isPending} /> : <>
        <Button label="Duplicate as a new reminder" variant="secondary" onPress={() => router.push({ pathname: '/edit', params: { duplicate: id } })} />
        <Button label="Delete reminder" variant="danger" disabled={command.isPending} onPress={() =>
          Alert.alert('Delete this reminder?', 'Its alert will be cancelled. You can undo this from Deleted.',
            [{ text: 'Keep', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => content('Delete') }])} />
      </>}
      <Card><Heading>History</Heading>{item.history?.length ? [...item.history].reverse().map((entry, index) =>
        <View key={index}><Copy>{entry.kind} · {formatTime(entry.atMs)}</Copy>
          {entry.targetMs != null && <Copy muted>Alert target: {formatTime(entry.targetMs)}</Copy>}
        </View>) : <Copy muted>No actions recorded yet.</Copy>}</Card>
    </>}
    {command.error && <Copy>{command.error.message}</Copy>}
  </Page>;
}
