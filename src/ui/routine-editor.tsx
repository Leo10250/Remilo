import { useRef, useState, type Ref } from 'react';
import { Keyboard, Pressable, View, useWindowDimensions } from 'react-native';
import type { RoutineDay, RoutineDraft, RoutineExercise, RoutinePlan, RoutinePreset } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { useTranslation } from '../localization/react';
import { Button, Choice, ConnectedGroup, Copy, Disclosure, Field, Icon, SettingRow, Sheet, useConnectedRowCorners } from './components';
import { useAppearanceConfirmation } from './confirmation';
import { engine } from './native';
import { ExerciseImageChooser, useExerciseImageLeases } from './exercise-images';
import { getExerciseIllustration } from './exercise-illustrations';
import { canAddRoutineExercise, changedRoutineDays, MAX_ROUTINE_EXERCISES_PER_DAY } from '../domain/routine-editor-draft';
import { modeLabel } from '../domain/presentation';
import { useFontScaleOverride, useTheme } from './theme';
import { useTimeFormatting } from './time-display';
import { exerciseTargetText } from '../domain/exercise-target';
import { ExerciseTargetFieldsView, type ExerciseFormHandle } from './exercise-target-fields';
export { emptyRoutineDays, validRoutineDays } from '../domain/routine-editor-draft';

export const routineDayKeys = ['routine_day_0', 'routine_day_1', 'routine_day_2', 'routine_day_3', 'routine_day_4', 'routine_day_5', 'routine_day_6'] as const;

export function RoutineChangeReview({ plan, draft, listName }: { plan: RoutinePlan; draft: RoutineDraft; listName?: string }) {
  const t = useTranslation(), { shortTime } = useTimeFormatting();
  const changed = changedRoutineDays(plan.days, draft.days);
  const fields = [
    { changed: (plan.presentationPreset ?? 'Exercise') !== (draft.presentationPreset ?? 'Exercise'), label: t('routine_purpose'), value: t(draft.presentationPreset === 'General' ? 'routine_general' : 'routine_exercise_preset') },
    { changed: (plan.authoringMode ?? 'ByWeekday') !== (draft.authoringMode ?? 'ByWeekday'), label: t('routine_weekly_plan'), value: t(draft.authoringMode === 'Shared' ? 'routine_shared_hint' : 'routine_independent_days') },
    { changed: plan.title !== draft.title, label: t('m_7e8cd2056da7'), value: draft.title },
    { changed: plan.mode !== draft.mode, label: t('m_44a57b22e03d'), value: modeLabel(draft.mode) },
    { changed: plan.minutes !== draft.minutes, label: t('m_33b93476cf59'), value: shortTime(new Date(2000, 0, 1, Math.floor(draft.minutes / 60), draft.minutes % 60).getTime()) },
    { changed: plan.notes !== (draft.notes ?? ''), label: t('m_8a7525b1492f'), value: draft.notes || t('m_dc937b598926') },
    { changed: plan.sound !== draft.sound, label: t('m_46124e023603'), value: draft.sound === 'system' ? t('m_6a05d9e751b1') : 'Remilo' },
    { changed: plan.vibration !== draft.vibration, label: t('m_59e1fd02f6c2'), value: t(draft.vibration ? 'm_130011756125' : 'm_ca7981b46ecf') },
    { changed: plan.listId !== draft.listId, label: t('m_6f202f54a7b2'), value: listName ?? t('m_eacd31d849f9') },
  ].filter(field => field.changed);
  const summary = [changed.length ? t('routine_change_summary', { count: changed.length }) : '', ...fields.map(field => field.label)].filter(Boolean).join(' · ');
  return <View style={{ gap: 8 }}><Copy muted size={14}>{t('routine_changes_immediate')}</Copy>
    {!!summary && <Disclosure title={t('routine_change_details')} summary={summary}>
      {fields.map(field => <View key={field.label}><Copy>{field.label}</Copy>{field.value && <Copy muted size={14}>{field.value}</Copy>}</View>)}
      {changed.map(index => <View key={index}><Copy>{t(routineDayKeys[index])}</Copy>
        <Copy muted size={14}>{draft.days[index].type === 'Rest' ? t(draft.presentationPreset === 'General' ? 'routine_not_scheduled' : 'routine_rest') : draft.days[index].exercises.map(exercise => [exercise.name, exerciseTargetText(exercise)].filter(Boolean).join(' · ')).join('\n')}</Copy></View>)}
    </Disclosure>}
  </View>;
}

