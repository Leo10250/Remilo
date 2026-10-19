import { useRef, useState, type Ref } from 'react';
import { Keyboard, Pressable, View, useWindowDimensions } from 'react-native';
import type { RoutineExercise, RoutinePreset } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { cloneRoutineStep, copyRoutineDays, routineDayWithSteps, type RoutineBuilder } from '../domain/routine-builder';
import { canAddRoutineExercise } from '../domain/routine-editor-draft';
import { exerciseTargetText, validExercise } from '../domain/exercise-target';
import { useTranslation } from '../localization/react';
import { BottomActionBar, Button, CheckRow, Choice, ConnectedGroup, Copy, Icon, IconButton, SettingRow, Sheet } from './components';
import { RoutineBuilderStepRow, RoutineExerciseForm, routineDayKeys } from './routine-editor';
import { useAppearanceConfirmation } from './confirmation';
import type { ExerciseFormHandle } from './exercise-target-fields';
import { useExerciseImageLeases } from './exercise-images';
import { useFontScaleOverride, useTheme } from './theme';
import { engine } from './native';

const shortDays=['routine_short_mon','routine_short_tue','routine_short_wed','routine_short_thu','routine_short_fri','routine_short_sat','routine_short_sun'] as const;
// Empty grid slots need the same border/padding budget as populated cells.
const dayTabCellStyle={flex:1,minWidth:48,paddingHorizontal:2,borderWidth:2,borderColor:'transparent'};
export function RoutinePresetField({ value, onChange, disabled }: { value: RoutinePreset; onChange: (value: RoutinePreset) => void; disabled?: boolean }) {
  const t = useTranslation(), [open, setOpen] = useState(false);
  return <><ConnectedGroup><SettingRow intent="picker" label={t('routine_purpose')} value={t(value === 'General' ? 'routine_general' : 'routine_exercise_preset')} disabled={disabled} onPress={() => { Keyboard.dismiss(); setOpen(true); }} /></ConnectedGroup>
    <Sheet title={t('routine_purpose')} visible={open} onClose={() => setOpen(false)}><ConnectedGroup>
      {(['General', 'Exercise'] as const).map(preset => <Choice key={preset} label={t(preset === 'General' ? 'routine_general' : 'routine_exercise_preset')}
        description={t(preset === 'General' ? 'routine_general_help' : 'routine_exercise_preset_help')} selected={value === preset} onPress={() => { onChange(preset); setOpen(false); }} />)}
    </ConnectedGroup></Sheet></>;
}

function TextAction({ label,onPress,disabled=false,buttonRef,icon='content_copy' }: { label:string;onPress:()=>void;disabled?:boolean;buttonRef?:Ref<View>;icon?:'content_copy'|'undo' }) {
  const colors=useTheme(),[focused,setFocused]=useState(false);
  return <Pressable ref={buttonRef} accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}} onPress={()=>{Keyboard.dismiss();onPress();}}
    onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} style={({pressed})=>({minHeight:48,minWidth:48,padding:8,borderRadius:12,borderWidth:2,borderColor:focused?colors.accent:'transparent',
      backgroundColor:pressed?colors.soft:'transparent',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:disabled ? .38 : 1})}>
    <Icon name={icon} size={20}/><View style={{flexShrink:1}}><Copy muted size={14}>{label}</Copy></View>
  </Pressable>;
}

