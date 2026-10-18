import { useState } from 'react';
import { Keyboard, View } from 'react-native';
import type { RoutinePreset } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { canChangeRoutineArrangement, copyRoutineDay, replaceSharedSteps, selectRoutineDays, shareRoutineStepsFrom, separateRoutineDays, type RoutineBuilder } from '../domain/routine-builder';
import { useTranslation } from '../localization/react';
import { Button, CheckRow, Choice, ConnectedGroup, Copy, SettingRow, Sheet, Toggle } from './components';
import { RoutineBuilderStepRow, RoutineDayEditor, routineDayKeys } from './routine-editor';
import { engine } from './native';

export function RoutinePresetField({ value, onChange, disabled }: { value: RoutinePreset; onChange: (value: RoutinePreset) => void; disabled?: boolean }) {
  const t = useTranslation(), [open, setOpen] = useState(false);
  return <><ConnectedGroup><SettingRow intent="picker" label={t('routine_preset')} value={t(value === 'General' ? 'routine_general' : 'routine_exercise_preset')} disabled={disabled} onPress={() => { Keyboard.dismiss(); setOpen(true); }} /></ConnectedGroup>
    <Sheet title={t('routine_preset')} visible={open} onClose={() => setOpen(false)}><ConnectedGroup>
      {(['General', 'Exercise'] as const).map(preset => <Choice key={preset} label={t(preset === 'General' ? 'routine_general' : 'routine_exercise_preset')}
        description={t(preset === 'General' ? 'routine_general_help' : 'routine_exercise_preset_help')} selected={value === preset} onPress={() => { onChange(preset); setOpen(false); }} />)}
    </ConnectedGroup></Sheet></>;
}

export function RoutineDaysField({ value, onChange, disabled }: { value: RoutineBuilder; onChange: (value: RoutineBuilder) => void; disabled?: boolean }) {
  const t = useTranslation(), [selected, setSelected] = useState<number[] | null>(null);
  const days = value.days.flatMap((day, i) => day.type === 'Exercises' ? [i] : []);
  return <><SettingRow intent="picker" label={t('routine_days')} icon="repeat" disabled={disabled}
    value={days.length === 7 ? t('routine_every_day') : days.map(i => t(routineDayKeys[i])).join(' · ') || t('routine_choose_days')}
    onPress={() => { Keyboard.dismiss(); setSelected(days); }} />
    <Sheet title={t('routine_choose_days')} visible={selected !== null} onClose={() => setSelected(null)} footer={<View style={{ padding: 16, gap: 8 }}>
      <Button label={t('routine_child_done')} onPress={() => { if (selected) onChange(selectRoutineDays(value, selected, () => engine().createOperationId())); setSelected(null); }} />
      <Button label={t('m_19766ed6ccb2')} variant="neutral" onPress={() => setSelected(null)} />
    </View>}><ConnectedGroup>{routineDayKeys.map((key, i) => <CheckRow key={key} label={t(key)} description={value.authoringMode === 'ByWeekday' && value.days[i].exercises.length ? value.days[i].exercises.slice(0, 2).map(step => step.name).join(' · ') : undefined} selected={!!selected?.includes(i)} onPress={() => setSelected(current => current?.includes(i) ? current.filter(day => day !== i) : [...current ?? [], i])} />)}</ConnectedGroup></Sheet></>;
}