/** Seven visible day rows edit the parent draft; no native write happens here. */
export function RoutineWeekFields({ days, onChange, disabled = false }: { days: RoutineDay[]; onChange: (days: RoutineDay[]) => void; disabled?: boolean }) {
  const t = useTranslation(), [selected, setSelected] = useState<number | null>(null);
  return <>
    <ConnectedGroup title={t('routine_exercises_by_day')} footer={<Copy muted size={14}>{t(days.every(day => day.type === 'Rest') ? 'routine_first_exercise_hint' : 'routine_day_fresh_hint')}</Copy>}>
      {days.map((day, index) => <SettingRow intent="navigation" key={index} label={t(routineDayKeys[index])} disabled={disabled}
        value={day.type === 'Rest' ? t('routine_day_rest_summary') : t('routine_exercise_count', { count: day.exercises.length })}
        description={day.type === 'Exercises' ? day.exercises.length > 2 ? t('routine_day_names_more', { names: day.exercises.slice(0, 2).map(exercise => exercise.name).filter(Boolean).join(' · '), count: day.exercises.length - 2 }) : day.exercises.map(exercise => exercise.name).filter(Boolean).join(' · ') : undefined}
        onPress={() => { Keyboard.dismiss(); setSelected(index); }} />)}
    </ConnectedGroup>
    {selected !== null && <RoutineDayEditor key={selected} index={selected} day={days[selected]} onClose={() => setSelected(null)} onChange={day => {
      onChange(days.map((value, index) => index === selected ? day : value)); setSelected(null);
    }} />}
  </>;
}

