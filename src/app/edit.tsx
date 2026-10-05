import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import type { Occurrence, ReminderDraft } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Card, Copy, DateField, Field, formatTime, Heading, Page, Toggle } from '../ui/components';
import { engine, nativeAvailable, useCommand, useSettings } from '../ui/native';

type EditorDraft = ReminderDraft & { eventStartMs: number; eventEndMs: number; dueAtMs: number; alarmAtMs: number };
function emptyDraft(): EditorDraft {
  const start = Date.now() + 600_000;
  return { title: '', notes: '', listName: '', eventStartMs: start, eventEndMs: start + 1_800_000,
    dueAtMs: start, alarmAtMs: start, mode: 'Alarm', allDay: false, dueLinked: true, alarmLinked: true };
}
export default function Editor() {
  const params = useLocalSearchParams<{ id?: string; duplicate?: string }>();
  const id = params.id ?? params.duplicate;
  const existing = useQuery({ queryKey: ['occurrence', id], queryFn: () => engine().getOccurrence(id!), enabled: !!id && nativeAvailable });
  if (id && existing.isLoading) return <Page title="Edit reminder"><Copy>Loading…</Copy></Page>;
  if (id && !existing.data) return <Page title="Edit reminder"><Copy>Could not load this reminder. Go back and retry.</Copy></Page>;
  return <EditorForm key={id ?? 'new'} record={existing.data ?? undefined} id={params.id} duplicate={!!params.duplicate} />;
}
function EditorForm({ record, id, duplicate }: { record?: Occurrence; id?: string; duplicate: boolean }) {
  const settings = useSettings();
  const command = useCommand();
  const [draft, setDraft] = useState<EditorDraft>(() => record ? {
    title: duplicate ? `${record.title.slice(0, 193)} (copy)` : record.title,
    notes: record.notes, listName: record.listName, eventStartMs: record.eventStartMs,
    eventEndMs: record.eventEndMs, dueAtMs: record.dueAtMs, alarmAtMs: record.alarmAtMs,
    mode: record.mode, allDay: record.allDay, dueLinked: record.dueLinked, alarmLinked: record.alarmLinked,
    zoneId: record.zoneId, sound: record.sound, vibration: record.vibration,
  } : emptyDraft());
  const [advanced, setAdvanced] = useState(!!record);
  const [message, setMessage] = useState('');
  const [loadedRevision] = useState(record?.revision ?? null);
  const patch = (value: Partial<EditorDraft>) => setDraft((current) => ({ ...current, ...value }));
  const moveEvent = (value: number) => setDraft((current) => {
    const delta = value - current.eventStartMs;
    const due = current.dueLinked ? current.dueAtMs + delta : current.dueAtMs;
    return { ...current, eventStartMs: value, eventEndMs: current.eventEndMs + delta,
      dueAtMs: due, alarmAtMs: current.alarmLinked ? current.alarmAtMs + due - current.dueAtMs : current.alarmAtMs };
  });
  const payload = Object.fromEntries(Object.entries({ ...draft,
    ...(draft.allDay && draft.dueLinked ? { dueAtMs: undefined } : {}),
    ...(draft.allDay && draft.alarmLinked ? { alarmAtMs: undefined } : {}) })
    .filter(([, value]) => value !== undefined)) as ReminderDraft;
  // Native preview is authoritative; local draft arithmetic only assists editing.
  const preview = useQuery({ queryKey: ['schedule-preview', payload],
    queryFn: () => engine().previewSchedule(payload), enabled: nativeAvailable && !!draft.title.trim() });
  const save = async () => {
    setMessage('');
    try {
      const resolved = await engine().previewSchedule(payload);
      if (resolved.warnings.length && draft.mode !== 'None') { setMessage(resolved.warnings.join('\n')); return; }
      const result = await command.mutateAsync(id ? { ...payload, kind: 'Edit',
        occurrenceId: id, expectedRevision: loadedRevision!, operationId: engine().createOperationId() }
        : { ...payload, kind: 'Create', operationId: engine().createOperationId() });
      if (result.status === 'Blocked') Alert.alert('Saved; alert blocked', 'Review alarm readiness to enable delivery.');
      if (result.occurrence) router.replace({ pathname: '/reminder/[id]', params: { id: result.occurrence.id } });
      else router.replace('/');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save. Try again.'); }
  };
  return <Page title={id ? 'Edit reminder' : 'New reminder'} subtitle="Give the reminder a time. Keep the details as simple as you like.">
    {record && record.revision !== loadedRevision && loadedRevision !== null &&
      <Card><Copy>This reminder changed while you were editing. Go back and reload before saving.</Copy></Card>}
    <Card><Field label="Title" value={draft.title} onChangeText={(title) => patch({ title })} maxLength={200}
      placeholder="What do you want to remember?" autoFocus={!id} />
      {!advanced && <><Heading>When?</Heading><DateField label="Alert time" value={draft.alarmAtMs} onChange={moveEvent} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[10, 30, 60].map((minutes) =>
          <Button key={minutes} label={`In ${minutes} min`} variant="secondary" onPress={() => moveEvent(Date.now() + minutes * 60_000)} />)}</View></>}
      <Button label={advanced ? 'Hide advanced timing' : 'Event, due time and more'} variant="secondary" onPress={() => setAdvanced(!advanced)} />
    </Card>
    {advanced && <>
      <Card><Heading>Timing</Heading><Toggle label="All-day reminder" value={draft.allDay ?? false}
        onChange={(allDay) => patch({ allDay, dueLinked: true, alarmLinked: true })} />
        <DateField label={draft.allDay ? 'Event day' : 'Event starts'} value={draft.eventStartMs} onChange={moveEvent} dateOnly={draft.allDay} />
        {!draft.allDay && <DateField label="Event ends" value={draft.eventEndMs} onChange={(eventEndMs) => patch({ eventEndMs })} />}
        <Toggle label={draft.allDay ? 'Due at the end of this day' : 'Move due time with the event'} value={draft.dueLinked ?? true}
          onChange={(dueLinked) => patch({ dueLinked })} />
        {!draft.dueLinked && <DateField label="Due time" value={draft.dueAtMs} onChange={(dueAtMs) => patch({ dueAtMs,
          alarmAtMs: draft.alarmLinked ? draft.alarmAtMs + dueAtMs - draft.dueAtMs : draft.alarmAtMs })} />}
        <Toggle label={draft.allDay ? 'Alert at 9 AM on the event day' : 'Move alert time with due time'} value={draft.alarmLinked ?? true}
          onChange={(alarmLinked) => patch({ alarmLinked })} />
        {!draft.alarmLinked && <DateField label="Independent alert time" value={draft.alarmAtMs} onChange={(alarmAtMs) => patch({ alarmAtMs })} />}
        <Copy muted>Postponing an alert later keeps these original event and due times.</Copy>
      </Card>
      <Card><Heading>Alert</Heading>{(['Alarm', 'Notification', 'None'] as const).map((mode) =>
        <Button key={mode} label={`${draft.mode === mode ? '✓ ' : ''}${mode === 'None' ? 'No alert' : mode}`}
          variant={draft.mode === mode ? 'primary' : 'secondary'} onPress={() => patch({ mode })} />)}
        <Copy muted>{draft.mode === 'Alarm' ? 'Rings for up to five minutes. Stop leaves it unfinished.'
          : draft.mode === 'Notification' ? 'One system notification. Without exact access, delivery may be delayed; alerts over five minutes late become Missed.' : 'Track the due time without a scheduled alert.'}</Copy>
        {draft.mode === 'Alarm' && <><Button label={`Tone: ${(draft.sound ?? settings.data?.sound) === 'system' ? 'System alarm' : 'Remilo'}`}
          variant="secondary" onPress={() => patch({ sound: (draft.sound ?? settings.data?.sound ?? 'remilo') === 'system' ? 'remilo' : 'system' })} />
          <Toggle label="Vibrate while ringing" value={draft.vibration ?? settings.data?.vibration ?? true} onChange={(vibration) => patch({ vibration })} /></>}
      </Card>
      <Card><Heading>Details</Heading><Field label="Notes" multiline value={draft.notes} onChangeText={(notes) => patch({ notes })} maxLength={10_000} />
        <Field label="List (optional)" value={draft.listName} onChangeText={(listName) => patch({ listName })} maxLength={60} placeholder="Personal, Work…" />
      </Card>
    </>}
    {preview.data && <Card><Heading>Preview</Heading><Copy>Event: {formatTime(preview.data.eventStartMs)}</Copy>
      <Copy>Due: {formatTime(preview.data.dueAtMs)}{draft.allDay && draft.dueLinked ? ' (exclusive end of day)' : ''}</Copy>
      <Copy>{draft.mode === 'None' ? 'No alert' : `Alert: ${formatTime(preview.data.alarmAtMs)}`}</Copy>
      {preview.data.warnings.map((warning) => <Copy key={warning}>{warning}</Copy>)}
    </Card>}
    {(message || command.error) && <Copy>{message || command.error?.message}</Copy>}
    <Button label={command.isPending ? 'Saving…' : 'Save reminder'} onPress={() => void save()}
      disabled={!nativeAvailable || command.isPending || !draft.title.trim() || (!!id && loadedRevision === null)} />
  </Page>;
}
