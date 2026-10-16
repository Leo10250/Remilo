import { useQuery } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { Keyboard, View } from 'react-native';
import type { RoutineDay, RoutineDraft, RoutineExercise, RoutinePlan } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { civilAt } from '../domain/time';
import { useTranslation } from '../localization/react';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, DateField, Disclosure, Field, Page, QueryState, RowSupport, SettingRow, Sheet } from './components';
import { useAppearanceConfirmation } from './confirmation';
import { CommandRecovery, ListPicker, useCapturedCommand } from './navigation';
import { engine, nativeAvailable, useCapabilities } from './native';
import { notify } from './feedback';
import { useAppearanceHold } from './theme';
import { useTimeFormatting } from './time-display';

export const routineDayKeys = ['routine_day_0', 'routine_day_1', 'routine_day_2', 'routine_day_3', 'routine_day_4', 'routine_day_5', 'routine_day_6'] as const;
export const emptyRoutineDays = (): RoutineDay[] => Array.from({ length: 7 }, () => ({ type: 'Rest', exercises: [] }));
export const validRoutineDays = (days: RoutineDay[]) => days.some(d => d.type === 'Exercises') && days.every(d => d.type === 'Rest' || d.exercises.length > 0 && d.exercises.every(e => e.name.trim()));

export function RoutineEditorRoute({ id, duplicate = false, listId }: { id?: string; duplicate?: boolean; listId?: string }) {
  const t = useTranslation();
  const [today] = useState(() => civilAt(Date.now()).slice(0, 10));
  const plans = useQuery({ queryKey: ['routines'], queryFn: () => engine().queryRoutines(), enabled: nativeAvailable });
  const plan = plans.data?.find(p => p.id === id);
  if (id && !plan) return <Page compact title={t('routine_edit')}><QueryState loading={plans.isLoading} error={plans.error} empty={!plans.isLoading} onRetry={() => void plans.refetch()} /></Page>;
  return <RoutineEditorForm key={id ?? 'new'} plan={duplicate ? undefined : plan} initial={plan ? { ...plan, startsOn: duplicate ? today : plan.startsOn, title: duplicate ? plan.title.slice(0, 193) + t('m_d75612450689') : plan.title } : undefined} listId={listId} />;
}