type ExerciseDraft = { value: RoutineExercise; position: number; initial: string; isNew: boolean };
export function RoutineBuilderStepRow({ exercise, position, total, onPress, disabled = false, buttonRef }: {
  exercise: RoutineExercise; position: number; total: number; onPress: () => void; disabled?: boolean; buttonRef?:Ref<View>;
}) {
  const t = useTranslation(), colors = useTheme(), scale = useFontScaleOverride(), [focused, setFocused] = useState(false);
  const { fontScale } = useWindowDimensions(), badge = 32 * Math.max(scale, fontScale);
  const target = exerciseTargetText(exercise),corners=useConnectedRowCorners();
  return <Pressable ref={buttonRef} accessibilityRole="button" accessibilityLabel={[t('routine_ordinal', { current: position + 1, total }), exercise.name, target].filter(Boolean).join('. ')}
    disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ ...corners, minHeight: 64, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: pressed ? colors.soft : colors.surface, borderWidth: 2, borderColor: focused ? colors.accent : 'transparent', opacity: disabled ? 0.5 : 1 })}>
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: badge, height: badge, borderRadius: badge / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft }}><Copy size={14}>{position + 1}</Copy></View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Copy>{exercise.name}</Copy>{!!target && <Copy muted size={14}>{target}</Copy>}</View>
    <Icon name="edit" size={20} />
  </Pressable>;
}
/** One form for nested weekly drafts and a directly saved exercise. Image selection stays draft-only. */
export function RoutineExerciseForm({ exercise, onChange, imageOpen, onImageOpenChange, disabled = false, preset = 'Exercise', formRef, onDirtyChange }: {
  exercise: RoutineExercise; onChange: (patch: Partial<RoutineExercise>) => void;
  imageOpen: boolean; onImageOpenChange: (open: boolean) => void; disabled?: boolean; preset?: RoutinePreset;
  formRef?: Ref<ExerciseFormHandle>; onDirtyChange?: (dirty: boolean) => void;
}) {
  const t = useTranslation(), illustration = getExerciseIllustration(exercise.illustration);
  return <View style={{ gap: 12 }}>
    <Field label={t(preset === 'General' ? 'routine_step_name_builder' : 'routine_exercise_name_builder')} placeholder={t(preset === 'General' ? 'routine_step_example' : 'routine_name_example')} required value={exercise.name} maxLength={200} multiline compactMultiline editable={!disabled} onChangeText={name => onChange({ name })} />
    <ExerciseTargetFieldsView key={exercise.id} exercise={exercise} general={preset==='General'} onChange={onChange} disabled={disabled} formRef={formRef} onDirtyChange={onDirtyChange} />
    <Field label={t('exercise_description')} placeholder={t('exercise_description_example')} value={exercise.notes} maxLength={10000} multiline compactMultiline editable={!disabled} onChangeText={notes => onChange({ notes })} />
    <ConnectedGroup><SettingRow intent="picker" label={t('exercise_image')} icon="image" disabled={disabled}
      value={exercise.customImageId ? t('routine_photo_for', { name: exercise.name }) : illustration ? t(illustration.labelKey) : exercise.illustration ? t('routine_illustration_unavailable') : t('exercise_image_hint')}
      onPress={() => { Keyboard.dismiss(); onImageOpenChange(true); }} /></ConnectedGroup>
    {imageOpen && <ExerciseImageChooser key={exercise.id} exercise={exercise} preset={preset} onChange={onChange} onClose={() => onImageOpenChange(false)} />}
  </View>;
}
export function RoutineDayEditor({ index, day, onClose, onChange, preset = 'Exercise', sequenceOnly = false, initialStepId, addOnOpen = false, copyFrom }: {
  index: number; day: RoutineDay; onClose: () => void; onChange: (day: RoutineDay) => void; preset?: RoutinePreset; sequenceOnly?: boolean; initialStepId?: string; addOnOpen?: boolean; copyFrom?: () => void;
}) {
  const t = useTranslation(), confirm = useAppearanceConfirmation();
  const formRef=useRef<ExerciseFormHandle>(null);
  const [draft, setDraft] = useState<RoutineDay>(() => ({ type: day.type, exercises: day.exercises.map(exercise => ({ ...exercise })) }));
  const [baseline] = useState(() => JSON.stringify(day));
  const [editing, setEditing] = useState<ExerciseDraft | null>(() => {
    const position = day.exercises.findIndex(step => step.id === initialStepId);
    const value = position >= 0 ? { ...day.exercises[position] } : addOnOpen ? { id: engine().createOperationId(), name: '', target: '', notes: '', illustration: '' } : null;
    return value ? { value, position: position >= 0 ? position : day.exercises.length, initial: JSON.stringify({ value, position: position >= 0 ? position : day.exercises.length }), isNew: position < 0 } : null;
  }), [illustrationOpen, setIllustrationOpen] = useState(false);
  const [removed, setRemoved] = useState<{ exercise: RoutineExercise; index: number } | null>(null);
  const valid = draft.type === 'Rest' || draft.exercises.length > 0 && draft.exercises.length <= MAX_ROUTINE_EXERCISES_PER_DAY && draft.exercises.every(exercise => exercise.name.trim());
  const canAdd = canAddRoutineExercise(draft.exercises.length, !!removed);
  const discard = (dirty: boolean, close: () => void) => {
    Keyboard.dismiss();
    if (!dirty) { close(); return; }
    confirm(t('routine_child_discard_title'), t('routine_child_discard_hint'), [
      { text: t('m_e76fd2add010'), style: 'cancel' }, { text: t('m_eb1a70e39274'), style: 'destructive', onPress: close },
    ]);
  };
  const closeExercise = () => { if (editing) discard(!!formRef.current?.dirty() || JSON.stringify({ value: editing.value, position: editing.position }) !== editing.initial, () => setEditing(null)); };
  const closeDay = () => discard(JSON.stringify(draft) !== baseline, onClose);
  const close = () => { if (illustrationOpen) setIllustrationOpen(false); else if (editing) closeExercise(); else closeDay(); };
  const patchExercise = (value: Partial<RoutineExercise>) => setEditing(current => current ? { ...current, value: { ...current.value, ...value } } : null);
  const beginExercise = (value: RoutineExercise, position: number, isNew = false) => setEditing({ value: { ...value }, position,
    initial: JSON.stringify({ value, position }), isNew });
  const applyExercise = () => {
    if (!editing?.value.name.trim()) return;
    const value=formRef.current?.validate();if(!value)return;
    const exercises = draft.exercises.filter(exercise => exercise.id !== editing.value.id);
    exercises.splice(editing.position, 0, value);
    setDraft({ type: 'Exercises', exercises }); setEditing(null); Keyboard.dismiss();
  };
  useExerciseImageLeases([...draft.exercises, ...(editing ? [editing.value] : [])]);
  return <Sheet title={editing ? t(preset === 'General' ? 'routine_step_editor' : 'routine_exercise_editor_title') : sequenceOnly && index < 0 ? t(preset === 'General' ? 'routine_steps' : 'routine_sequence') : t(preset === 'General' ? 'routine_day_steps' : 'routine_day_editor_title', { day: t(routineDayKeys[Math.max(0, index)]) })}
    visible onClose={close} onBack={close} footer={<View style={{ padding: 16, gap: 8 }}>
      <Button label={t(editing?.isNew ? preset === 'General' ? 'routine_add_step' : 'routine_child_add' : 'routine_child_done')} disabled={editing ? !editing.value.name.trim() : !valid} onPress={() => {
        Keyboard.dismiss(); if (editing) applyExercise(); else onChange(draft);
      }} />
      <Button label={t('m_19766ed6ccb2')} variant="neutral" onPress={editing ? closeExercise : closeDay} />
    </View>}>
    <Copy muted size={14}>{t('routine_plan_local_hint')}</Copy>
    {editing ? <View style={{ gap: 12 }}>
      <View accessibilityLiveRegion="polite"><Copy muted size={14}>{t('routine_ordinal', { current: editing.position + 1, total: draft.exercises.length + (editing.isNew ? 1 : 0) })}</Copy></View>
      <RoutineExerciseForm key={editing.value.id} formRef={formRef} exercise={editing.value} preset={preset} onChange={patchExercise} imageOpen={illustrationOpen} onImageOpenChange={setIllustrationOpen} />
      {!editing.isNew && <ConnectedGroup>
        <SettingRow intent="action" key="up" label={t('routine_move_up')} disabled={editing.position === 0} onPress={() => setEditing({ ...editing, position: editing.position - 1 })} />
        <SettingRow intent="action" key="down" label={t('routine_move_down')} disabled={editing.position >= draft.exercises.length - 1} onPress={() => setEditing({ ...editing, position: editing.position + 1 })} />
        <SettingRow intent="action" key="remove" label={t(preset === 'General' ? 'routine_remove_step' : 'routine_remove_exercise')} icon="remove_circle_outline" onPress={() => {
          const position = draft.exercises.findIndex(exercise => exercise.id === editing.value.id);
          setRemoved({ exercise: draft.exercises[position], index: position });
          setDraft({ ...draft, exercises: draft.exercises.filter(exercise => exercise.id !== editing.value.id) }); setEditing(null);
        }} />
      </ConnectedGroup>}
    </View> : <View style={{ gap: 12 }}>
      {!sequenceOnly && <Copy muted size={14}>{t('routine_day_editor_hint')}</Copy>}
      {!sequenceOnly && <ConnectedGroup>
        <Choice key="exercises" label={t('routine_exercises')} selected={draft.type === 'Exercises'} onPress={() => setDraft({ ...draft, type: 'Exercises' })} />
        <Choice key="rest" label={t('routine_rest')} selected={draft.type === 'Rest'} onPress={() => setDraft({ ...draft, type: 'Rest' })} />
      </ConnectedGroup>}
      {draft.type === 'Exercises' && <>
        <ConnectedGroup>{draft.exercises.map((exercise, position) => <RoutineBuilderStepRow key={exercise.id} exercise={exercise} position={position} total={draft.exercises.length} onPress={() => beginExercise(exercise, position)} />)}</ConnectedGroup>
        {removed && <View accessibilityLiveRegion="polite"><Copy>{t('routine_exercise_removed_named', { name: removed.exercise.name })}</Copy>
          <Button label={t('routine_undo_removed_named', { name: removed.exercise.name })} icon="undo" variant="secondary" onPress={() => {
            const exercises = [...draft.exercises]; exercises.splice(removed.index, 0, removed.exercise); setDraft({ ...draft, exercises }); setRemoved(null);
          }} /></View>}
        <Button label={t(preset === 'General' ? 'routine_add_step' : 'routine_add_exercise')} icon="add" variant="secondary" disabled={!canAdd}
          onPress={() => { if (canAdd) beginExercise({ id: engine().createOperationId(), name: '', target: '', notes: '', illustration: '' }, draft.exercises.length, true); }} />
        {!canAdd && !!removed && canAddRoutineExercise(draft.exercises.length) && <Copy muted size={14}>{t('routine_undo_capacity_hint')}</Copy>}
        {copyFrom && <Button label={t('routine_copy_steps')} variant="neutral" onPress={() => discard(JSON.stringify(draft) !== baseline, copyFrom)} />}
      </>}
    </View>}
  </Sheet>;
}
