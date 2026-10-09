import { useQuery } from '@tanstack/react-query';
import { usePreventRemove } from 'expo-router/react-navigation';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { Command, CommandResult, RecurrenceDraft, Series } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { changeDraftZone, chooseConflict, editorDraft, moveDraftDue, moveDraftEvent, reviewChoicesComplete, reviewEditorDraft, type DraftConflict, type EditorDraft, type EditorState } from '../domain/editor-draft';
import { commandFeedback } from '../domain/actions';
import { cleanRepeat, repeatLabel } from '../domain/repeat';
import { creationOrigin, retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { modeLabel, scheduleDateTime } from '../domain/presentation';
import { deviceZone } from '../domain/time';
import { ActionFeedback, BottomActionBar, Button, Choice, Copy, DateField, Disclosure, Field, formatTime, Group, Page, QueryState, SelectRow, Sheet, Status, Toggle } from '../ui/components';
import { notify } from '../ui/feedback';
import { CommandError, engine, nativeAvailable, useCommand, useSettings } from '../ui/native';
import { RepeatForm } from '../ui/recurrence';
import { useAppearanceHold } from '../ui/theme';
import { TimeZoneField } from '../ui/time-zone';
import { ListPicker, returnToOrigin } from '../ui/navigation';
import { Schedule } from '../ui/schedule';
import { SoundPicker } from '../ui/sound-picker';
import { useAppearanceConfirmation } from '../ui/confirmation';

type Seed = { state: EditorState; revision?: number; series?: Series };
async function readSeed(id?: string, segmentId?: string, following?: string): Promise<Seed> {
  let draft: EditorDraft, recurrence: RecurrenceDraft | undefined, revision: number | undefined, series: Series | undefined;
  if (segmentId) {
    series = await engine().getSeries(segmentId) ?? undefined;
    if (!series) throw new Error('This repeat is unavailable.');
    const source = following ? await engine().getSeriesDraft(segmentId, following) : undefined;
    draft = editorDraft(source?.template ?? series.template);
    recurrence = cleanRepeat({ ...series.rule, zoneMode: series.rule.zoneId ? 'pinned' : 'floating',
      count: following ? source?.remainingCount ?? undefined : series.rule.count ?? undefined, until: series.rule.until ?? undefined });
    if (recurrence.zoneMode === 'floating') draft = (await changeDraftZone(draft, deviceZone(), (input) => engine().convertTime(input))).draft;
  } else if (id) {
    const record = await engine().getOccurrence(id);
    if (!record) throw new Error('This reminder is unavailable.');
    draft = editorDraft(record); revision = record.revision;
  } else draft = editorDraft();
  return { state: { draft, recurrence }, revision, series };
}
export default function Editor() {
  const params = useLocalSearchParams<OriginParams & { id?: string; duplicate?: string; segmentId?: string; following?: string }>();
  const id = params.id ?? params.duplicate, editing = !!id || !!params.segmentId;
  const source = useQuery({ queryKey: ['editor-source', id, params.segmentId, params.following], enabled: nativeAvailable && editing,
    queryFn: () => readSeed(id, params.segmentId, params.following) });
  if (!nativeAvailable) return <Page compact title="Reminder"><Copy>Install the Android build to create and edit reminders.</Copy></Page>;
  if (editing && !source.data) return <Page compact title="Edit reminder" onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(retainedOriginParams(params)))}><QueryState loading={source.isLoading} error={source.error}
    empty={false} onRetry={() => void source.refetch()} /></Page>;
  const origin = creationOrigin(params);
  const seed = source.data ?? { state: { draft: editorDraft({ title: '', listId: origin.kind === 'list' ? origin.listId : null }) } };
  return <EditorForm key={id ?? params.segmentId ?? 'new'} seed={seed} id={params.id} duplicate={!!params.duplicate} following={params.following} originParams={retainedOriginParams(params)} />;
}
type Review = { latest: Seed; merged: EditorState; conflicts: DraftConflict[]; choices: Partial<Record<DraftConflict['key'], 'yours' | 'latest'>> };
function EditorForm({ seed, id, duplicate, following, originParams }: { seed: Seed; id?: string; duplicate: boolean; following?: string; originParams: OriginParams }) {
  const settings = useSettings(), command = useCommand(), navigation = useNavigation();
  const confirm = useAppearanceConfirmation();
  useAppearanceHold(true);
  const [origin] = useState(() => creationOrigin(originParams));
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().getLists(), enabled: nativeAvailable });
  const [state, setState] = useState<EditorState>(() => ({ ...seed.state, draft: { ...seed.state.draft,
    title: duplicate ? seed.state.draft.title.slice(0, 193) + ' (copy)' : seed.state.draft.title } }));
  const { draft, recurrence } = state, zone = draft.zoneId ?? deviceZone();
  const [baseline, setBaseline] = useState(state);
  const [loadedRevision, setLoadedRevision] = useState(seed.revision), [loadedSeries, setLoadedSeries] = useState(seed.series);
  const [followingScope, setFollowingScope] = useState(following), [saveAsNew, setSaveAsNew] = useState(false);
  const [message, setMessage] = useState(''), [fieldError, setFieldError] = useState<string | undefined>(), [zoneWarning, setZoneWarning] = useState('');
  const pendingSave = useRef<Command | null>(null);
  const timingWork = useRef(false);
  const [retrySave, setRetrySave] = useState(false), [saved, setSaved] = useState<CommandResult | null>(null);
  const [preparing, setPreparing] = useState(false), [reviewLoading, setReviewLoading] = useState(false);
  const [review, setReview] = useState<Review | null>(null), [reviewOpen, setReviewOpen] = useState(false), [scopeChanged, setScopeChanged] = useState(false);
  const editingId = saveAsNew ? undefined : id, editingSeries = saveAsNew ? undefined : loadedSeries;
  const creation = !editingId && !editingSeries;
  const dirty = saveAsNew || JSON.stringify(state) !== JSON.stringify(baseline);
  const busy = preparing || command.isPending || reviewLoading;
  usePreventRemove(!saved && (dirty || retrySave || preparing || command.isPending), ({ data }) => {
    if (retrySave || pendingSave.current || command.isPending) { confirm('Save not yet confirmed', 'Retry or wait for this save before leaving.'); return; }
    if (preparing) { confirm('Updating timing', 'Wait for the timing update before leaving.'); return; }
    confirm('Discard changes?', 'Your reminder has not been saved.', [{ text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) }]);
  });
  useEffect(() => {
    if (!saved) return;
    const blocked = saved.status === 'Blocked', pending = saved.status === 'Pending';
    if (creation || blocked || pending) {
      const occurrence = saved.occurrence;
      const success = draft.mode === 'None' ? 'Reminder created without an alert' :
        saved.status === 'Scheduled' && occurrence?.nextAlertMs != null ?
          `${modeLabel(occurrence.mode)} scheduled for ${scheduleDateTime(occurrence.nextAlertMs, occurrence.zoneId || deviceZone())}` :
          saved.segmentId ? 'Repeating reminder created' : 'Reminder created';
      const feedback = commandFeedback(saved, success);
      notify({ message: feedback.message, tone: feedback.tone === 'accent' ? 'muted' : feedback.tone, persistent: blocked || pending,
        action: { label: 'View', occurrenceId: saved.occurrence?.id, segmentId: saved.segmentId } });
    }
    if (creation) returnToOrigin(origin);
    else if (router.canGoBack()) router.back();
    else if (originParams.originReminderId || originParams.originFamily || originParams.originCollection) router.replace(secondaryOriginRoute(originParams));
    else if (saved.segmentId) router.replace({ pathname: '/series/[id]', params: { id: saved.segmentId } });
    else if (saved.occurrence) router.replace({ pathname: '/reminder/[id]', params: { id: saved.occurrence.id } });
    else router.replace('/');
  }, [saved, creation, draft.mode, origin, originParams]);
  const patch = (value: Partial<EditorDraft>) => { if (!pendingSave.current && !timingWork.current) setState((current) => ({ ...current, draft: { ...current.draft, ...value } })); };
  const updateTiming = async (resolve: () => Promise<{ draft: EditorDraft; warnings: string[] }>, field: string, nextRepeat?: { value?: RecurrenceDraft }) => {
    if (pendingSave.current || timingWork.current || busy || review) throw new Error('Wait for the current update before changing timing.');
    timingWork.current = true; setPreparing(true); setMessage(''); setFieldError(undefined); setZoneWarning('');
    try {
      const changed = await resolve();
      setState((current) => ({ draft: changed.draft, recurrence: nextRepeat ? nextRepeat.value : current.recurrence })); setZoneWarning(changed.warnings.join(' '));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update the timing. Try again.'); setFieldError(field); throw error;
    } finally { timingWork.current = false; setPreparing(false); }
  };
  const moveEvent = (value: number) => { void updateTiming(() => moveDraftEvent(draft, value, (input) => engine().convertTime(input)), 'eventStartMs').catch(() => {}); };
  const changeDue = (value: number) => { void updateTiming(() => moveDraftDue(draft, value, (input) => engine().convertTime(input)), 'dueAtMs').catch(() => {}); };
  const changeZone = (nextZone: string, nextRepeat: RecurrenceDraft | undefined) => updateTiming(() => changeDraftZone(draft, nextZone, (input) => engine().convertTime(input)), 'zoneId', { value: nextRepeat });
  const applyRepeat = async (next?: RecurrenceDraft, nextZone?: string) => {
    if (pendingSave.current || timingWork.current || review) return;
    if (nextZone && nextZone !== zone) await changeZone(nextZone, next);
    else setState((current) => ({ ...current, recurrence: next }));
  };
  const payload = Object.fromEntries(Object.entries({ ...draft,
    ...(recurrence ? { recurrence: cleanRepeat(recurrence) } : {}),
    ...(draft.allDay && draft.dueLinked ? { dueAtMs: undefined } : {}), ...(draft.allDay && draft.alarmLinked ? { alarmAtMs: undefined } : {}) })
    .filter(([key, value]) => key !== 'listName' && value !== undefined));
  const preview = useQuery({ queryKey: ['schedule-preview', payload], queryFn: () => engine().previewSchedule(payload as EditorDraft & { recurrence?: RecurrenceDraft }),
    enabled: nativeAvailable && !!draft.title.trim() && !busy });
  const loadReview = async () => {
    setReviewLoading(true); setMessage('');
    try {
      const latest = await readSeed(editingId, editingSeries?.id, followingScope);
      if (latest.series?.state === 'Archived') { setScopeChanged(true); setReview(null); return; }
      const result = reviewEditorDraft(baseline, state, latest.state);
      setReview({ latest, ...result, choices: {} }); setReviewOpen(true);
    } catch (error) {
      // A following boundary can be retired by a concurrent series edit.
      if (editingSeries) {
        const current = await engine().getSeries(editingSeries.id).catch(() => null);
        if (current?.state === 'Archived') { setScopeChanged(true); setReview(null); return; }
      }
      setMessage(error instanceof Error ? error.message : 'Could not load the latest reminder. Retry the review.');
    } finally { setReviewLoading(false); }
  };
  const applyReview = (reload = false) => {
    if (!review || !reload && !reviewChoicesComplete(review.conflicts, review.choices)) return;
    const next = reload ? review.latest.state : review.conflicts.reduce((value, conflict) => chooseConflict(value, conflict, review.choices[conflict.key]!), review.merged);
    setBaseline(review.latest.state); setState(next); setLoadedRevision(review.latest.revision); setLoadedSeries(review.latest.series);
    setReview(null); setReviewOpen(false); setMessage(''); setFieldError(undefined); command.reset();
  };
  const reloadCurrent = async () => {
    setReviewLoading(true); setMessage('');
    try {
      const family = (await engine().queryRepeatFamilies()).find((item) => item.seriesId === loadedSeries?.seriesId);
      if (!family) throw new Error('The current repeat is unavailable. Your draft is kept.');
      const latest = await readSeed(undefined, family.current.id);
      setBaseline(latest.state); setState(latest.state); setLoadedSeries(latest.series); setLoadedRevision(undefined);
      setFollowingScope(undefined); setScopeChanged(false); setReview(null); setReviewOpen(false); setFieldError(undefined); command.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not reload the current repeat. Try again.'); }
    finally { setReviewLoading(false); }
  };
  const save = async () => {
    if (busy || timingWork.current || review || scopeChanged) return;
    setPreparing(true); setMessage(''); setFieldError(undefined);
    try {
      if (!pendingSave.current) {
        const resolved = preview.data;
        if (recurrence && resolved && !resolved.upcoming.length) { setMessage('Choose a repeat rule with future occurrences.'); setFieldError('recurrence'); return; }
        if (creation && !recurrence && resolved?.warnings.length && draft.mode !== 'None') { setMessage(resolved.warnings.join('\n')); setFieldError('alarmAtMs'); return; }
        if (editingSeries && !recurrence) { setMessage('Keep a repeat rule, or pause this repeat instead.'); setFieldError('recurrence'); return; }
        pendingSave.current = (editingSeries && recurrence ? { ...payload, recurrence: cleanRepeat(recurrence),
          kind: followingScope ? 'EditFollowing' : 'EditSeries', segmentId: editingSeries.id, expectedRevision: editingSeries.revision,
          nominalSlot: followingScope, operationId: engine().createOperationId() }
          : editingId ? { ...payload, kind: 'Edit', occurrenceId: editingId, expectedRevision: loadedRevision!, operationId: engine().createOperationId() }
          : recurrence ? { ...payload, recurrence: cleanRepeat(recurrence), kind: 'CreateSeries', operationId: engine().createOperationId() }
          : { ...payload, kind: 'Create', operationId: engine().createOperationId() }) as Command;
      }
      const result = await command.mutateAsync(pendingSave.current);
      setRetrySave(false); setSaved(result);
    } catch (error) {
      if (error instanceof CommandError) {
        pendingSave.current = null; setRetrySave(false); setFieldError(error.field);
        if (error.code?.startsWith('STALE')) { await loadReview(); return; }
      } else setRetrySave(pendingSave.current !== null);
      setMessage(error instanceof Error ? error.message : 'Could not save. Try again.');
    } finally { setPreparing(false); }
  };
  const invalid = (fields: string[]) => fieldError && fields.includes(fieldError) ? message : undefined;
  const dateError = (text: string) => { setMessage(text); };
  const conflictValue = (conflict: DraftConflict, side: 'yours' | 'latest') => {
    const value = conflict[side];
    if (conflict.key === 'schedule') {
      const timing = value as EditorDraft & { recurrence?: RecurrenceDraft };
      return 'When ' + formatTime(timing.eventStartMs, timing.zoneId) + (timing.allDay ? ' · All day' : ' · Ends ' + formatTime(timing.eventEndMs, timing.zoneId)) +
        ' · Due ' + formatTime(timing.dueAtMs, timing.zoneId) + (timing.dueLinked ? ' (linked)' : ' (independent)') + ' · ' +
        (timing.mode === 'None' ? 'No alert' : timing.mode + ' ' + formatTime(timing.alarmAtMs, timing.zoneId) + (timing.alarmLinked ? ' (linked)' : ' (independent)')) +
        ' · ' + repeatLabel(timing.recurrence) + ' · ' + timing.zoneId;
    }
    if (conflict.key === 'vibration') return value ? 'On' : 'Off';
    if (conflict.key === 'listId') return value == null ? 'No list' : lists.data?.find((list) => list.id === value)?.name ?? 'Unavailable list';
    return typeof value === 'string' && value.length ? value : 'None';
  };
  const disabled = !nativeAvailable || busy || !!review || scopeChanged || !draft.title.trim();
  const frozen = busy || retrySave || !!review;
  const reviewed = review?.conflicts.reduce((value, conflict) => chooseConflict(value, conflict, review.choices[conflict.key] ?? 'yours'), review.merged);
  return <Page compact title={creation ? 'New reminder' : editingSeries ? followingScope ? 'Edit following' : 'Edit repeat' : 'Edit reminder'}
    onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(originParams))}
    footer={<BottomActionBar><View style={{ flex: 1, gap: 8 }}>
      {!!zoneWarning && <ActionFeedback message={zoneWarning} tone="warning" />}
      {!!message && <ActionFeedback message={message} tone="danger" />}
      {retrySave && <ActionFeedback message="Save not confirmed. Retry the same save before leaving." tone="warning" />}
      <Button label={command.isPending ? 'Saving…' : preparing ? 'Updating…' : reviewLoading ? 'Reviewing…' : retrySave ? 'Retry same save' : 'Save'}
        busy={busy} disabled={disabled} onPress={() => void save()} />
    </View></BottomActionBar>}>
    {scopeChanged && <Group title="Repeat changed"><View style={{ padding: 14, gap: 12 }}>
      <Status label="This repeat was replaced. Your draft is kept; it cannot be applied to the previous schedule." tone="warning" />
      <Button label="Save as new reminder" variant="secondary" onPress={() => {
        setSaveAsNew(true); setScopeChanged(false); setReview(null); setMessage(''); setFieldError(undefined); command.reset();
      }} />
      <Button label="Reload current repeat" variant="secondary" disabled={busy} onPress={() => confirm('Reload current repeat?',
        'Discard this draft and edit the entire current repeat.', [{ text: 'Keep draft', style: 'cancel' }, { text: 'Reload', style: 'destructive', onPress: () => void reloadCurrent() }])} />
    </View></Group>}
    {review && <Group><View style={{ padding: 14, gap: 10 }}><Status label="This reminder changed. Your draft is kept. Review the latest changes before editing or saving." tone="warning" />
      <Button label="Review changes" variant="secondary" onPress={() => setReviewOpen(true)} /></View></Group>}
    {reviewLoading && <ActionFeedback loading message="Loading the latest changes…" />}
    {saveAsNew && <Copy muted>This draft will create a separate reminder when you Save. Review its timing first.</Copy>}
    <View pointerEvents={frozen ? 'none' : 'auto'} importantForAccessibility={frozen ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={frozen} style={{ gap: 16 }}>
      <Field label="Title" placeholder="What do you want to remember?" autoFocus={creation && !duplicate} value={draft.title}
        editable={!frozen} onChangeText={(title) => patch({ title })} maxLength={200} error={invalid(['title'])} />
      <Group>
        <DateField label="When" value={preview.data?.eventStartMs ?? draft.eventStartMs} zoneId={zone} onError={dateError} onChange={moveEvent} dateOnly={draft.allDay} />
        {!draft.dueLinked && <Copy muted size={14}>Due {formatTime(preview.data?.dueAtMs ?? draft.dueAtMs, zone)} · Independent of When</Copy>}
        <SelectRow label="Alert" icon="alarm" value={draft.mode ?? 'Alarm'} choices={[{ value: 'Alarm', label: 'Alarm' }, { value: 'Notification', label: 'Notification' }, { value: 'None', label: 'No alert' }]}
          onChange={(mode) => patch({ mode })} />
        {draft.mode !== 'None' && !draft.alarmLinked && <DateField label={modeLabel(draft.mode) + ' time'} value={preview.data?.alarmAtMs ?? draft.alarmAtMs}
          zoneId={zone} onError={dateError} onChange={(alarmAtMs) => patch({ alarmAtMs, alarmLinked: false })} />}
        {invalid(['eventStartMs', 'alarmAtMs']) && <Status label={message} tone="danger" />}
        {!editingId && <RepeatForm value={recurrence} onChange={applyRepeat} startMs={draft.eventStartMs} zoneId={zone} previewDraft={draft} />}
        {invalid(['recurrence']) && <Status label={message} tone="danger" />}
      </Group>
      <View style={{ gap: 12 }}><ListPicker value={draft.listId ?? null} onChange={(listId) => patch({ listId })} disabled={frozen} />
        {invalid(['listId']) && <Status label={message} tone="danger" />}
        <Disclosure title="Notes (optional)" initial={!!draft.notes} forceOpen={!!invalid(['notes'])}>
          <Field label="Notes" value={draft.notes} onChangeText={(notes) => patch({ notes })} multiline maxLength={10_000} error={invalid(['notes'])} />
        </Disclosure></View>
      <Disclosure title="Schedule options" icon="settings" forceOpen={!!invalid(['dueAtMs', 'zoneId', 'eventEndMs'])}>
        <Toggle label="All day" value={draft.allDay ?? false} onChange={(allDay) => patch({ allDay, dueLinked: true, alarmLinked: true })} />
        {!draft.allDay && <DateField label="Ends" value={draft.eventEndMs} zoneId={zone} onError={dateError} onChange={(eventEndMs) => patch({ eventEndMs })} />}
        <Toggle label="Due follows When" value={draft.dueLinked ?? true} onChange={(dueLinked) => {
          const dueAtMs = dueLinked ? draft.allDay ? preview.data?.eventEndMs ?? draft.eventEndMs : draft.eventStartMs : preview.data?.dueAtMs ?? draft.dueAtMs;
          patch({ dueLinked, dueAtMs, ...(dueLinked && draft.alarmLinked && !draft.allDay ? { alarmAtMs: dueAtMs } : {}) });
        }} />
        {!draft.dueLinked && <DateField label="Due" value={draft.dueAtMs} zoneId={zone} onError={dateError} onChange={changeDue} />}
        {draft.mode !== 'None' && <><Toggle label={draft.allDay ? modeLabel(draft.mode) + ' at 9 AM' : modeLabel(draft.mode) + ' follows due time'} value={draft.alarmLinked ?? true} onChange={(alarmLinked) => patch({ alarmLinked,
          alarmAtMs: alarmLinked && !draft.allDay ? preview.data?.dueAtMs ?? draft.dueAtMs : preview.data?.alarmAtMs ?? draft.alarmAtMs })} />
          {draft.alarmLinked && <DateField label={modeLabel(draft.mode) + ' time'} value={preview.data?.alarmAtMs ?? draft.alarmAtMs} zoneId={zone}
            onError={dateError} onChange={(alarmAtMs) => patch({ alarmAtMs, alarmLinked: false })} />}</>}
        {!recurrence && <><TimeZoneField value={zone} atMs={draft.eventStartMs} disabled={busy} onChange={(next) => { void changeZone(next, undefined).catch(() => {}); }} error={invalid(['zoneId'])} />
          <Copy muted size={13}>Changing the zone keeps your clock times. This reminder stays at its saved instant when you travel.</Copy></>}
        {invalid(['dueAtMs', 'eventEndMs']) && <Status label={message} tone="danger" />}
      </Disclosure>
      {draft.mode === 'Alarm' && <Disclosure title="Alarm options" forceOpen={!!invalid(['sound', 'vibration'])}>
        <SoundPicker value={draft.sound ?? settings.data?.sound ?? 'remilo'} onChange={(sound) => patch({ sound })} disabled={frozen} />
        <Toggle label="Vibration" value={draft.vibration ?? settings.data?.vibration ?? true} onChange={(vibration) => patch({ vibration })} />
      </Disclosure>}
      {preview.data && <>
        <Schedule item={{ ...draft, ...preview.data, repeatRule: recurrence }} draft />
        {recurrence && <Group title="Next dates">{preview.data.upcoming.map((slot) => <View key={slot.nominalSlot} style={{ padding: 12, gap: 3 }}>
          <Copy size={14}>{formatTime(slot.eventStartMs, slot.zoneId)}</Copy><Copy muted size={13}>{slot.adjusted ? 'Clock-change adjustment · ' : ''}{draft.mode === 'None' ? 'No alert' : modeLabel(draft.mode) + ' ' + formatTime(slot.alarmAtMs, slot.zoneId)}</Copy>
        </View>)}{preview.data.upcoming.length < 3 && <Copy muted size={13}>Fewer than three occurrences remain.</Copy>}</Group>}
        {preview.data.warnings.map((warning) => <ActionFeedback tone="warning" message={warning} key={warning} />)}
      </>}
      {editingSeries && <Copy muted size={13}>Earlier unfinished and postponed occurrences are retained. {editingSeries.state === 'Paused' ? 'The repeat remains paused.' : ''}</Copy>}
      {preview.error && <Status label="Check the timing and repeat fields." tone="warning" />}
    </View>
    {command.error instanceof CommandError && command.error.code?.startsWith('STALE') && !review && !scopeChanged && <Button label="Retry review" variant="secondary" disabled={busy} onPress={() => void loadReview()} />}
    <Sheet title="Review changes" visible={reviewOpen && !!review} onClose={() => setReviewOpen(false)}>
      <Copy muted>Your draft is kept. Changes made only in the latest reminder are included below. Choose a version for each conflict.</Copy>
      {review?.conflicts.map((conflict) => <Group key={conflict.key} title={conflict.label}>
        <Choice label={'Yours: ' + conflictValue(conflict, 'yours')} selected={review.choices[conflict.key] === 'yours'}
          onPress={() => setReview((current) => current && ({ ...current, choices: { ...current.choices, [conflict.key]: 'yours' } }))} />
        <Choice label={'Latest: ' + conflictValue(conflict, 'latest')} selected={review.choices[conflict.key] === 'latest'}
          onPress={() => setReview((current) => current && ({ ...current, choices: { ...current.choices, [conflict.key]: 'latest' } }))} />
      </Group>)}
      {!review?.conflicts.length && <Copy>No fields conflict. Your edits and the latest changes can be kept together.</Copy>}
      {reviewed && <Group title="Draft after review"><View style={{ padding: 14, gap: 8 }}>
        <Copy>{reviewed.draft.title}</Copy>
        <Copy size={14}>When: {formatTime(reviewed.draft.eventStartMs, reviewed.draft.zoneId)}{reviewed.draft.allDay ? ' · All day' : ''}</Copy>
        <Copy size={14}>Due: {formatTime(reviewed.draft.dueAtMs, reviewed.draft.zoneId)}</Copy>
        <Copy size={14}>{reviewed.draft.mode === 'None' ? 'No alert' : reviewed.draft.mode + ': ' + formatTime(reviewed.draft.alarmAtMs, reviewed.draft.zoneId)}</Copy>
        <Copy size={14}>{repeatLabel(reviewed.recurrence)}</Copy>
        <Copy muted size={13}>{reviewed.draft.zoneId} · {reviewed.draft.listId == null ? 'No list' : lists.data?.find((list) => list.id === reviewed.draft.listId)?.name ?? 'Unavailable list'}</Copy>
        {!!reviewed.draft.notes && <Disclosure title="Notes"><Copy>{reviewed.draft.notes}</Copy></Disclosure>}
      </View></Group>}
      <Button label="Use reviewed draft" disabled={!!review && !reviewChoicesComplete(review.conflicts, review.choices)} onPress={() => applyReview()} />
      <Button label="Reload latest" variant="secondary" onPress={() => confirm('Discard draft changes?', 'Reload the latest saved reminder.',
        [{ text: 'Keep draft', style: 'cancel' }, { text: 'Reload', style: 'destructive', onPress: () => applyReview(true) }])} />
    </Sheet>
  </Page>;
}