export function RoutineEditorForm({ plan, initial, listId, onRemove, inheritedDirty = false }: { plan?: RoutinePlan; initial?: Partial<RoutineDraft> & { startsOn?: string }; listId?: string; onRemove?: () => void; inheritedDirty?: boolean }) {
  const t = useTranslation(), navigation = useNavigation(), confirm = useAppearanceConfirmation(), caps = useCapabilities();
  const { shortDateTime, formatTime } = useTimeFormatting();
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().getLists(), enabled: nativeAvailable });
  useAppearanceHold(true);
  const [draft, setDraft] = useState<RoutineDraft>(() => ({ title: '', minutes: 8 * 60, mode: 'Notification', listId: listId ?? null, days: emptyRoutineDays(), ...initial }));
  const [startsOn, setStartsOn] = useState(() => initial?.startsOn ?? civilAt(Date.now()).slice(0, 10));
  const [baseline] = useState(() => JSON.stringify({ draft, startsOn }));
  const [loadedPlan, setLoadedPlan] = useState(plan), [reviewOpen, setReviewOpen] = useState(false);
  const [day, setDay] = useState<number | null>(null), [weekOpen, setWeekOpen] = useState(false), [saved, setSaved] = useState(false), [alertOpen, setAlertOpen] = useState(false);
  const [message, setMessage] = useState('');
  const action = useCapturedCommand((job, result) => { notify({ message: result.status === 'Blocked' ? job.success + ' ' + t('routine_notification_warning') : job.success, tone: result.status === 'Blocked' ? 'warning' : 'success', persistent: result.status === 'Blocked' }); setSaved(true); return false; });
  const valid = !!draft.title.trim() && validRoutineDays(draft.days), dirty = inheritedDirty || JSON.stringify({ draft, startsOn }) !== baseline;
  usePreventRemove(!saved && dirty && !action.guarded, ({ data }) => confirm(t('m_85bcf41666a5'), t('m_2a6bb39d73ff'), [
    { text: t('m_e76fd2add010'), style: 'cancel' }, { text: t('m_eb1a70e39274'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
  ]));
  useEffect(() => { if (saved) { Keyboard.dismiss(); if (router.canGoBack()) router.back(); else router.replace('/routines'); } }, [saved]);
  const preview = useQuery({ queryKey: ['routine-preview', draft, startsOn, plan?.id], queryFn: () => engine().previewRoutine({ ...draft, startsOn, ...(plan ? { routineId: plan.id } : {}) }),
    enabled: nativeAvailable && validRoutineDays(draft.days) && !action.guarded });
  const patch = (value: Partial<RoutineDraft>) => { if (!action.isGuarded()) setDraft(current => ({ ...current, ...value })); };
  const weekdays = draft.days.map((d, i) => d.type === 'Exercises' ? t(routineDayKeys[i]) : null).filter(Boolean).join(' · ');
  const changedDays = loadedPlan ? draft.days.map((d, i) => JSON.stringify(d) !== JSON.stringify(loadedPlan.days[i]) ? i : null).filter(i => i !== null) : [];
  const stale = !!plan && plan.revision !== loadedPlan?.revision;
  const save = () => { Keyboard.dismiss(); void action.execute({ command: loadedPlan ? { ...draft, kind: 'EditRoutine', routineId: loadedPlan.id, expectedRevision: loadedPlan.revision, operationId: engine().createOperationId() }
    : { ...draft, kind: 'CreateRoutine', startsOn, operationId: engine().createOperationId() }, success: t(plan ? 'routine_saved_changes' : 'routine_saved') }); };
  const timeValue = new Date(`${startsOn}T${String(Math.floor(draft.minutes / 60)).padStart(2, '0')}:${String(draft.minutes % 60).padStart(2, '0')}:00`).getTime();
  return <Page compact title={t(plan ? 'routine_edit' : 'm_70f22f445886')} footer={<BottomActionBar><View style={{ flex: 1, gap: 8 }}>
    <CommandRecovery action={action} />{!!message && <ActionFeedback message={message} tone="danger" />}
    <Button label={t('m_1509f561f241')} busy={action.busy} disabled={!valid || stale || action.guarded} onPress={save} />
  </View></BottomActionBar>}>
    <View style={{ gap: 12 }} pointerEvents={action.guarded ? 'none' : 'auto'} accessibilityElementsHidden={action.guarded} importantForAccessibility={action.guarded ? 'no-hide-descendants' : 'auto'}>
      {stale && <><ActionFeedback message={t('m_fe8e0e6d9197')} tone="warning" /><Button label={t('routine_change_review')} variant="secondary" onPress={() => setReviewOpen(true)} /></>}
      <Field label={t('m_7e8cd2056da7')} value={draft.title} maxLength={200} required multiline compactMultiline onChangeText={title => patch({ title })} />
      <ConnectedGroup>
        <View key="time"><RowSupport><Copy muted size={14}>{t('routine_shared_time')}</Copy></RowSupport>
          {!plan && <DateField label={t('routine_starts')} value={timeValue} dateOnly onError={setMessage} onChange={value => setStartsOn(civilAt(value).slice(0, 10))} />}
          <DateField label={t('m_33b93476cf59')} value={timeValue} timeOnly onError={setMessage} onChange={value => { const local = civilAt(value); patch({ minutes: Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16)) }); }} />
        </View>
        <SettingRow key="alert" label={t('m_44a57b22e03d')} icon="notifications" value={t(draft.mode === 'Notification' ? 'routine_quiet' : 'routine_no_alert')} onPress={() => { Keyboard.dismiss(); setAlertOpen(true); }} />
        <SettingRow key="repeat" label={t('routine_repeat_label')} icon="repeat" value={t('routine_repeat', { days: weekdays })} description={t('routine_weekly_hint')} />
        <View key="routine"><SettingRow label={t('routine_title')} icon="fitness_center" value={t('routine_weekly')} onPress={() => { Keyboard.dismiss(); setWeekOpen(true); }} />
          <RowSupport><Copy>{t('routine_today_only')}</Copy><Copy muted size={14}>{t('routine_today_only_hint')}</Copy></RowSupport>
        </View>
        <ListPicker key="list" value={draft.listId} onChange={listId => patch({ listId })} />
      </ConnectedGroup>
      {plan && <ConnectedGroup title={t('routine_change_review')}><View><RowSupport><Copy muted size={14}>{t('routine_from_tomorrow')}</Copy>
        {changedDays.map(i => <View key={i}><Copy>{t('routine_changed_day', { day: t(routineDayKeys[i]) })}</Copy><Copy muted size={14}>{draft.days[i].type === 'Rest' ? t('routine_rest') : draft.days[i].exercises.map(e => [e.name, e.target].filter(Boolean).join(' · ')).join('\n')}</Copy></View>)}
      </RowSupport></View></ConnectedGroup>}
      {!validRoutineDays(draft.days) && <Copy muted>{t('routine_validation')}</Copy>}
      {draft.mode === 'Notification' && <>
        <Copy muted size={14}>{t('routine_no_catchup')}</Copy>
        {preview.data?.nextAlertMs != null && <Copy muted>{t(plan ? 'routine_next_after_changes' : 'routine_next_prompt', { time: shortDateTime(preview.data.nextAlertMs) })}</Copy>}
        {!!preview.error && <Button label={t('m_942087cc2d41')} variant="secondary" onPress={() => void preview.refetch()} />}
        {caps.data && (!caps.data.notifications || !caps.data.routineChannelEnabled) && <ActionFeedback tone="warning" message={t('routine_notification_warning')} />}
        {caps.data?.routineChannelQuiet === false && <Copy muted>{t('routine_channel_changed')}</Copy>}
        <Button label={t('routine_channel_settings')} variant="neutral" onPress={() => void engine().openSettings('routineChannel')} />
      </>}
      <Disclosure title={t('m_fd7a9893f84d')} icon="settings"><Copy muted>{t('routine_today_only_hint')}</Copy>
        {onRemove && <Button label={t('routine_remove')} variant="secondary" onPress={onRemove} />}</Disclosure>
    </View>
    <Sheet title={t('m_44a57b22e03d')} visible={alertOpen} onClose={() => setAlertOpen(false)}>
      <Choice label={t('routine_quiet')} selected={draft.mode === 'Notification'} onPress={() => { patch({ mode: 'Notification' }); setAlertOpen(false); }} />
      <Choice label={t('routine_no_alert')} selected={draft.mode === 'None'} onPress={() => { patch({ mode: 'None' }); setAlertOpen(false); }} />
    </Sheet>
    <Sheet title={t('routine_change_review')} visible={reviewOpen} onClose={() => setReviewOpen(false)}>
      <Copy muted>{t('m_fe8e0e6d9197')}</Copy><Copy>{plan?.title}</Copy>
      {plan && <><Copy>{formatTime(new Date(`${startsOn}T${String(Math.floor(plan.minutes / 60)).padStart(2, '0')}:${String(plan.minutes % 60).padStart(2, '0')}:00`).getTime())}</Copy>
        <Copy>{t(plan.mode === 'None' ? 'routine_no_alert' : 'routine_quiet')}</Copy><Copy>{lists.data?.find(list => list.id === plan.listId)?.name ?? t('m_eacd31d849f9')}</Copy></>}
      {plan?.days.map((value, i) => <View key={i}><Copy heading>{t(routineDayKeys[i])}</Copy><Copy muted>{value.type === 'Rest' ? t('routine_rest') : value.exercises.map(e => [e.name, e.target].filter(Boolean).join(' · ')).join('\n')}</Copy></View>)}
      <Button label={t('routine_keep_draft')} onPress={() => { setLoadedPlan(plan); setReviewOpen(false); }} />
      <Button label={t('routine_load_latest')} variant="secondary" onPress={() => { if (plan) { setDraft({ ...plan }); setLoadedPlan(plan); } setReviewOpen(false); }} />
    </Sheet>
    <Sheet title={t('routine_weekly')} visible={weekOpen && day === null} onClose={() => setWeekOpen(false)} footer={<View style={{ padding: 16 }}><Button label={t('routine_back_reminder')} onPress={() => setWeekOpen(false)} /></View>}>
      <Copy muted>{t('routine_weekly_hint')}</Copy>
      <ConnectedGroup>{draft.days.map((value, i) => <SettingRow key={i} label={t(routineDayKeys[i])} value={value.type === 'Rest' ? t('routine_rest') : t('routine_exercise_count', { count: value.exercises.length })}
        description={value.type === 'Exercises' ? value.exercises.map(e => e.name).filter(Boolean).join(' · ') : undefined} onPress={() => setDay(i)} />)}</ConnectedGroup>
    </Sheet>
    {day !== null && <RoutineDayEditor key={day} index={day} day={draft.days[day]} onClose={() => setDay(null)} onChange={value => { patch({ days: draft.days.map((d, i) => i === day ? value : d) }); setDay(null); }} />}
  </Page>;
}

