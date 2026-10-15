import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePreventRemove } from 'expo-router/react-navigation';
import { View } from 'react-native';
import type { CalendarOperationStatus, ManagedCalendarCommand, ManagedCalendarPolicy, ManagedCalendarPreview, ManagedCalendarSetupChoices } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarError } from '../domain/calendar';
import { calendarCaptureRejected } from '../domain/calendar-link';
import { managedCalendarCapture } from '../domain/calendar-managed';
import { deviceZone } from '../domain/time';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, DateField, Disclosure, Page, RowSupport, SettingRow, Sheet, Toggle } from '../ui/components';
import { CalendarOperationProgress, CalendarReviewItems, CalendarStatusCard, useCalendarAuthorization } from '../ui/calendar-sync';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { useAppearanceHold } from '../ui/theme';
import { engine, nativeAvailable } from '../ui/native';
import { TimeZoneField } from '../ui/time-zone';

export default function ManagedCalendar() {
  const params = useLocalSearchParams<OriginParams & { mode?: string; adoptOccurrenceId?: string; replacement?: string; operationId?: string }>();
  const mode = params.mode || 'setup', origin = retainedOriginParams(params), client = useQueryClient(), confirm = useAppearanceConfirmation();
  const saved = useQuery({ queryKey: ['calendar', 'managed'], queryFn: () => engine().getManagedCalendarState(), enabled: nativeAvailable });
  const connection = useQuery({ queryKey: ['calendar', 'connection'], queryFn: () => engine().getCalendarConnection(), enabled: nativeAvailable });
  const [preview, setPreview] = useState<ManagedCalendarPreview | null>(null), [draft, setDraft] = useState<ManagedCalendarSetupChoices>({});
  const [selected, setSelected] = useState<string[]>([]), [checking, setChecking] = useState(false), [capturing, setCapturing] = useState(false);
  const [unknown, setUnknown] = useState(false), [resultId, setResultId] = useState<string | null>(null), [error, setError] = useState(''), [reason, setReason] = useState(''), [refresh, setRefresh] = useState(0);
  const [sheet, setSheet] = useState<'calendar' | 'alerts' | 'google' | null>(null);
  const [zoneAtMs] = useState(Date.now);
  const pending = useRef<ManagedCalendarCommand | null>(null), initialized = useRef(false), ticket = useRef(0), busy = useRef(false), focused = useRef(false);
  const pendingSetup = saved.data && (['PreparingCalendar', 'InitialImport', 'CreationUnconfirmed'].includes(saved.data.phase) || saved.data.phase === 'AccessRequired' && saved.data.problem?.action === 'Authorize');
  const operationId = resultId || params.operationId || (mode === 'progress' || mode === 'setup' && pendingSetup && params.replacement !== 'true' && !params.adoptOccurrenceId ? saved.data?.operationId : null);
  const back = () => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin));
  const auth = useCalendarAuthorization(() => { setRefresh(value => value + 1); });
  useAppearanceHold(capturing || unknown || !!sheet);
  usePreventRemove(capturing || unknown, () => confirm('Request not confirmed', 'Check or retry this same request before leaving.'));
  useFocusEffect(useCallback(() => { if (focused.current) setRefresh(value => value + 1); focused.current = true; }, []));
  useEffect(() => {
    if (!nativeAvailable || !connection.data?.connected || operationId || mode === 'progress' || pending.current) return;
    const tickets = ticket, current = ++tickets.current;
    setChecking(true); setError(''); setReason('');
    const timer = setTimeout(() => {
      void (async () => {
        const state = await engine().getManagedCalendarState();
        const choices: ManagedCalendarSetupChoices = { ...draft, replacement: params.replacement === 'true', ...(params.adoptOccurrenceId ? { adoptOccurrenceIds: [params.adoptOccurrenceId] } : {}) };
        const next = mode === 'resume' ? await engine().previewManagedCalendarResume() : mode === 'recovered' ? await engine().previewManagedCalendarRecoveredAlerts([]) :
          mode === 'policy' ? await engine().previewManagedCalendarPolicyChange({ ...(draft.policy || state.policy), expectedRevision: state.policy.revision }) : await engine().previewManagedCalendarSetup(choices);
        if (current !== ticket.current) return;
        setPreview(next);
        const first = !initialized.current; initialized.current = true;
        setSelected(old => next.items.filter(item => item.ready && (!first ? old.includes(item.itemId) : mode !== 'setup' || !['Adopt', 'Publish'].includes(item.kind) || item.occurrenceId === params.adoptOccurrenceId)).map(item => item.itemId));
      })().catch(e => { if (current === ticket.current) { setError(calendarError(e)); setReason(e && typeof e === 'object' && 'code' in e ? String(e.code) : ''); } }).finally(() => { if (current === ticket.current) setChecking(false); });
    }, 250);
    return () => { clearTimeout(timer); tickets.current++; };
  }, [draft, mode, connection.data?.connected, connection.data?.revision, refresh, params.adoptOccurrenceId, params.replacement, operationId]);
  const policy = { ...(preview?.policy || saved.data?.policy), ...draft.policy } as ManagedCalendarPolicy;
  const updatePolicy = (patch: Partial<ManagedCalendarPolicy>) => setDraft(old => ({ ...old, policy: { ...(preview?.policy || saved.data?.policy), ...old.policy, ...patch } }));
  const apply = async () => {
    if (!preview || busy.current || checking || !preview.complete || !unknown && Date.now() >= preview.expiresAtMs) { setError('These settings need another check before confirming.'); setRefresh(v => v + 1); return; }
    pending.current ??= managedCalendarCapture(preview, engine().createOperationId(), selected);
    const command = pending.current; busy.current = true; setCapturing(true); setError('');
    try { await engine().applyCalendarCommand(command); pending.current = null; setUnknown(false); setResultId(command.operationId); await client.invalidateQueries({ queryKey: ['calendar'] }); }
    catch (e) { if (calendarCaptureRejected(e)) { pending.current = null; setUnknown(false); setRefresh(v => v + 1); } else setUnknown(true); setError(calendarError(e)); }
    finally { busy.current = false; setCapturing(false); }
  };
  const recover = async (status: CalendarOperationStatus) => {
    if (status.action === 'Connect' || status.action === 'Authorize') { await auth.start(status.action === 'Authorize' ? status.operationId : null); return; }
    if (status.action === 'ReviewItems') { router.push({ pathname: '/calendar-reviews', params: origin }); return; }
    if (status.action === 'InspectCreation') {
      if (busy.current) return; busy.current = true; setCapturing(true);
      try { await engine().applyCalendarCommand({ kind: 'RetryManagedCalendarOperation', operationId: status.operationId }); await client.invalidateQueries({ queryKey: ['calendar'] }); }
      catch (e) { setError(calendarError(e)); } finally { busy.current = false; setCapturing(false); }
      return;
    }
    router.replace({ pathname: '/calendar', params: origin });
  };
  const title = operationId || mode === 'progress' ? 'Calendar sync' : mode === 'resume' ? 'Review and resume sync' : mode === 'policy' ? 'Calendar sync preferences' : mode === 'recovered' ? 'Turn on recovered alerts' : 'Set up Calendar sync';
  const action = mode === 'resume' ? 'Resume and apply reviewed work' : mode === 'policy' ? 'Save preferences' : mode === 'recovered' ? `Turn on ${selected.length} alerts` : preview?.createCalendar ? 'Create calendar and turn on sync' : 'Turn on sync';
  const locked = capturing || unknown || auth.waiting;
  const allDayTime = new Date(zoneAtMs); allDayTime.setHours(Math.floor((policy.allDayAlarmMinutes ?? 540) / 60), (policy.allDayAlarmMinutes ?? 540) % 60, 0, 0);
  const source = preview?.calendarCandidates.find(value => value.id === (draft.selectedCalendarId || preview.selectedCalendarId));
  const zone = preview?.createCalendar ? draft.calendarZone || preview.calendarZone || deviceZone() : source?.zoneId || saved.data?.calendarZone || deviceZone();
  const zoneLabel = zone.split('/').pop()?.replaceAll('_', ' ') || zone;
  return <Page compact title={title} onBack={back} footer={!operationId && preview && mode !== 'progress' ? <BottomActionBar><Button label={unknown ? 'Retry same request' : checking ? 'Checking settings…' : action}
    busy={capturing} disabled={auth.waiting || checking || !unknown && (!preview.complete || !!error || mode === 'recovered' && !selected.length)} onPress={() => void apply()} /></BottomActionBar> : undefined}>
    {!nativeAvailable && <Copy>Use the Android app to set up Calendar sync.</Copy>}
    {operationId ? <><CalendarOperationProgress operationId={operationId} onAction={status => void recover(status)} />
      {!!auth.message && <ActionFeedback message={auth.message} loading={auth.waiting} />}
      {!!error && <ActionFeedback message={error} tone="warning" />}
      <Button label="Back to Calendar" variant="secondary" disabled={capturing || unknown} onPress={() => router.replace({ pathname: '/calendar', params: origin })} />
    </> : <>
      <Copy muted>{mode === 'resume' ? 'Local alerts continue. Review what will sync when you resume.' : mode === 'recovered' ? 'These recovered reminders have No alert. Choose which future alerts to turn on.' : mode === 'policy' ? 'Changes apply to future imports and new reminders.' : 'Sync reminders with a dedicated Remilo calendar.'}</Copy>
      {mode === 'setup' && <ConnectedGroup title="Account and calendar">
        <SettingRow icon="event" label="Google account" value={connection.data?.connected ? connection.data.email : 'Not connected'} description={connection.data?.connected ? undefined : 'Allow access to find your Remilo calendar.'} />
        <SettingRow icon="event" label="Remilo calendar" value={source?.name || (preview?.createCalendar ? 'Create a new Remilo calendar' : saved.data?.calendarName || (connection.data?.connected ? checking ? 'Checking calendars…' : 'Choose a Remilo calendar' : 'Choose after connecting'))}
          description={preview?.createCalendar ? 'Created only after you confirm below.' : source ? 'Found in your Google account' : preview?.calendarCandidates.length ? 'Choose which Remilo calendar to use.' : 'Your automatic import and export source.'}
          disabled={locked || !preview?.calendarCandidates.length} onPress={preview?.calendarCandidates.length ? () => setSheet('calendar') : undefined} />
        {preview?.createCalendar && <TimeZoneField value={zone} atMs={zoneAtMs} disabled={locked} onChange={calendarZone => setDraft(old => ({ ...old, calendarZone }))} />}
      </ConnectedGroup>}
      {!connection.data?.connected && nativeAvailable && <CalendarStatusCard title="Connect Google Calendar" description="Remilo needs access to find your dedicated calendar. Connecting alone doesn’t add reminders or turn on sync." label="Connect Google" busy={auth.waiting} action={() => void auth.start()} />}
      {!!auth.message && <ActionFeedback message={auth.message} loading={auth.waiting} />}
      {!!error && <CalendarStatusCard title="Setup needs attention" description={error} warning label={['NEEDS_ACCESS', 'AUTH', 'ACCOUNT_MISMATCH'].includes(reason) ? 'Reconnect Google' : 'Check settings again'} busy={auth.waiting || checking}
        action={() => ['NEEDS_ACCESS', 'AUTH', 'ACCOUNT_MISMATCH'].includes(reason) ? void auth.start(saved.data?.problem?.action === 'Authorize' ? saved.data.operationId || null : null) : setRefresh(v => v + 1)} />}
      {checking && <ActionFeedback loading message="Checking settings…" />}
      {preview && <>
        {params.replacement === 'true' && <ActionFeedback tone="warning" message="This replacement keeps existing Google calendars and links. An earlier creation request may still appear in Google." />}
        {mode === 'setup' && policy.automaticImport && preview.initialMode === 'None' && <CalendarStatusCard title="Existing events will have No alert" description="You can review and turn on their alerts afterward. Later new events use your alert preference below." />}
        {(mode === 'setup' || mode === 'policy') && <>
          <ConnectedGroup title="What syncs" footer={<Copy muted size={14}>Linked titles, notes and event times stay in sync.</Copy>}>
            <View><Toggle label="Add Google events to Remilo" value={policy.automaticImport} disabled={locked} onChange={automaticImport => updatePolicy({ automaticImport })} />
              <RowSupport><Copy muted size={14}>Ongoing and upcoming events become reminders. Some events need review.</Copy></RowSupport></View>
            <View><Toggle label="Add new Remilo reminders to Google" value={policy.exportNewReminders} disabled={locked} onChange={exportNewReminders => updatePolicy({ exportNewReminders })} />
              <RowSupport><Copy muted size={14}>Choose Local only when creating a reminder. Google alerts are off for events Remilo creates.</Copy></RowSupport></View>
          </ConnectedGroup>
          {policy.automaticImport && <ConnectedGroup title="Alerts for imported events" footer={<Copy muted size={14}>Timed alerts use the event start. Past alert times need review; they never ring immediately.</Copy>}>
            <SettingRow icon="alarm" label="Alert type" value={policy.importMode === 'None' ? 'No alert' : policy.importMode} disabled={locked} onPress={() => setSheet('alerts')} />
            {policy.importMode !== 'None' && <View><DateField label="All-day alert time" timeOnly value={allDayTime.getTime()} disabled={locked} onError={setError}
              onChange={value => { const date = new Date(value); updatePolicy({ allDayAlarmMinutes: date.getHours() * 60 + date.getMinutes() }); }} />
              <RowSupport><Copy muted size={14}>{zoneLabel} time · for new all-day imports</Copy></RowSupport></View>}
          </ConnectedGroup>}
          <ConnectedGroup><SettingRow icon="notifications" label="Google event reminders" value={policy.disableGoogleReminders ? 'Turn off after Remilo alerts are ready' : 'Keep Google reminders'}
            description={policy.disableGoogleReminders ? 'No alert imports keep their Google reminders.' : 'Both apps may alert.'} disabled={locked} onPress={() => setSheet('google')} /></ConnectedGroup>
          <ConnectedGroup><Disclosure title="How Calendar sync works" summary="Supported events, repeating reminders and local alerts" icon="info">
            <Copy muted size={14}>Existing local reminders aren’t sent to Google unless you select them in a review. Repeating reminders use one Calendar choice for the family.</Copy>
            <Copy muted size={14}>Repeats without a fixed zone use the calendar’s named time zone when published. Done, Skip, Snooze and local alert settings stay in Remilo. Each phone has its own alerts.</Copy>
            <Copy muted size={14}>Meetings and unsupported schedules need individual review. Deleting a Google event keeps its local reminder and alert.</Copy>
          </Disclosure></ConnectedGroup>
        </>}
        {preview.warnings.map((warning, index) => <ActionFeedback key={index} message={warning} tone="warning" />)}
        {preview.sample && <ConnectedGroup><Disclosure title="Preview existing events" summary="A sample, not the full import total" icon="event">
          <Copy muted size={14}>{preview.sample.inspectedCount} calendar resources checked{preview.sample.complete ? '' : ' · More pages remain'}. Full processing begins after confirmation.</Copy>
          {preview.sample.items.map((item, index) => <View key={index} style={{ gap: 4 }}><Copy>{item.title}</Copy><Copy muted size={14}>{item.description}</Copy></View>)}
          {!preview.sample.items.length && <Copy muted size={14}>No upcoming events appear in this sample.</Copy>}
        </Disclosure></ConnectedGroup>}
        {!preview.complete && <ActionFeedback message="Choose a Remilo calendar before continuing." tone="warning" />}
        <CalendarReviewItems items={preview.items} selected={selected} disabled={locked || checking} onToggle={id => setSelected(old => old.includes(id) ? old.filter(value => value !== id) : [...old, id])}
          onReview={item => router.push(item.candidateId ? { pathname: '/calendar-review', params: { candidateId: item.candidateId, ...origin } } : { pathname: '/calendar-manage', params: { id: item.occurrenceId!, ...origin } })} />
        {mode === 'resume' && <Copy muted size={14}>Publishing a past unfinished reminder doesn’t replay its alert. Unselected items stay held or available for review.</Copy>}
      </>}
    </>}
    <Sheet visible={sheet === 'calendar'} title="Choose your Remilo calendar" onClose={() => setSheet(null)}>
      <Copy muted>Use an existing dedicated Remilo calendar. Other calendars remain available in advanced manual tools.</Copy>
      <ConnectedGroup>{preview?.calendarCandidates.map(candidate => <Choice key={candidate.id} label={candidate.name} description={candidate.zoneId + (candidate.recognition === 'NameOnly' ? ' · Matching calendar name' : '')}
        selected={candidate.id === (draft.selectedCalendarId || preview.selectedCalendarId)} onPress={() => { setDraft(old => ({ ...old, selectedCalendarId: candidate.id })); setSheet(null); }} />)}</ConnectedGroup>
    </Sheet>
    <Sheet visible={sheet === 'alerts'} title="Alerts for new Google events" onClose={() => setSheet(null)}><ConnectedGroup>
      {(['Alarm', 'Notification', 'None'] as const).map(importMode => <Choice key={importMode} label={importMode === 'None' ? 'No alert' : importMode} selected={policy.importMode === importMode} onPress={() => { updatePolicy({ importMode }); setSheet(null); }} />)}
    </ConnectedGroup><Copy muted>Existing reminders keep their alert settings. Android alert permissions remain separate.</Copy></Sheet>
    <Sheet visible={sheet === 'google'} title="Google event reminders" onClose={() => setSheet(null)}><ConnectedGroup>
      <Choice label="Keep Google reminders" description="Both apps may alert." selected={!policy.disableGoogleReminders} onPress={() => { updatePolicy({ disableGoogleReminders: false }); setSheet(null); }} />
      <Choice label="Turn off after Remilo alerts are ready" description="Applies to new imports with a ready Remilo alert. No alert imports keep Google reminders." selected={policy.disableGoogleReminders} onPress={() => { updatePolicy({ disableGoogleReminders: true }); setSheet(null); }} />
    </ConnectedGroup></Sheet>
  </Page>;
}
