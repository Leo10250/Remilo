import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import type { RoutineCommand, RoutinePlan } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { editorDraft } from '../domain/editor-draft';
import { creationOrigin, retainedOriginParams, type OriginParams } from '../domain/navigation';
import { routineBuilder, routineBuilderPayload } from '../domain/routine-builder';
import { validRoutineDays } from '../domain/routine-editor-draft';
import { civilAt, deviceZone } from '../domain/time';
import { useTranslation } from '../localization/react';
import { errorText } from '../localization';
import { AlertModeSelector } from '../ui/alert-mode-selector';
import { ActionFeedback, BottomActionBar, Button, ConnectedGroup, Copy, DateField, Disclosure, Field, IconButton, Page, QueryState, Toggle } from '../ui/components';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { DateTimeFields } from '../ui/date-time-fields';
import { useExerciseImageLeases } from '../ui/exercise-images';
import { notify } from '../ui/feedback';
import { CommandRecovery, ListPicker, returnToOrigin, useCapturedCommand } from '../ui/navigation';
import { engine, nativeAvailable, useCapabilities } from '../ui/native';
import { RoutineActions } from '../ui/routine-actions';
import { RoutineBuilderFields, RoutineDaysField, RoutinePresetField } from '../ui/routine-builder';
import { RoutineChangeReview } from '../ui/routine-editor';
import { SoundPicker } from '../ui/sound-picker';
import { useAppearanceHold } from '../ui/theme';
import { useTimeFormatting } from '../ui/time-display';

type Params = OriginParams & { routineId?: string; copyRoutine?: string };

export default function RoutineEditor() {
  const t = useTranslation(), params = useLocalSearchParams<Params>(), [epoch, setEpoch] = useState(0);
  const id = params.routineId ?? params.copyRoutine;
  const editing = params.routineId !== undefined || params.copyRoutine !== undefined;
  const query = useQuery({ queryKey: ['routine-editor-source', id], enabled: nativeAvailable && editing, queryFn: async () => {
    const plan = (await engine().queryRoutines()).find(value => value.id === id);
    if (!plan) throw new Error(t('routine_load_error'));
    return plan;
  } });
  const back = () => router.canGoBack() ? router.back() : router.replace('/routines');
  if (!nativeAvailable || editing && !query.data) return <Page compact title={t(editing ? 'routine_edit' : 'routine_new')} onBack={back}>
    {!nativeAvailable ? <Copy>{t('m_00b26ac6b4a0')}</Copy> : <QueryState loading={query.isLoading} error={query.error} empty={false} onRetry={() => void query.refetch()} />}
  </Page>;
  return <RoutineEditorForm key={`${id ?? 'new'}:${epoch}`} plan={query.data} duplicate={!!params.copyRoutine} params={retainedOriginParams(params)} onReload={async () => {
    const result = await query.refetch(); if (result.error) throw result.error;
    if (result.data) setEpoch(value => value + 1);
  }} />;
}