export function RoutineDayEditor({ index, day, onClose, onChange }: { index: number; day: RoutineDay; onClose: () => void; onChange: (day: RoutineDay) => void }) {
  const t = useTranslation(), [draft, setDraft] = useState<RoutineDay>(day), [editing, setEditing] = useState<RoutineExercise | null>(null);
  const [removed, setRemoved] = useState<{ exercise: RoutineExercise; index: number } | null>(null);
  const valid = draft.type === 'Rest' || draft.exercises.length > 0 && draft.exercises.every(e => e.name.trim());
  const editingIndex = draft.exercises.findIndex(e => e.id === editing?.id);
  const move = (index: number, delta: number) => { const exercises = [...draft.exercises]; [exercises[index], exercises[index + delta]] = [exercises[index + delta], exercises[index]]; setDraft({ ...draft, exercises }); };
  return <Sheet title={t(routineDayKeys[index])} visible onClose={() => { if (editing) setEditing(null); else onClose(); }} footer={<View style={{ padding: 16, gap: 8 }}>
    <Button label={t(editing ? 'm_1509f561f241' : 'routine_use_day')} disabled={editing ? !editing.name.trim() : !valid} onPress={() => {
      Keyboard.dismiss(); if (editing) { const exists = draft.exercises.some(e => e.id === editing.id); setDraft({ type: 'Exercises', exercises: exists ? draft.exercises.map(e => e.id === editing.id ? editing : e) : [...draft.exercises, editing] }); setEditing(null); }
      else onChange(draft.type === 'Rest' ? { type: 'Rest', exercises: [] } : draft);
    }} />
    <Button label={t('m_19766ed6ccb2')} variant="secondary" onPress={() => { Keyboard.dismiss(); if (editing) setEditing(null); else onClose(); }} />
  </View>}>
    {editing ? <View style={{ gap: 12 }}>
      <Field label={t('routine_name')} required value={editing.name} maxLength={200} multiline compactMultiline onChangeText={name => setEditing({ ...editing, name })} />
      <Field label={t('routine_target')} value={editing.target} maxLength={1000} multiline compactMultiline onChangeText={target => setEditing({ ...editing, target })} />
      <Field label={t('routine_guidance')} value={editing.notes} maxLength={10000} multiline compactMultiline onChangeText={notes => setEditing({ ...editing, notes })} />
      {editingIndex >= 0 && <ConnectedGroup>
        <SettingRow key="up" label={t('routine_move_up')} disabled={editingIndex === 0} onPress={() => move(editingIndex, -1)} />
        <SettingRow key="down" label={t('routine_move_down')} disabled={editingIndex === draft.exercises.length - 1} onPress={() => move(editingIndex, 1)} />
        <SettingRow key="remove" label={t('routine_remove_exercise')} icon="remove_circle_outline" onPress={() => { setRemoved({ exercise: draft.exercises[editingIndex], index: editingIndex }); setDraft({ ...draft, exercises: draft.exercises.filter(e => e.id !== editing.id) }); setEditing(null); }} />
      </ConnectedGroup>}
    </View> : <View style={{ gap: 12 }}>
      <ConnectedGroup><Choice key="exercise" label={t('routine_exercises')} selected={draft.type === 'Exercises'} onPress={() => setDraft({ ...draft, type: 'Exercises' })} />
        <Choice key="rest" label={t('routine_rest')} selected={draft.type === 'Rest'} onPress={() => setDraft({ ...draft, type: 'Rest' })} /></ConnectedGroup>
      {draft.type === 'Exercises' && <>
        <ConnectedGroup>{draft.exercises.map(e => <SettingRow key={e.id} label={e.name} value={e.target || undefined} description={e.notes || undefined} onPress={() => setEditing(e)} />)}</ConnectedGroup>
        {removed && <View accessibilityLiveRegion="polite"><Copy>{t('routine_removed')}</Copy><Button label={t('routine_undo')} icon="undo" variant="secondary" onPress={() => { const exercises = [...draft.exercises]; exercises.splice(removed.index, 0, removed.exercise); setDraft({ ...draft, exercises }); setRemoved(null); }} /></View>}
        <Button label={t('routine_add_exercise')} icon="add" variant="secondary" disabled={draft.exercises.length >= 100} onPress={() => setEditing({ id: engine().createOperationId(), name: '', target: '', notes: '', illustration: '' })} />
        {!valid && <Copy muted>{t('routine_validation')}</Copy>}
      </>}
    </View>}
  </Sheet>;
}