type Editing = {day:number;value:RoutineExercise;position:number;initial:string;isNew:boolean};
type CopyDraft = {kind:'to'|'from'|'review';source:number;targets:number[];steps:RoutineExercise[];before:{day:number;steps:RoutineExercise[]}[]};
/** Tabs select a local sequence. Only the owning route can persist it. */
export function RoutineBuilderFields({ value, onChange, disabled = false, initialDay=0 }: { value: RoutineBuilder; onChange: (value: RoutineBuilder) => void; disabled?: boolean; initialDay?:number }) {
  const t=useTranslation(),confirm=useAppearanceConfirmation(),scale=useFontScaleOverride(),{width,fontScale}=useWindowDimensions();
  const [selected,setSelected]=useState(initialDay),[available,setAvailable]=useState(width-32),[editing,setEditing]=useState<Editing|null>(null),[imageOpen,setImageOpen]=useState(false),[options,setOptions]=useState(false);
  const [removed,setRemoved]=useState<{day:number;step:RoutineExercise;index:number}|null>(null),[copy,setCopy]=useState<CopyDraft|null>(null),[feedback,setFeedback]=useState('');
  const formRef=useRef<ExerciseFormHandle>(null),trigger=useRef<View|null>(null),copyTrigger=useRef<View|null>(null),addTrigger=useRef<View|null>(null),rows=useRef(new Map<string,View>()),focusId=useRef<string|null>(null);
  const steps=value.days[selected].exercises,general=value.presentationPreset==='General';
  const columns=Math.max(scale,fontScale)>1.2||Math.floor(available)<7*48+6*2?4:7,gap=columns===4?4:2;
  const canAdd=canAddRoutineExercise(steps.length,removed?.day===selected),sourceDays=value.days.flatMap((day,index)=>index!==selected&&day.exercises.length?[index]:[]);
  const patch=(days:RoutineBuilder['days'])=>onChange({...value,authoringMode:'ByWeekday',sharedSteps:[],days});
  const setSteps=(day:number,list:RoutineExercise[])=>patch(value.days.map((current,i)=>i===day?routineDayWithSteps(list):current));
  const open=(index:number|null)=>{
    Keyboard.dismiss();const step=index===null?{id:engine().createOperationId(),name:'',target:'',notes:'',illustration:''}:cloneRoutineStep(steps[index]);
    const position=index??steps.length;trigger.current=index===null?addTrigger.current:rows.current.get(step.id)??null;focusId.current=step.id;
    setEditing({day:selected,value:step,position,initial:JSON.stringify({value:step,position}),isNew:index===null});setFeedback('');
  };
  const finishClose=()=>{setEditing(null);setOptions(false);setImageOpen(false);};
  const close=()=>{
    if(imageOpen){setImageOpen(false);return;}if(options){setOptions(false);return;}
    if(!editing)return;
    if(formRef.current?.dirty()||JSON.stringify({value:editing.value,position:editing.position})!==editing.initial)confirm(t('routine_child_discard_title'),t('routine_child_discard_hint'),[
      {text:t('m_e76fd2add010'),style:'cancel'},{text:t('m_eb1a70e39274'),style:'destructive',onPress:finishClose},
    ]);else finishClose();
  };
  const apply=()=>{
    if(!editing)return;const step=formRef.current?.validate();if(!step||!validExercise(step))return;
    const list=value.days[editing.day].exercises.filter(row=>row.id!==step.id);list.splice(editing.position,0,step);
    setSteps(editing.day,list);setSelected(editing.day);trigger.current=rows.current.get(step.id)??addTrigger.current;finishClose();
  };
  const applyCopy=(captured:CopyDraft)=>{
    onChange(copyRoutineDays(value,captured.steps,captured.targets,()=>engine().createOperationId()));
    if(removed&&captured.targets.includes(removed.day))setRemoved(null);
    setFeedback(t('routine_copied_days',{days:captured.targets.map(day=>t(routineDayKeys[day])).join(' · ')}));setCopy(null);
  };
  const reviewCopy=()=>{
    if(!copy||!copy.targets.length)return;
    const captured={...copy,kind:'review' as const,steps:value.days[copy.source].exercises.map(cloneRoutineStep),before:copy.targets.map(day=>({day,steps:value.days[day].exercises.map(cloneRoutineStep)}))};
    if(captured.before.some(day=>day.steps.length))setCopy(captured);else applyCopy(captured);
  };
  useExerciseImageLeases([...(editing?[editing.value]:[]),...(removed?[removed.step]:[]),...(copy?.steps??[]),...(copy?.before.flatMap(day=>day.steps)??[])]);
  return <View style={{gap:12}}>
    <View style={{gap:8}}><Copy heading size={18}>{t('routine_weekly_plan')}</Copy>
      <View onLayout={event=>setAvailable(event.nativeEvent.layout.width)} style={{gap}}>
        {/* Explicit rows avoid Yoga wrapping the last fractional-width tab onto its own line. */}
        {Array.from({length:Math.ceil(routineDayKeys.length/columns)},(_,row)=><View key={row} style={{flexDirection:'row',gap}}>
          {Array.from({length:columns},(_,column)=>{
            const index=row*columns+column,key=routineDayKeys[index];
            return key?<DayTab key={key} label={t(shortDays[index])} status={t('routine_day_tab_label',{day:t(key),status:value.days[index].exercises.length?t('routine_step_count',{count:value.days[index].exercises.length}):t('routine_not_scheduled')})}
              populated={!!value.days[index].exercises.length} selected={selected===index} disabled={disabled} onPress={()=>{Keyboard.dismiss();setSelected(index);setFeedback('');}} />:
              <View key={column} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={dayTabCellStyle}/>;
          })}
        </View>)}
      </View>
    </View>
    <View style={{gap:12}}><View style={{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
      <Copy heading size={18}>{t(routineDayKeys[selected])}</Copy>
      {steps.length?<TextAction buttonRef={copyTrigger} label={t('routine_copy_to')} disabled={disabled} onPress={()=>setCopy({kind:'to',source:selected,targets:[],steps:[],before:[]})}/>:<Copy muted size={14}>{t('routine_not_scheduled')}</Copy>}
    </View>
    {!!steps.length&&<ConnectedGroup>{steps.map((step,index)=><RoutineBuilderStepRow key={step.id} buttonRef={node=>{if(node){rows.current.set(step.id,node);if(focusId.current===step.id)trigger.current=node;}else rows.current.delete(step.id);}}
      exercise={step} position={index} total={steps.length} disabled={disabled} onPress={()=>open(index)}/>)}</ConnectedGroup>}
    <Button buttonRef={addTrigger} label={t(general?'routine_step_add_builder':'routine_exercise_add_builder')} variant="secondary" disabled={disabled||!canAdd} onPress={()=>open(null)}/>
    {!canAdd&&removed?.day===selected&&<Copy muted size={14}>{t('routine_undo_capacity_hint')}</Copy>}
    {!steps.length&&!!sourceDays.length&&<TextAction label={t('routine_copy_from_day')} disabled={disabled} onPress={()=>{copyTrigger.current=addTrigger.current;setCopy({kind:'from',source:-1,targets:[selected],steps:[],before:[]});}}/>}
    </View>
    {removed&&<View accessibilityLiveRegion="polite" style={{gap:8}}><Copy muted size={14}>{t('routine_removed_day',{day:t(routineDayKeys[removed.day]),name:removed.step.name})}</Copy>
      <TextAction icon="undo" label={t('routine_undo_removed_named',{name:removed.step.name})} disabled={disabled} onPress={()=>{const list=[...value.days[removed.day].exercises];list.splice(removed.index,0,removed.step);setSteps(removed.day,list);setRemoved(null);}}/></View>}
    {!!feedback&&<View accessibilityLiveRegion="polite"><Copy muted size={14}>{feedback}</Copy></View>}
    <Sheet title={t(general?editing?.isNew?'routine_step_add_builder':'routine_step_edit_builder':editing?.isNew?'routine_exercise_add_builder':'routine_exercise_edit_builder')} fullHeight visible={!!editing} onClose={close} onBack={close} returnFocusRef={trigger}
      actions={editing&&!editing.isNew?<IconButton icon="more_vert" label={t('routine_more')} onPress={()=>setOptions(true)}/>:undefined}
      footer={<BottomActionBar><View style={{flex:1}}><Button label={t('routine_child_done')} disabled={disabled||!editing?.value.name.trim()} onPress={apply}/></View></BottomActionBar>}>
      {editing&&<><Copy muted size={14}>{t('routine_day_context_builder',{day:t(routineDayKeys[editing.day])})}</Copy><RoutineExerciseForm key={editing.value.id} formRef={formRef} exercise={editing.value} preset={value.presentationPreset} disabled={disabled}
        imageOpen={imageOpen} onImageOpenChange={setImageOpen} onChange={change=>setEditing(current=>current?{...current,value:{...current.value,...change}}:null)}/></>}
      <Sheet title={t('routine_more')} visible={options&&!!editing} onClose={()=>setOptions(false)}><ConnectedGroup>
        <SettingRow intent="action" label={t('routine_move_up')} disabled={!editing||editing.position===0} onPress={()=>{setEditing(current=>current?{...current,position:current.position-1}:null);setOptions(false);}}/>
        <SettingRow intent="action" label={t('routine_move_down')} disabled={!editing||editing.position>=value.days[editing.day].exercises.length-1} onPress={()=>{setEditing(current=>current?{...current,position:current.position+1}:null);setOptions(false);}}/>
        <SettingRow intent="action" label={t('routine_remove_step')} icon="remove_circle_outline" onPress={()=>{if(!editing)return;const list=value.days[editing.day].exercises,index=list.findIndex(step=>step.id===editing.value.id);setRemoved({day:editing.day,step:cloneRoutineStep(list[index]),index});setSteps(editing.day,list.filter(step=>step.id!==editing.value.id));trigger.current=addTrigger.current;finishClose();}}/>
      </ConnectedGroup></Sheet>
    </Sheet>
    <Sheet title={copy?.kind==='review'?t('routine_replace_steps_title'):copy?.kind==='from'?t('routine_copy_from_day'):t('routine_copy_to_title',{day:t(routineDayKeys[copy?.source??selected])})}
      visible={!!copy} onClose={()=>setCopy(null)} returnFocusRef={copyTrigger} footer={copy?.kind==='from'?undefined:<View style={{padding:16,gap:8}}><Button label={t(copy?.kind==='review'?'routine_replace_steps':'routine_copy_continue')} disabled={!copy?.targets.length} onPress={()=>{if(copy?.kind==='review')applyCopy(copy);else reviewCopy();}}/>
        <Button label={t('m_19766ed6ccb2')} variant="neutral" onPress={()=>setCopy(null)}/></View>}>
      {copy?.kind==='to'&&<ConnectedGroup>{routineDayKeys.map((key,index)=>index===copy.source?null:<CheckRow key={key} label={t(key)} selected={copy.targets.includes(index)}
        description={[t('routine_step_count',{count:value.days[index].exercises.length}),value.days[index].exercises.length?t('routine_will_replace'):''].filter(Boolean).join(' · ')}
        onPress={()=>setCopy(current=>current?{...current,targets:current.targets.includes(index)?current.targets.filter(day=>day!==index):[...current.targets,index].sort()}:null)}/>)}</ConnectedGroup>}
      {copy?.kind==='from'&&<ConnectedGroup>{sourceDays.map(index=><SettingRow key={index} intent="action" label={t(routineDayKeys[index])} value={t('routine_step_count',{count:value.days[index].exercises.length})} description={value.days[index].exercises.map(step=>step.name).join(' · ')}
        onPress={()=>applyCopy({...copy,source:index,steps:value.days[index].exercises.map(cloneRoutineStep)})}/>)}</ConnectedGroup>}
      {copy?.kind==='review'&&<>{copy.before.filter(day=>day.steps.length).map(day=><View key={day.day} style={{gap:8}}><Copy heading>{t(routineDayKeys[day.day])} · {t('routine_will_replace')}</Copy>{day.steps.map(step=><Copy key={step.id}>{step.name}</Copy>)}</View>)}
        <Copy heading>{t('routine_replace_with')}</Copy><ConnectedGroup>{copy.steps.map(step=><SettingRow key={step.id} label={step.name} value={exerciseTargetText(step)}/>)}</ConnectedGroup></>}
      {!!copy&&<Copy muted size={14}>{t('routine_copy_independent_hint')}</Copy>}
    </Sheet>
  </View>;
}

function DayTab({label,status,populated,selected,disabled,onPress}:{label:string;status:string;populated:boolean;selected:boolean;disabled:boolean;onPress:()=>void}) {
  const colors=useTheme(),[focused,setFocused]=useState(false);
  return <Pressable accessibilityRole="tab" accessibilityLabel={status} accessibilityState={{selected,disabled}} aria-selected={selected} aria-disabled={disabled} disabled={disabled} onPress={onPress} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
    style={({pressed})=>({...dayTabCellStyle,minHeight:64,borderRadius:16,paddingVertical:8,borderColor:selected||focused?colors.accent:'transparent',backgroundColor:selected||pressed?colors.soft:colors.surface,
      alignItems:'center',justifyContent:'center',gap:6,opacity:disabled ? .5 : 1})}>
    <Copy>{label}</Copy><View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{width:4,height:4,borderRadius:2,backgroundColor:populated?colors.accent:'transparent'}}/>
  </Pressable>;
}
