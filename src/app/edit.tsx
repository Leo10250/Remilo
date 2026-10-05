import { useQuery } from '@tanstack/react-query';
import { usePreventRemove } from 'expo-router/react-navigation';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { Command, CommandResult, ReminderDraft, RecurrenceDraft, Series } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Copy, DateField, Disclosure, Field, formatTime, Group, Page, SelectRow, Status, Toggle } from '../ui/components';
import { CommandError, engine, nativeAvailable, useCommand, useSettings } from '../ui/native';
import { RepeatForm } from '../ui/recurrence';
import { useTheme } from '../ui/theme';
type EditorDraft = ReminderDraft & { eventStartMs: number; eventEndMs: number; dueAtMs: number; alarmAtMs: number };
function emptyDraft(): EditorDraft {
  const start = Date.now() + 600_000;
  return { title: '', notes: '', listName: '', eventStartMs: start, eventEndMs: start + 1_800_000,
    dueAtMs: start, alarmAtMs: start, mode: 'Alarm', allDay: false, dueLinked: true, alarmLinked: true };
}
export default function Editor() {
  const params = useLocalSearchParams<{ id?: string; duplicate?: string; segmentId?: string; following?: string }>();
  const id = params.id ?? params.duplicate;
  const existing = useQuery({ queryKey: ['occurrence', id], queryFn: () => engine().getOccurrence(id!), enabled: !!id && nativeAvailable });
  const series = useQuery({ queryKey: ['series', params.segmentId], queryFn: () => engine().getSeries(params.segmentId!), enabled: !!params.segmentId && nativeAvailable });
  const source = useQuery({ queryKey: ['series-draft', params.segmentId, params.following], queryFn: () => engine().getSeriesDraft(params.segmentId!, params.following!), enabled: !!params.following && !!params.segmentId && nativeAvailable });
  if (params.segmentId && (series.isLoading || (!!params.following && source.isLoading)) || id && existing.isLoading) return <Page title="Edit reminder"><Copy>Loading…</Copy></Page>;
  if (params.segmentId && !series.data || params.following && !source.data || id && !existing.data) return <Page title="Edit reminder"><Copy>Could not load this reminder. Return and retry.</Copy></Page>;
  return <EditorForm key={id ?? params.segmentId ?? 'new'} record={existing.data ?? source.data?.template ?? series.data?.template ?? undefined}
    id={params.id} duplicate={!!params.duplicate} series={series.data ?? undefined} following={params.following} remainingCount={source.data?.remainingCount} />;
}
function EditorForm({ record, id, duplicate, series, following, remainingCount }: {
  record?: ReminderDraft & { revision?: number }; id?: string; duplicate: boolean; series?: Series; following?: string; remainingCount?: number | null;
}) {
  const settings = useSettings(), command = useCommand(), navigation = useNavigation(), colors = useTheme();
  const [draft, setDraft] = useState<EditorDraft>(() => record ? { ...record, title: duplicate ? record.title.slice(0, 193) + ' (copy)' : record.title,
    eventStartMs: record.eventStartMs!, eventEndMs: record.eventEndMs!, dueAtMs: record.dueAtMs!, alarmAtMs: record.alarmAtMs! } : emptyDraft());
  const [message, setMessage] = useState(''), [fieldError, setFieldError] = useState<string | undefined>();
  const pendingSave = useRef<Command | null>(null);
  const [retrySave, setRetrySave] = useState(false), [saved, setSaved] = useState<CommandResult | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [loadedRevision] = useState(record?.revision ?? null), [seriesRevision] = useState(series?.revision);
  const [recurrence, setRecurrence] = useState<RecurrenceDraft | undefined>(() => series ? { ...series.rule,
    zoneMode: series.rule.zoneId ? 'pinned' : 'floating', count: following ? remainingCount ?? undefined : series.rule.count ?? undefined,
    until: series.rule.until ?? undefined } : undefined);
  const [baseline] = useState(() => JSON.stringify({ draft, recurrence }));
  const dirty = JSON.stringify({ draft, recurrence }) !== baseline;
  usePreventRemove(!saved && (dirty || retrySave || command.isPending || preparing), ({ data }) => {
    if (retrySave || command.isPending || preparing) { Alert.alert('Save not yet confirmed', 'Retry or wait for this save before leaving.'); return; }
    Alert.alert('Discard changes?', 'Your reminder has not been saved.', [{ text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) }]);
  });
  useEffect(() => {
    if (!saved) return;
    if (saved.status === 'Blocked' || saved.status === 'Pending') Alert.alert(saved.status === 'Blocked' ? 'Saved; alarm blocked' : 'Saved; scheduling pending',
      saved.status === 'Blocked' ? 'Open Settings to allow alarms.' : 'The reminder is saved. Return to check scheduling.');
    if (saved.segmentId) router.replace({ pathname: '/series/[id]', params: { id: saved.segmentId } });
    else if (saved.occurrence) router.replace({ pathname: '/reminder/[id]', params: { id: saved.occurrence.id } });
    else router.replace('/');
  }, [saved]);
  const patch = (value: Partial<EditorDraft>) => { if (!pendingSave.current) setDraft((current) => ({ ...current, ...value })); };
  const moveEvent = (value: number) => setDraft((current) => {
    if (pendingSave.current) return current;
    const delta = value - current.eventStartMs, due = current.dueLinked ? current.dueAtMs + delta : current.dueAtMs;
    return { ...current, eventStartMs: value, eventEndMs: current.eventEndMs + delta, dueAtMs: due,
      alarmAtMs: current.alarmLinked ? current.alarmAtMs + due - current.dueAtMs : current.alarmAtMs };
  });
  const payload = Object.fromEntries(Object.entries({ ...draft,
    ...(recurrence ? { recurrence: Object.fromEntries(Object.entries(recurrence).filter(([, value]) => value != null)) } : {}),
    ...(draft.allDay && draft.dueLinked ? { dueAtMs: undefined } : {}), ...(draft.allDay && draft.alarmLinked ? { alarmAtMs: undefined } : {}) })
    .filter(([, value]) => value !== undefined)) as ReminderDraft & { recurrence?: RecurrenceDraft };
  const preview = useQuery({ queryKey: ['schedule-preview', payload], queryFn: () => engine().previewSchedule(payload), enabled: nativeAvailable && !!draft.title.trim() });
  const save = async () => {
    if (preparing || command.isPending) return;
    setPreparing(true);
    setMessage(''); setFieldError(undefined);
    try {
      if (!pendingSave.current) {
        const resolved = preview.data;
        if (recurrence && resolved && !resolved.upcoming.length) { setMessage('Choose a repeat rule with future occurrences.'); setFieldError('recurrence'); return; }
        if (!id && !recurrence && resolved?.warnings.length && draft.mode !== 'None') { setMessage(resolved.warnings.join('\n')); setFieldError('alarmAtMs'); return; }
        // Preview is assistance. Apply supplies structured field errors even if a preview failed.
        if (series && !recurrence) { setMessage('Keep a repeat rule, or pause this series instead.'); setFieldError('recurrence'); return; }
        pendingSave.current = series && recurrence ? { ...payload, recurrence: payload.recurrence!,
          kind: following ? 'EditFollowing' : 'EditSeries', segmentId: series.id, expectedRevision: seriesRevision!,
          nominalSlot: following, operationId: engine().createOperationId() }
          : id ? { ...payload, kind: 'Edit', occurrenceId: id, expectedRevision: loadedRevision!, operationId: engine().createOperationId() }
          : recurrence ? { ...payload, recurrence: payload.recurrence!, kind: 'CreateSeries', operationId: engine().createOperationId() }
          : { ...payload, kind: 'Create', operationId: engine().createOperationId() };
      }
      const result = await command.mutateAsync(pendingSave.current);
      setRetrySave(false); setSaved(result);
    } catch (error) {
      if (error instanceof CommandError) { pendingSave.current = null; setRetrySave(false); setFieldError(error.field); }
      else setRetrySave(pendingSave.current !== null);
      setMessage(error instanceof Error ? error.message : 'Could not save. Try again.');
    } finally { setPreparing(false); }
  };
  const invalid = (fields: string[]) => fieldError && fields.includes(fieldError) ? message : undefined;
  return <Page title={series ? following ? 'Edit following' : 'Edit series' : id ? 'Edit reminder' : 'New reminder'}
    actions={<Pressable accessibilityRole="button" accessibilityLabel={retrySave ? 'Retry save' : 'Save reminder'}
      disabled={!nativeAvailable || command.isPending || preparing || !draft.title.trim()} onPress={() => void save()}
      style={{ minHeight: 48, paddingHorizontal: 16, justifyContent: 'center' }}>
      <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600', opacity: command.isPending || !draft.title.trim() ? 0.4 : 1 }}>{command.isPending ? 'Saving…' : retrySave ? 'Retry' : 'Save'}</Text>
    </Pressable>}>
    <View pointerEvents={preparing || command.isPending || retrySave ? 'none' : 'auto'} style={{ gap: 16 }}>
    <Field label="Title" placeholder="What do you want to remember?" autoFocus={!record} value={draft.title}
      editable={!command.isPending && !retrySave} onChangeText={(title) => patch({ title })} maxLength={200} error={invalid(['title'])} />
    <Group>
      <DateField label={draft.allDay ? 'Event day' : 'Event'} value={draft.eventStartMs} onChange={moveEvent} dateOnly={draft.allDay} />
      <SelectRow label="Alert" icon="alarm" value={draft.mode ?? 'Alarm'} choices={[{ value: 'Alarm', label: 'Alarm' }, { value: 'Notification', label: 'Notification' }, { value: 'None', label: 'No alert' }]}
        onChange={(mode) => patch({ mode })} />
      {draft.mode !== 'None' && <DateField label="Alarm time" value={preview.data?.alarmAtMs ?? draft.alarmAtMs}
        onChange={(alarmAtMs) => patch({ alarmAtMs, alarmLinked: false })} />}
      {invalid(['eventStartMs', 'eventEndMs', 'alarmAtMs']) && <Status label={message} tone="danger" />}
      {!id && <RepeatForm value={recurrence} onChange={(value) => { if (!pendingSave.current) setRecurrence(value); }}
        startMs={draft.eventStartMs} zoneId={draft.zoneId} setZone={(zoneId) => patch({ zoneId })} />}
      {invalid(['recurrence']) && <Status label={message} tone="danger" />}
    </Group>
    <View style={{ gap: 12 }}><Field label="List (optional)" value={draft.listName} onChangeText={(listName) => patch({ listName })} maxLength={60} error={invalid(['listName'])} />
      <Field label="Notes (optional)" value={draft.notes} onChangeText={(notes) => patch({ notes })} multiline maxLength={10_000} error={invalid(['notes'])} /></View>
    <Disclosure title="More timing options" forceOpen={!!invalid(['dueAtMs', 'zoneId', 'eventEndMs'])}>
      <Toggle label="All day" value={draft.allDay ?? false} onChange={(allDay) => patch({ allDay, dueLinked: true, alarmLinked: true })} />
      {!draft.allDay && <DateField label="Event ends" value={draft.eventEndMs} onChange={(eventEndMs) => patch({ eventEndMs })} />}
      <Toggle label="Due with the event" value={draft.dueLinked ?? true} onChange={(dueLinked) => {
        const dueAtMs = dueLinked ? draft.allDay ? preview.data?.eventEndMs ?? draft.eventEndMs : draft.eventStartMs : preview.data?.dueAtMs ?? draft.dueAtMs;
        patch({ dueLinked, dueAtMs, ...(dueLinked && draft.alarmLinked && !draft.allDay ? { alarmAtMs: dueAtMs } : {}) });
      }} />
      {!draft.dueLinked && <DateField label="Due" value={draft.dueAtMs} onChange={(dueAtMs) => patch({ dueAtMs,
        alarmAtMs: draft.alarmLinked ? draft.alarmAtMs + dueAtMs - draft.dueAtMs : draft.alarmAtMs })} />}
      <Toggle label={draft.allDay ? 'Alarm at 9 AM' : 'Alarm follows due time'} value={draft.alarmLinked ?? true} onChange={(alarmLinked) => patch({ alarmLinked,
        alarmAtMs: alarmLinked && !draft.allDay ? preview.data?.dueAtMs ?? draft.dueAtMs : preview.data?.alarmAtMs ?? draft.alarmAtMs })} />
      {!recurrence && <Field label="Time zone" value={draft.zoneId ?? Intl.DateTimeFormat().resolvedOptions().timeZone} onChangeText={(zoneId) => patch({ zoneId })} autoCapitalize="none" error={invalid(['zoneId'])} />}
      {draft.mode === 'Alarm' && <>
        <SelectRow label="Sound" value={draft.sound ?? settings.data?.sound ?? 'remilo'} choices={[{ value: 'remilo', label: 'Remilo' }, { value: 'system', label: 'System alarm' }]} onChange={(sound) => patch({ sound })} />
        <Toggle label="Vibration" value={draft.vibration ?? settings.data?.vibration ?? true} onChange={(vibration) => patch({ vibration })} />
      </>}
      {invalid(['dueAtMs', 'zoneId']) && <Status label={message} tone="danger" />}
    </Disclosure>
    {preview.data && <>
      <Copy muted size={14}>{draft.mode === 'None' ? 'No alarm' : 'Alarm ' + formatTime(preview.data.alarmAtMs)}</Copy>
      {recurrence && <Group title="Next dates">{preview.data.upcoming.map((slot) => <View key={slot.nominalSlot} style={{ padding: 12, gap: 3 }}>
        <Copy size={14}>{formatTime(slot.eventStartMs)}</Copy><Copy muted size={13}>{slot.adjusted ? 'Clock-change adjustment · ' : ''}Alarm {formatTime(slot.alarmAtMs)}</Copy>
      </View>)}{preview.data.upcoming.length < 3 && <Copy muted size={13}>Fewer than three occurrences remain.</Copy>}</Group>}
      <Disclosure title="Timing summary"><Copy size={14}>Event: {formatTime(preview.data.eventStartMs)}</Copy>
        <Copy size={14}>Due: {formatTime(preview.data.dueAtMs)}</Copy><Copy size={14}>Alarm: {draft.mode === 'None' ? 'None' : formatTime(preview.data.alarmAtMs)}</Copy>
        {preview.data.warnings.map((warning) => <Copy muted size={13} key={warning}>{warning}</Copy>)}</Disclosure>
    </>}
    {series && <Copy muted size={13}>Earlier unfinished and postponed occurrences are retained. {series.state === 'Paused' ? 'The series remains paused.' : ''}</Copy>}
    {preview.error && <Status label="Check the timing and repeat fields." tone="warning" />}
    </View>{!!message && <Status label={message} tone="danger" />}
    {retrySave && <Status label="Save not confirmed. Retry the same save before leaving." tone="warning" />}
  </Page>;
}
