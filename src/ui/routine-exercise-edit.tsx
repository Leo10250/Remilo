import { useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { RoutineExercise, RoutinePlan } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { editableRoutineExercise, routineExerciseEditCommand, type RoutineExerciseEditContext } from '../domain/routine-exercise-edit';
import { useTranslation } from '../localization/react';
import { errorText } from '../localization';
import { ActionFeedback, Button, Copy, Sheet } from './components';
import { useAppearanceConfirmation } from './confirmation';
import { useExerciseImageLeases } from './exercise-images';
import { engine } from './native';
import { CommandRecovery, useCapturedCommand } from './navigation';
import { RoutineExerciseForm, routineDayKeys } from './routine-editor';
import type { ExerciseFormHandle } from './exercise-target-fields';
import { validExercise } from '../domain/exercise-target';

type LoadedExercise = { target: RoutineExerciseEditContext; plan: RoutinePlan | null; draft: RoutineExercise | null; baseline: string; error: string; request:number };

/** Kept mounted after close so Sheet can restore focus to the initiating row. */
export function RoutineExerciseEditSheet({ target, onClose, returnFocusRef }: {
  target: RoutineExerciseEditContext | null; onClose: () => void; returnFocusRef: RefObject<View | null>;
}) {
  const t = useTranslation(), confirm = useAppearanceConfirmation(), client = useQueryClient();
  const [loaded, setLoaded] = useState<LoadedExercise | null>(null), [reloading, setReloading] = useState(false), [imageOpen, setImageOpen] = useState(false);
  const generation = useRef(0);
  const formRef=useRef<ExerciseFormHandle>(null),[targetDirty,setTargetDirty]=useState(false);
  // Context identity is a new request boundary even when the same row is reopened.
  const data = target && loaded?.target === target ? loaded : null;
  const draft = data?.draft, loading = !!target && (!data || reloading);
  const action = useCapturedCommand((_job, result) => {
    if (result.status === 'Applied' || result.status === 'Blocked') {
      void client.invalidateQueries({ queryKey: ['routine-session'] }); onClose(); return false;
    }
  });
  useExerciseImageLeases(draft ? [draft] : []);
  const load = async (context: RoutineExerciseEditContext, request: number, active: () => boolean = () => true) => {
    try {
      const plan = (await engine().queryRoutines()).find(value => value.id === context.routineId);
      const exercise = plan && editableRoutineExercise(plan, context);
      if (!active() || generation.current !== request) return;
      if (!exercise || !plan) throw new Error(t('routine_edit_unavailable'));
      action.clearFeedback(); setTargetDirty(false);setLoaded({ target: context, plan, draft: { ...exercise }, baseline: JSON.stringify(exercise), error: '',request });
    } catch (reason) {
      if (active() && generation.current === request) setLoaded({ target: context, plan: null, draft: null, baseline: '', error: errorText(reason, t('routine_load_error')),request });
    } finally { if (active() && generation.current === request) setReloading(false); }
  };
  useEffect(() => {
    let active = true;
    if (target) void load(target, ++generation.current, () => active);
    return () => { active = false; };
    // A captured request owns its draft. Changes to authored fields must not reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const dirty = !!draft && (targetDirty || JSON.stringify(draft) !== data?.baseline);
  const discardThen = (next: () => void) => {
    Keyboard.dismiss();
    if (action.isGuarded()) return;
    if (!dirty) { next(); return; }
    confirm(t('routine_child_discard_title'), t('routine_child_discard_hint'), [
      { text: t('m_e76fd2add010'), style: 'cancel' }, { text: t('m_eb1a70e39274'), style: 'destructive', onPress: next },
    ]);
  };
  const close = () => { if (imageOpen) setImageOpen(false); else discardThen(onClose); };
  const save = () => {
    if (!target || !data?.plan || !draft?.name.trim() || action.isGuarded() || loading) return;
    Keyboard.dismiss();
    const value=formRef.current?.validate();if(!value||!validExercise(value))return;
    void action.execute({ command: routineExerciseEditCommand(data.plan, target, value, engine().createOperationId()), success: t('routine_saved_changes') });
  };
  return <Sheet title={t(data?.plan?.presentationPreset === 'General' ? 'routine_step_editor' : 'routine_edit_exercise')} visible={!!target} onClose={close} onBack={close} returnFocusRef={returnFocusRef}
    footer={<View style={{ padding: 16, gap: 8 }}>
      <Button label={t('m_1509f561f241')} busy={action.busy} disabled={loading || !draft?.name.trim() || action.guarded || !!data?.error || action.feedback?.tone === 'danger'} onPress={save} />
      <Button label={t('m_19766ed6ccb2')} variant="neutral" disabled={action.guarded} onPress={close} />
    </View>}>
    {target && <Copy muted size={14}>{t('routine_edit_day_context', { day: t(routineDayKeys[target.weekday]) })}</Copy>}
    <Copy muted size={14}>{t('routine_edit_immediate_hint')}</Copy>
    {data?.plan?.authoringMode==='Shared'&&<Copy muted size={14}>{t('routine_independent_notice')}</Copy>}
    <ActionFeedback loading={loading} message={data?.error || undefined} tone={data?.error ? 'danger' : 'muted'} />
    {!!data && <CommandRecovery action={action} />}
    {!action.guarded && target && (data?.error || action.feedback?.tone === 'danger') && <Button label={t('routine_reload_exercise')} variant="neutral"
      onPress={() => discardThen(() => { setReloading(true); action.clearFeedback(); void load(target, ++generation.current); })} />}
    {draft && <RoutineExerciseForm key={`${draft.id}:${data?.request}`} formRef={formRef} onDirtyChange={setTargetDirty} exercise={draft} preset={data?.plan?.presentationPreset} disabled={action.guarded || loading} imageOpen={imageOpen} onImageOpenChange={setImageOpen}
      onChange={patch => { if (!action.isGuarded()) setLoaded(value => value?.target === target && value.draft ? { ...value, draft: { ...value.draft, ...patch } } : value); }} />}
  </Sheet>;
}
