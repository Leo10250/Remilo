import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { ManagedCalendarCommand, ManagedCalendarPolicy, ManagedCalendarPreview, ManagedCalendarSetupChoices } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarError } from '../domain/calendar';
import { calendarCaptureRejected } from '../domain/calendar-link';
import { managedCalendarCapture, managedCalendarItemReason } from '../domain/calendar-managed';
import { deviceZone } from '../domain/time';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, DateField, Page, Toggle } from '../ui/components';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { engine, nativeAvailable } from '../ui/native';
import { useAppearanceHold } from '../ui/theme';
import { useTimeFormatting } from '../ui/time-display';
import { TimeZoneField } from '../ui/time-zone';

export default function ManagedCalendarReview() {
  const params = useLocalSearchParams<OriginParams & { mode?: 'setup' | 'policy' | 'resume' | 'recovered'; adoptOccurrenceId?: string; replacement?: string }>(), origin = retainedOriginParams(params);
  const mode = params.mode || 'setup', client = useQueryClient(), confirm = useAppearanceConfirmation(), { scheduleDateTime } = useTimeFormatting();
  const [preview, setPreview] = useState<ManagedCalendarPreview | null>(null), [policy, setPolicy] = useState<ManagedCalendarPolicy | null>(null);
  const [selected, setSelected] = useState<string[]>([]), [calendarId, setCalendarId] = useState<string | undefined>();
  const [calendarZone, setCalendarZone] = useState(deviceZone), [zoneAtMs] = useState(Date.now);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [capturing, setCapturing] = useState(false), [unknown, setUnknown] = useState(false), [captured, setCaptured] = useState(false), [error, setError] = useState('');
  const pending = useRef<ManagedCalendarCommand | null>(null), live = useRef(true), running = useRef(false);
  useAppearanceHold(busy || unknown);
  usePreventRemove(capturing || unknown, () => confirm('Calendar request not confirmed', 'Wait or retry the same captured request before leaving.'));
  const back = () => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin));
  const load = async (selection?: string) => {
    if (!nativeAvailable || running.current || pending.current) return;
    running.current = true; setBusy(true); setError('');
    try {
      const current = await engine().getManagedCalendarState();
      const choices: ManagedCalendarSetupChoices = { selectedCalendarId: selection ?? calendarId, calendarZone,
        ...(policy ? { policy } : {}), ...(params.adoptOccurrenceId ? { adoptOccurrenceIds: [params.adoptOccurrenceId] } : {}) };
      const next = mode === 'resume' ? await engine().previewManagedCalendarResume() : mode === 'recovered' ? await engine().previewManagedCalendarRecoveredAlerts([]) :
        mode === 'policy' ? await engine().previewManagedCalendarPolicyChange({ ...policy || current.policy, expectedRevision: current.policy.revision }) : await engine().previewManagedCalendarSetup(choices);
      if (!live.current) return;
      setPreview(next); setPolicy(next.policy); setCalendarId(next.selectedCalendarId || undefined); setDirty(false);
      if (next.calendarZone) setCalendarZone(next.calendarZone);
      setSelected(old => next.items.filter(item => item.ready && (preview ? old.includes(item.itemId) : mode !== 'setup' || item.occurrenceId === params.adoptOccurrenceId || !['Adopt', 'Publish'].includes(item.kind))).map(item => item.itemId));
    } catch (e) { if (live.current) setError(calendarError(e)); }
    finally { running.current = false; if (live.current) setBusy(false); }
  };
  const loadRef = useRef(load); useEffect(() => { loadRef.current = load; });
  useEffect(() => { live.current = true; void Promise.resolve().then(() => loadRef.current()); return () => { live.current = false; }; }, [mode]);
  const updatePolicy = (patch: Partial<ManagedCalendarPolicy>) => { if (!busy && !unknown && !captured) { setPolicy(old => old ? { ...old, ...patch } : old); setDirty(true); } };
  const apply = async () => {
    if (!preview || running.current) return;
    if (dirty && !pending.current) { await load(); return; }
    pending.current ??= managedCalendarCapture(preview, engine().createOperationId(), selected);
    running.current = true; setBusy(true); setCapturing(true); setError('');
    try {
      await engine().applyCalendarCommand(pending.current); pending.current = null; setUnknown(false); setCaptured(true);
      await client.invalidateQueries({ queryKey: ['calendar'] });
    } catch (e) { if (calendarCaptureRejected(e)) { pending.current = null; setUnknown(false); } else setUnknown(true); setError(calendarError(e)); }
    finally { running.current = false; setBusy(false); setCapturing(false); }
  };
  const title = mode === 'resume' ? 'Review queued Calendar work' : mode === 'policy' ? 'Calendar defaults' : mode === 'recovered' ? 'Review recovered alerts' : 'Set up Remilo calendar';
  const action = mode === 'resume' ? 'Resume and apply reviewed work' : mode === 'policy' ? 'Save reviewed defaults' : mode === 'recovered' ? 'Enable selected alarms' : 'Enable Remilo calendar sync';
  const locked = busy || unknown || captured;
  const allDayTime = new Date(); allDayTime.setHours(Math.floor((policy?.allDayAlarmMinutes ?? 540) / 60), (policy?.allDayAlarmMinutes ?? 540) % 60, 0, 0);
  return <Page compact title={title} onBack={back} footer={preview && !captured ? <BottomActionBar>
    <Button label={unknown ? 'Retry same captured request' : dirty ? 'Refresh review' : action} disabled={busy || !unknown && (!preview.complete || mode === 'recovered' && !selected.length)} onPress={() => void apply()} />
    <Button label="Cancel" variant="secondary" disabled={busy || unknown} onPress={back} />
  </BottomActionBar> : undefined}>
    <Copy muted>{mode === 'resume' ? 'Your local alerts continue while sync is paused. Confirmation resumes automatic work in the Remilo calendar and applies the selected ready items. Other Calendar sources keep their own permissions.' :
      mode === 'recovered' ? 'Recovered reminders currently have No alert. Select the future alarms to enable. Completion, Snooze and other local settings cannot be recovered from Google Calendar.' :
      'Remilo uses one owned calendar. Supported ongoing and upcoming events become linked reminders. Ordinary Title, Notes and Schedule changes transfer automatically; conflicts and unsafe timing require review.'}</Copy>
    {!nativeAvailable && <ActionFeedback message="Use the Android app to set up managed Calendar sync." />}
    {params.replacement === 'true' && <ActionFeedback tone="warning" message="This is a separately reviewed replacement setup. The earlier creation request may still appear in Google. Confirmation never deletes an existing calendar." />}
    {!!error && <ActionFeedback message={error} tone="warning" />}{busy && <ActionFeedback loading message={capturing ? 'Capturing the reviewed Calendar work…' : 'Preparing the native Calendar review…'} />}
    {!preview && !busy && <Button label="Retry review" disabled={!nativeAvailable} onPress={() => void load()} />}
    {preview && <>
      {mode === 'setup' && <ConnectedGroup title="Remilo calendar">
        {preview.calendarCandidates.map(candidate => <Choice key={candidate.id} label={candidate.name} description={candidate.zoneId + (candidate.recognition === 'NameOnly' ? ' · Matching name; adoption requires confirmation' : '')}
          selected={preview.selectedCalendarId === candidate.id} disabled={locked} onPress={() => { setCalendarId(candidate.id); void load(candidate.id); }} />)}
        {preview.createCalendar && <Copy>A new owned calendar named Remilo will be created after confirmation.</Copy>}
        {!preview.createCalendar && !preview.selectedCalendarId && <Copy>Choose which Remilo calendar to use.</Copy>}
      </ConnectedGroup>}
      {mode === 'setup' && preview.createCalendar && <ConnectedGroup title="New calendar time zone">
        <TimeZoneField value={calendarZone} atMs={zoneAtMs} disabled={locked} onChange={zone => { setCalendarZone(zone); setDirty(true); }} />
      </ConnectedGroup>}
      {preview.initialMode === 'None' && mode === 'setup' && <ActionFeedback tone="warning" message="An existing calendar is being recovered on this installation. Initial recovered reminders have No alert. Review them before enabling alarms; later new events use your normal import default." />}
      {policy && (mode === 'setup' || mode === 'policy') && <>
        <ConnectedGroup title="Automatic behavior">
          <Toggle key="import" label="Import new supported events automatically" value={policy.automaticImport} disabled={locked} onChange={value => updatePolicy({ automaticImport: value })} />
          <Toggle key="export" label="Sync new Remilo reminders" value={policy.exportNewReminders} disabled={locked} onChange={value => updatePolicy({ exportNewReminders: value })} />
        </ConnectedGroup>
        <Copy muted>New reminders can be Local only. Repeating families use one Calendar preference. Changing defaults preserves existing alert settings and captured work.</Copy>
        <Copy muted>New Google events published by Remilo have Google reminders disabled. This does not change reminder settings on events already in Google.</Copy>
        <ConnectedGroup title="New imported alerts">{(['Alarm', 'Notification', 'None'] as const).map(value => <Choice key={value} label={value === 'None' ? 'No alert' : value} selected={policy.importMode === value}
          disabled={locked} onPress={() => updatePolicy({ importMode: value })} />)}</ConnectedGroup>
        <Copy muted>Timed alerts use the event start. Elapsed targets require review and never ring immediately. Alert permissions remain separate.</Copy>
        {policy.importMode !== 'None' && <DateField label="All-day alert time" timeOnly value={allDayTime.getTime()} disabled={locked} onError={setError}
          onChange={value => { const date = new Date(value); updatePolicy({ allDayAlarmMinutes: date.getHours() * 60 + date.getMinutes() }); }} />}
        <Copy muted>All-day alerts use the named time zone of the calendar.</Copy>
        <Copy muted>Floating repeats selected for sync are pinned to a named time zone. Calendar and Remilo completion remain independent. Each phone has its own local alerts.</Copy>
        <ConnectedGroup title="Google reminders"><Toggle key="suppress" label="Disable Google reminders on new imports" value={policy.disableGoogleReminders} disabled={locked}
          onChange={value => updatePolicy({ disableGoogleReminders: value })} /></ConnectedGroup>
        <Copy muted>Google reminders stay enabled unless you separately select suppression. Both apps may alert. Suppression waits for the requested local alert to be ready.</Copy>
        {policy.importMode === 'None' && <Copy muted>Imports with No alert keep their Google reminders. This suppression preference applies when future imports request a ready Remilo alert.</Copy>}
      </>}
      {preview.warnings.map((warning, index) => <ActionFeedback key={index} message={warning} tone="warning" />)}
      {preview.sample && <ConnectedGroup title="Existing Calendar contents · sample">
        <Copy muted>{preview.sample.inspectedCount} resources inspected in one page{preview.sample.complete ? '' : ' · More pages remain'}. This is a read-only sample, not an import total. Full processing starts after confirmation.</Copy>
        {preview.sample.items.map((item, index) => <View key={index}><Copy heading>{item.title}</Copy><Copy muted>{item.description}</Copy></View>)}
        {!preview.sample.items.length && <Copy muted>No ongoing or upcoming master events appear in this sample.</Copy>}
      </ConnectedGroup>}
      {!preview.complete && <ActionFeedback message="The review is incomplete. Continue refreshing before confirming." tone="warning" />}
      {preview.items.length > 0 && <Copy heading>{preview.items.filter(item => item.ready).length} ready items · {preview.items.filter(item => !item.ready).length} need review</Copy>}
      {preview.items.map(item => <ConnectedGroup key={item.itemId}>
        <Choice label={item.title} description={[item.kind === 'RecoveredAlert' ? 'Enable Alarm' : item.kind, item.calendarName, item.scope].filter(Boolean).join(' · ')} selected={selected.includes(item.itemId)} disabled={locked || !item.ready}
          onPress={() => setSelected(old => old.includes(item.itemId) ? old.filter(id => id !== item.itemId) : [...old, item.itemId])} />
        {item.ready ? <><Copy muted>{item.alertMode === 'None' ? 'No alert' : item.alertAtMs ? (item.alertMode || 'Alarm') + ': ' + scheduleDateTime(item.alertAtMs) : ''}</Copy>
          {(item.inbound?.length || item.outbound?.length) ? <Copy muted>To Remilo: {item.inbound?.join(', ') || 'None'} · To Google: {item.outbound?.join(', ') || 'None'}</Copy> : null}
          {item.localStatus && <Copy muted>Local scheduling: {item.localStatus}</Copy>}</> : <Copy muted>{managedCalendarItemReason(item)}</Copy>}
        {!item.ready && item.occurrenceId && <Button label="Review reminder" variant="secondary" disabled={locked} onPress={() => router.push({ pathname: '/calendar-manage', params: { id: item.occurrenceId!, ...origin } })} />}
        {!item.ready && item.candidateId && <Button label="Review incoming event" variant="secondary" disabled={locked} onPress={() => router.push({ pathname: '/calendar-review', params: { candidateId: item.candidateId!, ...origin } })} />}
      </ConnectedGroup>)}
      {mode === 'resume' && <Copy muted>Past unfinished reminders can be published through this review. Publication does not replay their local alerts. Completed, trashed and Local only work is excluded.</Copy>}
      {!locked && <Button label={dirty ? 'Refresh with these choices' : 'Refresh review'} variant="secondary" onPress={() => void load()} />}
      {captured && <><ActionFeedback message="The reviewed work is captured. Check saved Calendar status for each outcome; captured work does not mean every transfer has finished." />
        <Button label="Open Calendar settings" variant="secondary" onPress={() => router.replace({ pathname: '/calendar', params: origin })} /></>}
    </>}
  </Page>;
}
