import { useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import type { EditorDraft } from '../domain/editor-draft';
import { civilAt, deviceZone } from '../domain/time';
import { modeLabel } from '../domain/presentation';
import { useTranslation } from '../localization/react';
import { ActionFeedback, Button, ConnectedGroup, Copy, DateField, SettingRow, Sheet, Toggle } from './components';
import { AlertModeSelector } from './alert-mode-selector';
import { DateTimeFields } from './date-time-fields';
import { useAppearanceConfirmation } from './confirmation';
import { useCapabilities, engine } from './native';
import { SoundPicker } from './sound-picker';
import { useTimeFormatting } from './time-display';

export type RoutineTiming = Pick<EditorDraft,'alarmAtMs'|'mode'|'sound'|'vibration'> & { startsOn:string };
export function RoutineTimingField({value,onChange,existing,disabled}:{value:RoutineTiming;onChange:(value:RoutineTiming)=>void;existing:boolean;disabled:boolean}) {
  const t=useTranslation(),confirm=useAppearanceConfirmation(),caps=useCapabilities(),{shortTime,formatDate}=useTimeFormatting();
  const [draft,setDraft]=useState<RoutineTiming|null>(null),[baseline,setBaseline]=useState(''),[error,setError]=useState('');
  const [sheet,setSheet]=useState<'Date'|'Alert'>('Date');
  const dateTrigger=useRef<View|null>(null),alertTrigger=useRef<View|null>(null),trigger=useRef<View|null>(null);
  const [openedDate]=useState(()=>civilAt(Date.now()).slice(0,10));
  const close=()=>{Keyboard.dismiss();if(draft&&JSON.stringify(draft)!==baseline)confirm(t('routine_child_discard_title'),t('routine_child_discard_hint'),[
    {text:t('m_e76fd2add010'),style:'cancel'},{text:t('m_eb1a70e39274'),style:'destructive',onPress:()=>setDraft(null)},
  ]);else setDraft(null);};
  const date=value.startsOn===openedDate?t('routine_from_today'):formatDate(new Date(`${value.startsOn}T12:00:00`).getTime());
  const summary=[date,value.mode==='None'?'':shortTime(value.alarmAtMs)].filter(Boolean).join(' · ');
  const open=(kind:'Date'|'Alert')=>{Keyboard.dismiss();trigger.current=kind==='Date'?dateTrigger.current:alertTrigger.current;setSheet(kind);setDraft({...value});setBaseline(JSON.stringify(value));setError('');};
  const apply=()=>{if(!draft||disabled)return;
    // Each sheet commits its own fields against the current parent, never its captured unrelated values.
    onChange(sheet==='Date'?{...value,startsOn:draft.startsOn,alarmAtMs:draft.alarmAtMs}:{...value,mode:draft.mode,sound:draft.sound,vibration:draft.vibration});
    setDraft(null);
  };
  return <><ConnectedGroup>
    <SettingRow buttonRef={dateTrigger} intent="navigation" label={t('routine_schedule')} icon="event" value={summary} disabled={disabled} onPress={()=>open('Date')}/>
    <SettingRow buttonRef={alertTrigger} intent="navigation" label={t('m_44a57b22e03d')} icon={value.mode==='Alarm'?'alarm':value.mode==='None'?'alarm_off':'notifications'} value={modeLabel(value.mode??'Notification')} disabled={disabled} onPress={()=>open('Alert')}/>
  </ConnectedGroup>
    <Sheet title={t(sheet==='Date'?'routine_schedule':'m_44a57b22e03d')} visible={!!draft} onClose={close} returnFocusRef={trigger}
      footer={<View style={{padding:16,gap:8}}><Button label={t('routine_child_done')} disabled={disabled||sheet==='Date'&&!!error} onPress={apply}/>
        <Button label={t('m_19766ed6ccb2')} variant="neutral" onPress={()=>setDraft(null)}/></View>}>
      {draft&&sheet==='Date'&&<><Copy muted size={14}>{t('routine_timing_hint')}</Copy><ConnectedGroup>
        {!existing?<DateTimeFields dateLabel={t('routine_starts')} dateZoneId={deviceZone()} dateValue={new Date(`${draft.startsOn}T12:00:00`).getTime()} value={draft.alarmAtMs} zoneId={deviceZone()} allDay={draft.mode==='None'} disabled={disabled} onError={setError}
          onDateChange={date=>{setError('');setDraft({...draft,startsOn:civilAt(date).slice(0,10)});}} onChange={alarmAtMs=>{setError('');setDraft({...draft,alarmAtMs});}}/>:
          <><SettingRow label={t('routine_starts')} value={formatDate(new Date(`${draft.startsOn}T12:00:00`).getTime())}/>{draft.mode!=='None'&&<DateField label={t('m_33b93476cf59')} value={draft.alarmAtMs} zoneId={deviceZone()} timeOnly disabled={disabled} onError={setError} onChange={alarmAtMs=>{setError('');setDraft({...draft,alarmAtMs});}}/>}</>}
      </ConnectedGroup>
      {!!error&&<ActionFeedback message={error} tone="danger"/>}</>}
      {draft&&sheet==='Alert'&&<><Copy muted size={14}>{t(draft.mode==='None'?'routine_no_alert_scope':'routine_alert_scope')}</Copy>
      <ConnectedGroup><AlertModeSelector value={draft.mode??'Notification'} disabled={disabled} onChange={mode=>setDraft({...draft,mode})}/></ConnectedGroup>
      {draft.mode==='Notification'&&<><Copy muted size={14}>{t('routine_no_catchup')}</Copy>{caps.data&&(!caps.data.notifications||!caps.data.routineChannelEnabled)&&<ActionFeedback tone="warning" message={t('routine_notification_warning')}/>}
        {caps.data?.routineChannelQuiet===false&&<Copy muted size={14}>{t('routine_channel_changed')}</Copy>}<Button label={t('routine_channel_settings')} variant="neutral" onPress={()=>void engine().openSettings('routineChannel')}/></>}
      {draft.mode==='Alarm'&&<ConnectedGroup><SoundPicker value={draft.sound??'remilo'} disabled={disabled} onChange={sound=>setDraft({...draft,sound})}/><Toggle label={t('m_59e1fd02f6c2')} value={draft.vibration??false} disabled={disabled} onChange={vibration=>setDraft({...draft,vibration})}/></ConnectedGroup>}</>}
    </Sheet>
  </>;
}
