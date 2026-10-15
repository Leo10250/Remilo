import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { CalendarCommand, CalendarFields, CalendarImportChoices, CalendarLinkPreview, CalendarSelections } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarError } from '../domain/calendar';
import { calendarCaptureRejected, resolvedCalendarFields } from '../domain/calendar-link';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, Field, Page, RowSupport, SelectRow, SettingRow, Toggle } from '../ui/components';
import { useCalendarAction } from '../ui/calendar-sync';
import { CalendarOperationStatus } from '../ui/calendar-linked';
import { calendarImportIndependence } from '../domain/calendar-presentation';
import { DateTimeFields } from '../ui/date-time-fields';
import { engine, nativeAvailable } from '../ui/native';
import { useTimeFormatting } from '../ui/time-display';
import { useAppearanceHold } from '../ui/theme';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { notify } from '../ui/feedback';

export default function CalendarReview() {
  const calendarAction = useCalendarAction();
  const params = useLocalSearchParams<OriginParams & { id?: string; calendarId?: string; eventId?: string; automatic?: string; candidateId?: string; candidateRevision?: string; managedHistory?: string }>(), origin = retainedOriginParams(params);
  const imported = !params.id, client = useQueryClient(), confirm = useAppearanceConfirmation();
  const { scheduleDateTime, formatDate } = useTimeFormatting();
  const [preview, setPreview] = useState<CalendarLinkPreview | null>(null), [choices, setChoices] = useState<CalendarImportChoices>(params.managedHistory === 'true' ? { mode: 'None' } : {});
  const adopting = imported && !!params.candidateId && !!preview?.local;
  const [selections, setSelections] = useState<CalendarSelections>({ title: null, notes: null, schedule: null });
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false), [candidateRevision, setCandidateRevision] = useState<number | null>(() => params.candidateRevision ? Number(params.candidateRevision) : null);
  const [sourceUnavailable, setSourceUnavailable] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [ignored, setIgnored] = useState(false);
  const captured = useRef<CalendarCommand | null>(null), running = useRef(false), live = useRef(true);
  const [now, setNow] = useState(Date.now);
  const readTicket = useRef(0);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(timer); }, []);
  const operations = useQuery({ queryKey: ['calendar', 'operations'], queryFn: () => engine().getCalendarOperations(), enabled: nativeAvailable });
  const links = useQuery({ queryKey: ['calendar', 'links'], queryFn: () => engine().getCalendarLinks(), enabled: nativeAvailable });
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().getLists(), enabled: nativeAvailable && imported });
  const link = links.data?.find(item => item.occurrenceId === params.id), job = operations.data?.find(item => item.operationId === operationId);
  const enable = !link || link.state === 'Detached';
  const activating = params.automatic === 'true';
  useAppearanceHold(busy || uncertain);
  usePreventRemove(capturing || uncertain, () => confirm('Calendar request not confirmed', 'Wait for this request or retry the same request before leaving.'));
  const load = useCallback(async () => {
    if (running.current || captured.current) return; running.current = true; setBusy(true); setError('');
    const ticket = ++readTicket.current;
    try {
      const activation = activating ? await engine().previewCalendarActivation([params.id!]) : null;
      const next = activation ? activation.items[0]?.preview : params.candidateId ? await engine().previewManagedCalendarCandidate(params.candidateId, choices) : imported ? await engine().previewCalendarImport({ calendarId: params.calendarId!, eventId: params.eventId! }, choices) :
        enable ? await engine().previewCalendarLink(params.id!) : await engine().previewCalendarUpdate(params.id!);
      if (!next) throw new Error(activation?.items[0]?.excludedReason || 'This link needs a fresh individual review.');
      if (!live.current || ticket !== readTicket.current) return;
      setPreview(next); setSelections(next.selections || { title: null, notes: null, schedule: null }); setDirty(false);
      if ('candidateRevision' in next && typeof next.candidateRevision === 'number') setCandidateRevision(next.candidateRevision);
    } catch (e) { if (live.current) { setError(calendarError(e)); setSourceUnavailable(!!e && typeof e === 'object' && 'code' in e && ['NOT_FOUND', 'ALREADY_IMPORTED'].some(code => String(e.code).includes(code))); } }
    finally { running.current = false; if (live.current) setBusy(false); }
  }, [choices, imported, enable, activating, params.calendarId, params.eventId, params.id, params.candidateId]);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => {
    const tickets = readTicket;
    live.current = true;
    void Promise.resolve().then(() => { if (live.current) return loadRef.current(); });
    return () => { live.current = false; tickets.current++; };
  }, [params.id, params.eventId, params.calendarId, params.candidateId]);
  const change = (next: CalendarImportChoices) => { if (busy || captured.current || operationId) return; setChoices(old => ({ ...old, ...next })); setDirty(true); };
  const apply = async () => {
    if (running.current || !preview && !captured.current) return;
    if (dirty && !captured.current) { await load(); return; }
    captured.current ??= params.candidateId ? { kind: 'ImportManagedCalendarCandidate', operationId: engine().createOperationId(), previewId: preview!.previewId, automaticSync: true,
      ...(adopting ? { selections: { ...selections } } : {}) } :
      { kind: imported ? 'ImportCalendarEvent' : activating ? 'EnableAutomaticCalendarSync' : enable ? 'EnableCalendarLink' : 'ApplyCalendarResolution',
        operationId: engine().createOperationId(), previewId: preview!.previewId, automaticSync: choices.automaticSync ?? preview!.choices.automaticSync ?? (imported || enable || activating), ...(imported ? {} : { selections: { ...selections } }) };
    running.current = true; setBusy(true); setCapturing(true); setError('');
    try {
      const ignoring = captured.current.kind === 'IgnoreManagedCalendarCandidate';
      const result = await calendarAction.submit(captured.current);
      if ('operationId' in result && typeof result.operationId === 'string') setOperationId(result.operationId);
      if (ignoring) { notify({ message: 'Event ignored.' }); setIgnored(true); }
      captured.current = null; setUncertain(false); await client.invalidateQueries();
    } catch (e) { if (calendarCaptureRejected(e)) { captured.current = null; setUncertain(false); } else setUncertain(true); setError(calendarError(e)); }
    finally { running.current = false; setBusy(false); setCapturing(false); }
  };
  const ignore = () => {
    if (!params.candidateId || candidateRevision === null || running.current || captured.current) return;
    confirm('Ignore this Calendar event?', 'Keep the Google event. Do not automatically import this event into Remilo. You can deliberately review it again later.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Ignore', onPress: () => {
      captured.current = { kind: 'IgnoreManagedCalendarCandidate', operationId: engine().createOperationId(), candidateId: params.candidateId!, expectedRevision: candidateRevision };
      void apply();
    } }]);
  };
  const mode = choices.mode || preview?.choices.mode || 'Alarm';
  const alarm = choices.alarmAtMs ?? preview?.choices.alarmAtMs;
  const title = choices.title ?? preview?.choices.title ?? preview?.remote.title ?? '';
  const resolved = preview?.local ? resolvedCalendarFields(preview.local, preview.remote, selections) : null;
  const timing = selections.schedule ? preview?.timings?.[selections.schedule] : null;
  const elapsedChange = !preview?.recurrence && !!timing && timing.mode !== 'None' && timing.alarmAtMs <= now && timing.alarmAtMs !== preview?.timings?.remilo.alarmAtMs;
  const fieldText = (field: keyof CalendarFields, fields: Partial<CalendarFields>) => {
    if (fields[field] === undefined) return 'No common value recorded';
    if (field !== 'schedule') return fields[field] || (field === 'notes' ? 'No notes' : 'Required');
    const schedule = fields.schedule!;
    return (schedule.allDay ? formatDate(schedule.eventStartMs, schedule.zoneId) + ' · All day' :
      scheduleDateTime(schedule.eventStartMs, schedule.zoneId) + ' – ' + scheduleDateTime(schedule.eventEndMs, schedule.zoneId)) + ' · ' + schedule.zoneId +
      (schedule.recurrence ? ' · Repeating schedule, exceptions and following segments' : '');
  };
  const recurring = !!preview?.recurrence;
  const invalid = imported && !adopting ? !title.trim() || (recurring ? !preview?.upcoming?.length : mode !== 'None' && (!alarm || alarm <= now)) : !resolved || elapsedChange;
  const back = useCallback(() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin)), [origin]);
  useEffect(() => { if (ignored && !busy && !uncertain) back(); }, [ignored, busy, uncertain, back]);
  return <Page compact title={adopting ? 'Review existing Calendar copy' : imported ? 'Review Calendar import' : activating ? 'Sync this reminder' : enable ? 'Link this reminder' : 'Review Calendar changes'} onBack={back}
    footer={!operationId && preview ? <BottomActionBar>
      <Button label={uncertain ? 'Retry same request' : dirty ? 'Check choices' : imported && !adopting ? 'Import reminder' : activating ? 'Turn on sync' : 'Apply chosen changes'}
        disabled={busy || !uncertain && !dirty && invalid} onPress={() => void apply()} />
      <Button label="Cancel" variant="secondary" disabled={busy || uncertain} onPress={back} />
    </BottomActionBar> : undefined}>
    <Copy muted>{adopting ? 'Review which values to keep before linking this event to its existing Remilo copy.' : imported ? 'Review this event and its alert before adding it to Remilo.' : 'Choose which values to keep in both apps. Your local alert settings stay in Remilo.'}</Copy>
    {imported && !adopting && <Copy muted>{calendarImportIndependence}</Copy>}
    {params.candidateId && !adopting && <Copy heading>No Remilo alert yet</Copy>}
    {!!error && <ActionFeedback message={error} tone="warning" />}
    {busy && <ActionFeedback loading message={capturing ? 'Saving your choices…' : 'Checking Calendar changes…'} />}
    {!preview && !busy && !sourceUnavailable && <Button label="Retry review" variant="secondary" disabled={!nativeAvailable} onPress={() => void load()} />}
    {sourceUnavailable && <Button label="Open current Calendar review" variant="secondary" onPress={() => router.replace({ pathname: '/calendar-reviews', params: origin })} />}
    {!preview && uncertain && <Button label="Retry same request" disabled={busy} onPress={() => void apply()} />}
    {params.candidateId && candidateRevision !== null && !operationId && !sourceUnavailable && <Button label="Ignore this event" variant="secondary" disabled={busy || uncertain} onPress={ignore} />}
    {preview && !operationId && <>
      <ConnectedGroup title="Source"><View key="source" style={{ padding: 16, gap: 12 }}><Copy>{preview.calendarName} · {preview.email}</Copy>
        <Copy muted>Checked {scheduleDateTime(preview.checkedAtMs)}.</Copy></View></ConnectedGroup>
      <ConnectedGroup title="Linked updates"><View key="sync">
        {activating || params.candidateId ? <SettingRow icon="event" label="Automatic sync included" description="Confirming this review keeps both copies up to date." /> :
          <Toggle label="Automatic sync" value={choices.automaticSync ?? preview.choices.automaticSync ?? (imported || enable)} disabled={busy || uncertain}
            onChange={value => { setChoices(old => ({ ...old, automaticSync: value })); if (imported) setDirty(true); }} />}
        <RowSupport><Copy muted size={14}>Titles, notes and event times stay in sync. Conflicts and unsafe alert times need review. Local alerts and completion stay in Remilo.</Copy></RowSupport>
      </View></ConnectedGroup>
      {imported && !adopting ? <>
        <ConnectedGroup title="Calendar event"><View key="event" style={{ padding: 16, gap: 12 }}>
          <Copy heading>{preview.remote.title || 'Untitled event'}</Copy><Copy>{preview.remote.notes || 'No notes'}</Copy>
          <Copy>{fieldText('schedule', preview.remote)}</Copy></View></ConnectedGroup>
        <Field label="Title" required multiline compactMultiline value={title} editable={!busy && !uncertain} maxLength={200} onChangeText={value => change({ title: value })} />
        <ConnectedGroup title="Remilo alert"><View key="mode" style={{ padding: 16 }}>
          {(['Alarm', 'Notification', 'None'] as const).map(value => <Choice key={value} label={value === 'None' ? 'No alert' : value} selected={mode === value}
            disabled={busy || uncertain} onPress={() => change({ mode: value })} />)}
        </View>
        {mode !== 'None' && alarm !== undefined && !recurring && <DateTimeFields key="time" value={alarm} zoneId={preview.remote.schedule.zoneId} allDay={false}
          disabled={busy || uncertain} onError={setError} onChange={value => change({ alarmAtMs: value })} labelPrefix="Import alert" />}
        </ConnectedGroup>
        {recurring && <View key="repeat" style={{ padding: 16, gap: 8 }}><Copy heading>Repeating event · Next dates</Copy>
          {preview.upcoming?.map(slot => <Copy key={slot.eventStartMs}>{scheduleDateTime(mode === 'None' ? slot.eventStartMs : slot.alarmAtMs, preview.remote.schedule.zoneId)}</Copy>)}
          <Copy muted>The repeat stays pinned to its event time zone. Individual alerts and completion stay in Remilo.</Copy></View>}
        {!recurring && mode !== 'None' && alarm !== undefined && alarm <= now && <ActionFeedback tone="warning" message="Choose a future alert time or No alert. This event's alert has elapsed." />}
        {choices.alarmAtMs !== undefined && <Button label="Use event's default alert" variant="secondary" disabled={busy || uncertain} onPress={() => change({ alarmAtMs: undefined })} />}
        {!busy && !uncertain && <SelectRow label="List" value={choices.listId || ''} choices={[{ value: '', label: 'No list' }, ...(lists.data || []).map(row => ({ value: row.id, label: row.name }))]}
          onChange={value => change({ listId: value || null })} />}
        <ConnectedGroup title="Google reminders"><Toggle key="suppress" label="Disable this event's Google reminders" value={choices.disableReminders || false}
          disabled={busy || uncertain} onChange={value => change({ disableReminders: value })} /></ConnectedGroup>
        <Copy muted>{preview.googleReminders ? mode === 'None' ? 'Google reminders are enabled unless you explicitly disable them. Remilo sends no alert.' : 'Google reminders are enabled. Both apps may alert unless you explicitly disable Google reminders.' : 'No Google reminders are currently configured for this event.'}</Copy>
        <Copy muted>Remilo saves first. Google reminder changes are separate and wait if the local alert is blocked or pending.</Copy>
        {dirty && <ActionFeedback message="Refresh the review to capture these choices before importing." tone="warning" />}
      </> : preview.local && <>
        {(['title', 'notes', 'schedule'] as const).map(field => <ConnectedGroup key={field} title={field === 'title' ? 'Title' : field === 'notes' ? 'Notes' : 'Schedule'}>
          <View key="choices" style={{ padding: 16, gap: 8 }}>
            {preview.baseline && <Copy muted>Last confirmed: {fieldText(field, preview.baseline)}</Copy>}
            <Choice label="Use Remilo" description={fieldText(field, preview.local!)} selected={selections[field] === 'remilo'} disabled={busy || uncertain} onPress={() => setSelections(old => ({ ...old, [field]: 'remilo' }))} />
            <Choice label="Use Google Calendar" description={fieldText(field, preview.remote)} selected={selections[field] === 'google'} disabled={busy || uncertain} onPress={() => setSelections(old => ({ ...old, [field]: 'google' }))} />
            {!selections[field] && <Copy muted>Both copies differ. Choose the value to keep.</Copy>}
          </View></ConnectedGroup>)}
        {resolved && <ConnectedGroup title="Resolution to apply"><View key="resolution" style={{ padding: 16, gap: 12 }}>
          <Copy heading>{resolved.title}</Copy><Copy>{resolved.notes || 'No notes'}</Copy><Copy>{fieldText('schedule', resolved)}</Copy>
          {timing && <><Copy>Due: {scheduleDateTime(timing.dueAtMs, resolved.schedule.zoneId)}</Copy>
            <Copy>{timing.mode === 'None' ? 'No alert' : timing.mode + ': ' + scheduleDateTime(timing.alarmAtMs, resolved.schedule.zoneId)}</Copy></>}
        </View></ConnectedGroup>}
        <Copy muted>Completion, list, sound, alert mode and independent times stay local. Linked Due and authored Alert follow the chosen schedule.</Copy>
        {elapsedChange && <ActionFeedback tone="warning" message="This schedule would move the authored alert into the past. Choose the Remilo schedule or adjust its alert in the editor, then refresh this review." />}
        {preview.nextAlertMs !== null && <Copy>Current Snooze/Postpone target is retained: {scheduleDateTime(preview.nextAlertMs)}.</Copy>}
        <Copy muted>Local changes save first. Google uses the version you reviewed. A changed version requires a new review; partial changes are not rolled back.</Copy>
      </>}
      {!busy && !uncertain && <Button label="Refresh review" variant="secondary" onPress={() => void load()} />}
    </>}
    {job && <><CalendarOperationStatus operation={job} />
      {job.localApplied && <Button label="Open reminder" variant="secondary" onPress={() => router.push({ pathname: '/reminder/[id]', params: { id: job.occurrenceId, ...origin } })} />}
      {['Conflict', 'Failed'].includes(job.state) && <Button label="Review again" variant="secondary" onPress={() => {
        if (job.localApplied) router.replace({ pathname: '/calendar-review', params: { id: job.occurrenceId, ...origin } } as Href);
        else { setOperationId(null); setPreview(null); void load(); }
      }} />}
    </>}
    {operationId && !job && <ActionFeedback loading message="Your request is saved. Checking its result…" />}
  </Page>;
}