export function RoutineBuilderFields({ value, onChange, disabled = false }: { value: RoutineBuilder; onChange: (value: RoutineBuilder) => void; disabled?: boolean }) {
  const t = useTranslation(), [editing, setEditing] = useState<{ index: number; stepId?: string; add?: boolean } | null>(null);
  const [source, setSource] = useState<{ target: number | null; day: number | null } | null>(null);
  const shared = value.authoringMode === 'Shared', general = value.presentationPreset === 'General';
  const allocate = () => engine().createOperationId();
  const active = value.days.flatMap((day, index) => day.type === 'Exercises' ? [index] : []);
  const sources = active.filter(index => value.days[index].exercises.length && index !== source?.target);
  const replaced = source?.target === null ? active.filter(i => i !== source.day) : source ? [source.target] : [];
  const open = (index: number, stepId?: string, add?: boolean) => { Keyboard.dismiss(); setEditing({ index, stepId, add }); };
  const switchMode = () => {
    if (!canChangeRoutineArrangement(value)) return;
    Keyboard.dismiss();
    if (shared) onChange(separateRoutineDays(value));
    else if (!active.some(i => value.days[i].exercises.length)) onChange(shareRoutineStepsFrom(value, null, allocate));
    else setSource({ target: null, day: null });
  };
  return <View style={{ gap: 12 }}>
    <ConnectedGroup title={t(shared ? general ? 'routine_steps' : 'routine_sequence' : 'routine_weekly_plan')}>
      {shared ? value.sharedSteps.map((step, i) => <RoutineBuilderStepRow key={step.id} exercise={step} position={i} total={value.sharedSteps.length} disabled={disabled} onPress={() => open(-1, step.id)} />) : active.map(index => {
        const steps = value.days[index].exercises;
        return <SettingRow key={index} intent="navigation" minHeight={64} label={t(routineDayKeys[index])} value={t('routine_step_count', { count: steps.length })}
          description={steps.slice(0, 2).map(step => step.name).join(' · ') || t('routine_first_step')} disabled={disabled} onPress={() => open(index)} />;
      })}
    </ConnectedGroup>
    {shared && !value.sharedSteps.length && <Copy muted size={14}>{t('routine_first_step')}</Copy>}
    {shared && <Button label={t(general ? 'routine_add_step' : 'routine_add_exercise')} icon="add" variant="secondary" disabled={disabled || value.sharedSteps.length >= 100} onPress={() => open(-1, undefined, true)} />}
    {!shared && !active.length && <Copy muted size={14}>{t('routine_choose_days')}</Copy>}
    <ConnectedGroup><Toggle label={t('routine_different_days')} value={!shared} disabled={disabled || !canChangeRoutineArrangement(value)} onChange={switchMode} /></ConnectedGroup>
    {!canChangeRoutineArrangement(value) && <Copy muted size={14}>{t('routine_choose_days')}</Copy>}
    {shared && <Copy muted size={14}>{t('routine_shared_hint')}</Copy>}
    {editing && <RoutineDayEditor key={JSON.stringify(editing)} index={editing.index} day={editing.index < 0 ? { type: 'Exercises', exercises: value.sharedSteps } : value.days[editing.index]}
      sequenceOnly preset={value.presentationPreset} initialStepId={editing.stepId} addOnOpen={editing.add} onClose={() => setEditing(null)}
      copyFrom={editing.index < 0 || !active.some(i => i !== editing.index && value.days[i].exercises.length) ? undefined : () => { setSource({ target: editing.index, day: null }); setEditing(null); }}
      onChange={day => { onChange(editing.index < 0 ? replaceSharedSteps(value, day.exercises, allocate) : { ...value, days: value.days.map((current, i) => i === editing.index ? day : current) }); setEditing(null); }} />}
    <Sheet title={t(source?.target === null ? 'routine_use_shared' : 'routine_copy_steps')} visible={!!source} onClose={() => setSource(null)}
      footer={<View style={{ padding: 16, gap: 8 }}><Button label={t('routine_use_these_steps')} disabled={source?.day == null} onPress={() => {
        if (source?.day != null) onChange(source.target === null ? shareRoutineStepsFrom(value, source.day, allocate) : copyRoutineDay(value, source.day, source.target, allocate));
        setSource(null);
      }} /><Button label={t('m_19766ed6ccb2')} variant="neutral" onPress={() => setSource(null)} /></View>}>
      <ConnectedGroup>{sources.map(index => <Choice key={index} label={t(routineDayKeys[index])} selected={source?.day === index} onPress={() => setSource(current => current ? { ...current, day: index } : null)} />)}</ConnectedGroup>
      {source?.day != null && <>{!!replaced.length && <Copy muted>{t('routine_replace_days_hint', { days: replaced.map(i => t(routineDayKeys[i])).join(' · ') })}</Copy>}
        {value.days[source.day].exercises.map(step => <View key={step.id}><Copy>{step.name}</Copy>{!!step.target && <Copy muted size={14}>{step.target}</Copy>}</View>)}</>}
      {!sources.length && <Copy muted>{t('routine_first_step')}</Copy>}
    </Sheet>
  </View>;
}