function RoutineEditorForm({ plan, duplicate, params, onReload }: { plan?: RoutinePlan; duplicate: boolean; params: OriginParams; onReload: () => Promise<void> }) {
  const t = useTranslation(), confirm = useAppearanceConfirmation(), navigation = useNavigation(), caps = useCapabilities(), { formatTime } = useTimeFormatting();
  useAppearanceHold(true);
  const [origin] = useState(() => creationOrigin(params));
  const [builder, setBuilder] = useState(() => routineBuilder(plan, duplicate ? () => engine().createOperationId() : undefined));
  const [startsOn, setStartsOn] = useState(() => plan && !duplicate ? plan.startsOn : civilAt(Date.now()).slice(0, 10));
  const [draft, setDraft] = useState(() => {
    const value = editorDraft({ title: plan ? duplicate ? plan.title.slice(0, 193) + t('m_d75612450689') : plan.title : '', notes: plan?.notes ?? '', mode: plan?.mode ?? 'Notification',
      listId: plan?.listId ?? (origin.kind === 'list' ? origin.listId : null), sound: plan?.sound ?? 'remilo', vibration: plan?.vibration ?? false });
    if (plan) value.alarmAtMs = new Date(`${plan.startsOn}T${String(Math.floor(plan.minutes / 60)).padStart(2, '0')}:${String(plan.minutes % 60).padStart(2, '0')}:00`).getTime();
    return value;
  });
  const [baseline] = useState(() => JSON.stringify({ draft, builder, startsOn })), [openedDate] = useState(() => civilAt(Date.now()).slice(0, 10));
  const [attempted, setAttempted] = useState(false), [saved, setSaved] = useState(false), [menu, setMenu] = useState(false), [dateError, setDateError] = useState('');
  const [preparing, setPreparing] = useState(false), [readError, setReadError] = useState('');
  const left = useRef(false), preparingRef = useRef(false);
  const titleRef = useRef<TextInput>(null), notesRef = useRef<TextInput>(null);
  const existing = plan && !duplicate ? plan : undefined;
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().getLists() });
  const payload = { title: draft.title, notes: draft.notes, minutes: new Date(draft.alarmAtMs).getHours() * 60 + new Date(draft.alarmAtMs).getMinutes(),
    mode: draft.mode ?? 'Notification', listId: draft.listId ?? null, sound: draft.sound, vibration: draft.vibration, ...routineBuilderPayload(builder) };
  const valid = !!draft.title.trim() && validRoutineDays(payload.days) && !dateError;
  const dirty = JSON.stringify({ draft, builder, startsOn }) !== baseline;
  const action = useCapturedCommand((_job, result) => {
    if (result.status === 'Applied' || result.status === 'Blocked') {
      notify({ message: t(result.status === 'Blocked' ? 'm_3e527a715fb1' : existing ? 'routine_saved_changes' : 'routine_saved'), tone: result.status === 'Blocked' ? 'warning' : 'success', persistent: result.status === 'Blocked' }); setSaved(true); return false;
    }
  });
  const frozen = action.guarded || saved || preparing;
  const leave = () => { titleRef.current?.blur(); notesRef.current?.blur(); Keyboard.dismiss(); if (router.canGoBack()) router.back(); else if (origin.kind === 'list') returnToOrigin(origin); else router.replace('/routines'); };
  useEffect(() => { if (saved && !action.guarded && !left.current) { left.current = true; leave(); } });
  usePreventRemove(!saved && (dirty || preparing) && !action.guarded, ({ data }) => {
    if (preparingRef.current) { confirm(t('m_d8eb10e04288'), t('m_27b05dc65c32')); return; }
    confirm(t('m_85bcf41666a5'), t('m_2a6bb39d73ff'), [
      { text: t('m_e76fd2add010'), style: 'cancel' }, { text: t('m_eb1a70e39274'), style: 'destructive', onPress: () => { Keyboard.dismiss(); navigation.dispatch(data.action); } },
    ]);
  });
  useExerciseImageLeases([...builder.sharedSteps, ...builder.days.flatMap(day => day.exercises)]);
  const session = useQuery({ queryKey: ['routine-edit-progress', existing?.id], enabled: !!existing, queryFn: () => engine().getRoutineSession(existing!.id, null) });
  const today = session.data?.date ?? openedDate, weekday = (new Date(`${today}T12:00:00`).getDay() + 6) % 7;
  const remainingIds = new Set(payload.days[weekday].exercises.map(step => step.id));
  const removedChecks = session.data && !session.data.ended ? session.data.steps.filter(step => step.completed && !remainingIds.has(step.id)).length : 0;
  const preview = useQuery({ queryKey: ['routine-preview', payload, startsOn, existing?.id], enabled: valid && !frozen,
    queryFn: () => engine().previewRoutine({ ...payload, startsOn, ...(existing ? { routineId: existing.id } : {}) }) });
  const save = async () => {
    if (action.isGuarded() || saved || preparingRef.current) return;
    Keyboard.dismiss(); setAttempted(true); if (!valid) return;
    preparingRef.current = true; setPreparing(true); setReadError('');
    try {
    const latestSession = existing ? await engine().getRoutineSession(existing.id, null) : null;
    const currentWeekday = latestSession ? (new Date(`${latestSession.date}T12:00:00`).getDay() + 6) % 7 : weekday;
    const currentIds = new Set(payload.days[currentWeekday].exercises.map(step => step.id));
    const currentRemoved = latestSession && !latestSession.ended ? latestSession.steps.filter(step => step.completed && !currentIds.has(step.id)).length : 0;
    const command: RoutineCommand = existing ? { kind: 'EditRoutine', routineId: existing.id, expectedRevision: existing.revision, operationId: engine().createOperationId(), ...payload }
      : { kind: 'CreateRoutine', startsOn, operationId: engine().createOperationId(), ...payload };
    const submit = () => void action.execute({ command, success: t('routine_saved_changes') });
    if (currentRemoved) confirm(t('routine_change_review'), t('routine_checks_removed', { count: currentRemoved }), [
      { text: t('m_19766ed6ccb2'), style: 'cancel' }, { text: t('m_1509f561f241'), onPress: submit },
    ]); else submit();
    } catch (reason) { setReadError(errorText(reason, t('routine_load_error'))); }
    finally { preparingRef.current = false; setPreparing(false); }
  };
  const reload = () => confirm(t('routine_reload'), t('routine_child_discard_hint'), [
    { text: t('m_19766ed6ccb2'), style: 'cancel' }, { text: t('routine_load_latest'), style: 'destructive', onPress: () => void onReload().catch(reason => setReadError(errorText(reason, t('routine_load_error')))) },
  ]);
  const noAlert = draft.mode === 'None';
  return <Page compact title={t(existing ? 'routine_edit' : 'routine_new')} onBack={leave} actions={existing ? <IconButton icon="more_vert" label={t('routine_more')} disabled={frozen} onPress={() => setMenu(true)} /> : undefined}
    footer={<BottomActionBar><View style={{ flex: 1, gap: 8 }}><Button label={t('m_1509f561f241')} busy={action.busy || preparing} disabled={frozen} onPress={() => void save()} /></View></BottomActionBar>}>
    <CommandRecovery action={action} />
    {!!readError && <ActionFeedback tone="danger" message={readError} />}
    {action.feedback?.tone === 'danger' && !action.guarded && existing && <Button label={t('routine_reload')} variant="secondary" onPress={reload} />}
    <View collapsable={false} style={{ gap: 12 }} pointerEvents={frozen ? 'none' : 'auto'} accessibilityElementsHidden={frozen} importantForAccessibility={frozen ? 'no-hide-descendants' : 'auto'}>
    <Field label={t('m_7e8cd2056da7')} placeholder={t('routine_title_example')} required inputRef={titleRef} value={draft.title} maxLength={200} multiline compactMultiline autoFocus={!plan}
      editable={!frozen} error={attempted && !draft.title.trim() ? t('routine_title_error') : undefined} onChangeText={title => setDraft(current => ({ ...current, title }))} />
    <Copy muted size={14}>{t('routine_generic_hint')}</Copy>
    <RoutinePresetField value={builder.presentationPreset} disabled={frozen} onChange={presentationPreset => setBuilder(current => ({ ...current, presentationPreset }))} />
    <RoutineBuilderFields value={builder} disabled={frozen} onChange={setBuilder} />
    {attempted && !validRoutineDays(payload.days) && <ActionFeedback tone="danger" message={t('routine_required_steps_days')} />}
    <ConnectedGroup title={t('routine_schedule')}>
      {!existing ? <DateTimeFields dateLabel={t('routine_starts')} dateZoneId={deviceZone()} dateValue={new Date(`${startsOn}T12:00:00`).getTime()}
        value={draft.alarmAtMs} zoneId={deviceZone()} allDay={noAlert} disabled={frozen} onError={setDateError}
        onDateChange={value => setStartsOn(civilAt(value).slice(0, 10))} onChange={alarmAtMs => { setDateError(''); setDraft(current => ({ ...current, alarmAtMs })); }} />
        : !noAlert && <DateField label={t('m_33b93476cf59')} value={draft.alarmAtMs} zoneId={deviceZone()} timeOnly disabled={frozen} onError={setDateError} onChange={alarmAtMs => { setDateError(''); setDraft(current => ({ ...current, alarmAtMs })); }} />}
      <RoutineDaysField value={builder} disabled={frozen} onChange={setBuilder} />
    </ConnectedGroup>
    {!!dateError && <ActionFeedback message={dateError} tone="danger" />}
    <ConnectedGroup><AlertModeSelector value={draft.mode ?? 'Notification'} disabled={frozen} onChange={mode => setDraft(current => ({ ...current, mode }))} /></ConnectedGroup>
    <ConnectedGroup><ListPicker value={draft.listId ?? null} disabled={frozen} onChange={listId => setDraft(current => ({ ...current, listId }))} /></ConnectedGroup>
    <Disclosure title={t('m_6239b93e96e9')} initial={!!draft.notes}><Field label={t('m_8a7525b1492f')} inputRef={notesRef} value={draft.notes} maxLength={10000} multiline editable={!frozen} onChangeText={notes => setDraft(current => ({ ...current, notes }))} /></Disclosure>
    {existing && <RoutineChangeReview plan={existing} draft={payload} listName={lists.data?.find(list => list.id === payload.listId)?.name} />}
    {!!removedChecks && <ActionFeedback tone="warning" message={t('routine_checks_removed', { count: removedChecks })} />}
    {preview.data?.nextAlertMs != null && !noAlert && <Copy muted size={14}>{t('routine_next_prompt', { time: formatTime(preview.data.nextAlertMs) })}</Copy>}
    {!!preview.error && <ActionFeedback tone="warning" message={t('routine_load_error')} />}
    {draft.mode === 'Notification' && <><Copy muted size={14}>{t('routine_no_catchup')}</Copy>
      {caps.data && (!caps.data.notifications || !caps.data.routineChannelEnabled) && <ActionFeedback tone="warning" message={t('routine_notification_warning')} />}
      {caps.data?.routineChannelQuiet === false && <Copy muted size={14}>{t('routine_channel_changed')}</Copy>}
      <Button label={t('routine_channel_settings')} variant="neutral" disabled={frozen} onPress={() => void engine().openSettings('routineChannel')} /></>}
    {draft.mode === 'Alarm' && <Disclosure title={t('m_8c648567f73c')}><ConnectedGroup>
      <SoundPicker value={draft.sound ?? 'remilo'} disabled={frozen} onChange={sound => setDraft(current => ({ ...current, sound }))} />
      <Toggle label={t('m_59e1fd02f6c2')} value={draft.vibration ?? false} disabled={frozen} onChange={vibration => setDraft(current => ({ ...current, vibration }))} />
    </ConnectedGroup></Disclosure>}
    </View>
    <RoutineActions target={menu && existing ? { id: existing.id } : null} onClose={() => setMenu(false)} onRemoved={() => setSaved(true)} />
  </Page>;
}
