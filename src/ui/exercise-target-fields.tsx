import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Keyboard, TextInput, View, useWindowDimensions } from 'react-native';
import type { RoutineExercise } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { applyTargetFields, exerciseTargetText, numericTargetInput, targetFieldErrors, targetFields, type ExerciseTargetFields } from '../domain/exercise-target';
import { useTranslation } from '../localization/react';
import { ActionFeedback, Button, CheckRow, Choice, ConnectedGroup, Copy, Disclosure, Field, PickerField, Sheet, singleLineFieldMetrics } from './components';
import { useAppearanceConfirmation } from './confirmation';
import { useFontScaleOverride } from './theme';

export type ExerciseFormHandle = { validate: () => RoutineExercise | undefined; dirty: () => boolean };
export function ExerciseTargetFieldsView({ exercise, general, onChange, disabled, formRef, onDirtyChange }: {
  exercise: RoutineExercise; general: boolean; onChange: (patch: Partial<RoutineExercise>) => void; disabled: boolean;
  formRef?: Ref<ExerciseFormHandle>; onDirtyChange?: (dirty: boolean) => void;
}) {
  const t = useTranslation(), confirm = useAppearanceConfirmation(), { width, fontScale } = useWindowDimensions(), scale = useFontScaleOverride();
  const [original] = useState(() => targetFields(exercise,general)), [fields,setFields] = useState(original);
  const [attempted,setAttempted] = useState(false), [touched,setTouched] = useState<string[]>([]), [picker,setPicker] = useState<'unit' | 'weightUnit' | null>(null);
  const refs = useRef<Partial<Record<keyof ExerciseTargetFields,TextInput | null>>>({});
  const pickerTrigger=useRef<View|null>(null),unitTrigger=useRef<View|null>(null),weightTrigger=useRef<View|null>(null);
  const stacked = Math.max(scale,fontScale) > 1.2 || width < 360;
  const errors = targetFieldErrors(fields), dirty = JSON.stringify(fields) !== JSON.stringify(original);
  const message = (key: keyof ExerciseTargetFields) => (attempted || touched.includes(key)) && errors[key] ? t(errors[key] === 'integer' ? 'exercise_integer_error' : errors[key] === 'range' ? 'exercise_range_error' : errors[key] === 'side' ? 'exercise_side_error' : errors[key] === 'length' ? 'exercise_length_error' : 'exercise_number_error') : undefined;
  const update = (patch: Partial<ExerciseTargetFields>) => {
    const next = { ...fields,...patch };setFields(next);onDirtyChange?.(JSON.stringify(next) !== JSON.stringify(original));
    if (!Object.keys(targetFieldErrors(next)).length) { const value=applyTargetFields(exercise,next,original);onChange({target:value.target,exerciseTarget:value.exerciseTarget}); }
  };
  useImperativeHandle(formRef,() => ({ dirty:() => dirty, validate:() => {
    setAttempted(true);const first=Object.keys(errors)[0] as keyof ExerciseTargetFields | undefined;
    if(first) { refs.current[first==='eachSide'?'reps':first]?.focus();return; }
    return applyTargetFields(exercise,fields,original);
  } }));
  const switchMode = () => {
    const next=fields.mode === 'Text' ? 'Numeric' : 'Text';
    const apply=() => update({mode:next});
    if(fields.mode === 'Text' ? !!fields.custom.trim() : !!exerciseTargetText(applyTargetFields(exercise,fields,original))) confirm(t('exercise_replace_target'),t('exercise_replace_target_hint'),[
      {text:t('m_19766ed6ccb2'),style:'cancel'},{text:t('exercise_replace'),onPress:apply},
    ]);else apply();
  };
  const numeric = (key:'sets'|'reps'|'repsMax'|'duration'|'weight',label:string,placeholder:string) => <View style={{flex:1,minWidth:0}}><Field
    inputRef={value=>{refs.current[key]=value;}} label={label} value={fields[key]} placeholder={placeholder} editable={!disabled} maxLength={32}
    keyboardType={key==='sets'||key==='reps'||key==='repsMax'?'number-pad':'decimal-pad'} inputMode={key==='sets'||key==='reps'||key==='repsMax'?'numeric':'decimal'}
    autoCorrect={false} autoCapitalize="none" autoComplete="off" spellCheck={false} style={singleLineFieldMetrics(scale)} error={message(key)}
    onBlur={()=>setTouched(current=>[...current,key])} onChangeText={value=>update({[key]:numericTargetInput(fields[key],value,key==='sets'||key==='reps'||key==='repsMax')})} /></View>;
  const unitLabel = fields.unit === 'sec' ? t('exercise_seconds') : fields.unit === 'min' ? t('exercise_minutes') : t('exercise_hours');
  const value=Object.keys(errors).length ? undefined : applyTargetFields(exercise,fields,original);
  return <View style={{gap:12}}>
    {fields.mode==='Text' ? <>
      <Field inputRef={value=>{refs.current.custom=value;}} label={t(general?'routine_step_amount':'exercise_custom')} value={fields.custom} maxLength={1000} multiline compactMultiline editable={!disabled}
        placeholder={t(general?'routine_step_amount_example':'exercise_additional_example')} error={message('custom')} onChangeText={custom=>update({custom})} />
      {!general&&<Button label={t('exercise_use_numeric')} variant="neutral" disabled={disabled} onPress={switchMode} />}
    </> : <>
      <Copy muted size={14}>{t('exercise_optional_targets')}</Copy>
      <View style={{flexDirection:stacked?'column':'row',gap:12}}>{numeric('sets',t('exercise_sets'),'3')}{numeric('reps',t('exercise_reps'),'10')}</View>
      <View style={{flexDirection:stacked?'column':'row',gap:12}}>{numeric('duration',t('exercise_time'),'40')}<View style={{flex:1,minWidth:0}}><PickerField buttonRef={unitTrigger} label={t('exercise_unit_label')} accessibilityLabel={t('exercise_unit')} value={unitLabel} disabled={disabled} onPress={()=>{Keyboard.dismiss();pickerTrigger.current=unitTrigger.current;setPicker('unit');}} /></View></View>
      <Disclosure title={t('exercise_more_targets')} initial={!!(fields.range||fields.eachSide||fields.weight||fields.additionalText)}>
        <ConnectedGroup><CheckRow label={t('exercise_rep_range')} selected={fields.range} disabled={disabled} onPress={()=>update({range:!fields.range})} /></ConnectedGroup>
        {fields.range&&numeric('repsMax',t('exercise_reps_max'),'12')}
        <ConnectedGroup><CheckRow label={t('exercise_each_side')} selected={fields.eachSide} disabled={disabled} onPress={()=>update({eachSide:!fields.eachSide})} /></ConnectedGroup>
        {!!message('eachSide')&&<ActionFeedback tone="danger" message={message('eachSide')}/>}
        <View style={{flexDirection:stacked?'column':'row',gap:12}}>{numeric('weight',t('exercise_weight'),'35')}<View style={{flex:1,minWidth:0}}><PickerField buttonRef={weightTrigger} label={t('exercise_unit_label')} accessibilityLabel={t('exercise_weight_unit')} value={fields.weightUnit} disabled={disabled} onPress={()=>{Keyboard.dismiss();pickerTrigger.current=weightTrigger.current;setPicker('weightUnit');}} /></View></View>
        <Field inputRef={value=>{refs.current.additionalText=value;}} label={t('exercise_additional')} value={fields.additionalText} placeholder={t('exercise_additional_example')} maxLength={1000} multiline compactMultiline editable={!disabled} onChangeText={additionalText=>update({additionalText})} />
        <Button label={t('exercise_use_custom')} variant="neutral" disabled={disabled} onPress={switchMode} />
      </Disclosure>
      <View accessibilityLiveRegion="polite"><Copy muted size={14}>{value?exerciseTargetText(value)||t('exercise_no_target'):t('exercise_no_target')}</Copy></View>
    </>}
    <Sheet title={t(picker==='unit'?'exercise_unit':'exercise_weight_unit')} visible={picker!==null} onClose={()=>setPicker(null)} returnFocusRef={pickerTrigger}><ConnectedGroup>
      {picker==='unit'?(['sec','min','hr'] as const).map(unit=><Choice key={unit} label={t(unit==='sec'?'exercise_seconds':unit==='min'?'exercise_minutes':'exercise_hours')} selected={fields.unit===unit} onPress={()=>{update({unit});setPicker(null);}} />):(['kg','lb'] as const).map(weightUnit=><Choice key={weightUnit} label={weightUnit} selected={fields.weightUnit===weightUnit} onPress={()=>{update({weightUnit});setPicker(null);}} />)}
    </ConnectedGroup></Sheet>
  </View>;
}
