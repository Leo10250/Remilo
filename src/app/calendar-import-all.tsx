import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { CalendarCommand, CalendarImportChoices, CalendarImportBatchResult, CalendarLinkPreview } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { collectCalendarImports, excludedCalendarImports } from '../domain/calendar-import';
import { calendarCaptureRejected } from '../domain/calendar-link';
import { calendarError } from '../domain/calendar';
import { calendarImportIndependence } from '../domain/calendar-presentation';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, Field, Page, SelectRow, SettingRow, Sheet, Toggle } from '../ui/components';
import { CalendarOperationStatus } from '../ui/calendar-linked';
import { DateTimeFields } from '../ui/date-time-fields';
import { engine, nativeAvailable } from '../ui/native';
import { useTimeFormatting } from '../ui/time-display';
import { useAppearanceHold } from '../ui/theme';
import { useAppearanceConfirmation } from '../ui/confirmation';

type Entry = { eventId: string; preview: CalendarLinkPreview };
export default function CalendarImportAll() {
  const params = useLocalSearchParams<OriginParams & { calendarId: string; from: string; until: string }>(), origin = retainedOriginParams(params);
  const client = useQueryClient(), confirm = useAppearanceConfirmation(), { scheduleDateTime, formatDate } = useTimeFormatting();
  const [entries, setEntries] = useState<Entry[]>([]), [overrides, setOverrides] = useState<Record<string, CalendarImportChoices>>({});
  const [mode, setMode] = useState<'Alarm' | 'Notification' | 'None'>('Alarm'), [listId, setListId] = useState<string | null>(null), [suppress, setSuppress] = useState(false);
  const [automaticSync, setAutomaticSync] = useState(true);
  const [reading, setReading] = useState(false), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [ready, setReady] = useState(false);
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [selected, setSelected] = useState<string | null>(null);
  const [operationIds, setOperationIds] = useState<string[]>([]), [account, setAccount] = useState(''), [now, setNow] = useState(Date.now);
  const captured = useRef<Extract<CalendarCommand, { kind: 'ImportCalendarEvents' }> | null>(null), running = useRef(false), live = useRef(true), ticket = useRef(0);
  const operations = useQuery({ queryKey: ['calendar', 'operations'], queryFn: () => engine().getCalendarOperations(), enabled: nativeAvailable });
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().getLists(), enabled: nativeAvailable });
  const ids = new Set(operationIds), jobs = (operations.data || []).filter(job => ids.has(job.operationId));
  const back = () => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin));
  useAppearanceHold(busy || uncertain);
  usePreventRemove(busy || uncertain, () => confirm('Import request not confirmed', 'Wait or retry the same captured imports before leaving.'));
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(timer); }, []);
  const load = useCallback(async () => {
    if (running.current || captured.current) return;
    running.current = true; setReading(true); setReady(false); setError(''); setOperationIds([]);
    const current = ++ticket.current, active = () => live.current && ticket.current === current;
    try {
      const connection = await engine().getCalendarConnection();
      if (!connection.connected) throw Object.assign(new Error('Access needed'), { code: 'NEEDS_ACCESS' });
      const [links, saved] = await Promise.all([engine().getCalendarLinks(), engine().getCalendarOperations()]);
      const events = await collectCalendarImports({ calendarId: params.calendarId, from: params.from, until: params.until, cursor: null },
        connection.revision, query => engine().listCalendarEvents(query), excludedCalendarImports(params.calendarId, links, saved), active,
        count => setMessage('Checking all dates… ' + count + ' eligible events found.'));
      const reviewed: Entry[] = [];
      for (const event of events) {
        if (!active()) return;
        setMessage('Preparing review ' + (reviewed.length + 1) + ' of ' + events.length + '…');
        try {
          const preview = await engine().previewCalendarImport({ calendarId: params.calendarId, eventId: event.eventId }, {});
          if (active()) reviewed.push({ eventId: event.eventId, preview });
        } catch (e) {
          if (!(e && typeof e === 'object' && 'code' in e && String(e.code).includes('ALREADY_IMPORTED'))) throw e;
        }
      }
      if ((await engine().getCalendarConnection()).revision !== connection.revision) throw Object.assign(new Error('Account changed'), { code: 'STALE_CONNECTION' });
      if (!active()) return;
      setEntries(reviewed); setOverrides(old => Object.fromEntries(reviewed.filter(entry => old[entry.eventId]).map(entry => [entry.eventId, old[entry.eventId]])));
      setAccount(connection.email); setReady(true);
    } catch (e) { if (active()) setError(calendarError(e)); }
    finally { running.current = false; if (active()) setReading(false); }
  }, [params.calendarId, params.from, params.until]);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => {
    const tickets = ticket; live.current = true;
    void Promise.resolve().then(() => { if (live.current) return loadRef.current(); });
    return () => { live.current = false; tickets.current++; };
  }, [params.calendarId, params.from, params.until]);
  const choices = (entry: Entry): CalendarImportChoices => ({ mode, listId, disableReminders: suppress, automaticSync, ...overrides[entry.eventId] });
  const title = (entry: Entry) => choices(entry).title ?? entry.preview.choices.title ?? entry.preview.remote.title;
  const alert = (entry: Entry) => choices(entry).alarmAtMs ?? (entry.preview.recurrence ? entry.preview.nextAlertMs ?? 0 : entry.preview.choices.alarmAtMs);
  const invalid = entries.filter(entry => !title(entry)?.trim() || entry.preview.recurrence && !entry.preview.upcoming?.length || choices(entry).mode !== 'None' && alert(entry) <= now);
  const edited = entries.find(entry => entry.eventId === selected);
  const locked = busy || uncertain || operationIds.length > 0;
  const change = (eventId: string, next: CalendarImportChoices) => { if (!locked) setOverrides(old => ({ ...old, [eventId]: { ...old[eventId], ...next } })); };
  const apply = async () => {
    if (running.current || !ready || !entries.length) return;
    captured.current ??= { kind: 'ImportCalendarEvents', operationId: engine().createOperationId(),
      items: entries.map(entry => ({ previewId: entry.preview.previewId, choices: choices(entry) })) };
    running.current = true; setBusy(true); setError('');
    try {
      const result = await engine().applyCalendarCommand(captured.current) as CalendarImportBatchResult;
      setOperationIds(result.operations.map(job => job.operationId)); captured.current = null; setUncertain(false); setSelected(null);
      await client.invalidateQueries();
    } catch (e) {
      if (calendarCaptureRejected(e)) { captured.current = null; setUncertain(false); }
      else setUncertain(true);
      setError(calendarError(e));
    } finally { running.current = false; setBusy(false); }
  };
  return <Page compact title="Import all Calendar events" onBack={back} footer={!operationIds.length && ready && entries.length ? <BottomActionBar>
    <Button label={uncertain ? 'Retry same imports' : 'Import all (' + entries.length + ')'} disabled={busy || !uncertain && invalid.length > 0} onPress={() => void apply()} />
    <Button label="Cancel" variant="secondary" disabled={busy || uncertain} onPress={back} />
  </BottomActionBar> : undefined}>
    <Copy muted>All eligible events in your selected dates are included, across every page. Imported, pending and unsupported events are skipped.</Copy>
    <Copy muted>{calendarImportIndependence}</Copy>
    {!!error && <ActionFeedback message={error} tone="warning" />}
    {reading && <ActionFeedback message={message || 'Checking all selected dates…'} loading />}
    {!reading && !ready && <Button label="Retry review" variant="secondary" onPress={() => void load()} />}
    {ready && !operationIds.length && <>
      <Copy>{account}{entries[0] ? ' · ' + entries[0].preview.calendarName : ''}</Copy>
      <Copy heading>{entries.length ? entries.length + ' events to import' : 'No new eligible events in these dates.'}</Copy>
      {!!entries.length && <>
        <ConnectedGroup title="Linked updates"><Toggle key="automatic" label="Automatic sync" value={automaticSync} disabled={locked} onChange={setAutomaticSync} /></ConnectedGroup>
        <Copy muted>Confirmation enables ordinary Title, Notes and Schedule transfers for selected automatic links. Conflicts and unsafe timing need review. Local alerts, completion, Trash and postponement stay independent.</Copy>
        <ConnectedGroup title="Alerts for all reminders"><View key="modes" style={{ padding: 16 }}>
          {(['Alarm', 'Notification', 'None'] as const).map(value => <Choice key={value} label={value === 'None' ? 'No alert' : value} selected={mode === value} disabled={locked}
            onPress={() => { setMode(value); setOverrides(old => Object.fromEntries(Object.entries(old).map(([id, values]) => { const { mode: _mode, ...rest } = values; return [id, rest]; }))); }} />)}
        </View></ConnectedGroup>
        {!locked && <SelectRow label="List for all reminders" value={listId || ''} choices={[{ value: '', label: 'No list' }, ...(lists.data || []).map(list => ({ value: list.id, label: list.name }))]} onChange={value => setListId(value || null)} />}
        <ConnectedGroup title="Google reminders"><Toggle key="suppress" label="Disable Google reminders for all imported events" value={suppress} disabled={locked}
          onChange={value => { setSuppress(value); setOverrides(old => Object.fromEntries(Object.entries(old).map(([id, values]) => { const { disableReminders: _disable, ...rest } = values; return [id, rest]; }))); }} /></ConnectedGroup>
        <Copy muted>Google reminders are kept by default. {entries.some(entry => choices(entry).mode !== 'None') ? 'Both apps may alert.' : 'Remilo sends no alert for these reminders.'} Any requested Google change waits for the local save and is reported separately.</Copy>
        {!!invalid.length && <ActionFeedback tone="warning" message={invalid.length + ' events need a title or future alert. Open those events to correct them, or explicitly choose No alert.'} />}
        <ConnectedGroup title="Review events">{entries.map(entry => <SettingRow key={entry.eventId} label={title(entry) || 'Title required'} disabled={locked}
          description={(entry.preview.remote.schedule.allDay ? formatDate(entry.preview.remote.schedule.eventStartMs, entry.preview.remote.schedule.zoneId) + ' · All day' : scheduleDateTime(entry.preview.remote.schedule.eventStartMs, entry.preview.remote.schedule.zoneId)) + ' · ' +
            (choices(entry).mode === 'None' ? 'No alert' : choices(entry).mode + ' ' + scheduleDateTime(alert(entry), entry.preview.remote.schedule.zoneId)) + ' · ' + entry.preview.remote.schedule.zoneId + (invalid.includes(entry) ? ' · Needs review' : '')}
          onPress={() => setSelected(entry.eventId)} />)}</ConnectedGroup>
        <Button label="Refresh all reviews" variant="secondary" disabled={locked} onPress={() => void load()} />
      </>}
    </>}
    {!!operationIds.length && <>
      <Copy heading>{operationIds.length} import requests saved</Copy>
      <Copy>{jobs.filter(job => job.localApplied).length} local reminders saved. Each Google and scheduling outcome is shown below.</Copy>
      {jobs.map(job => <CalendarOperationStatus key={job.operationId} operation={job} />)}
      <Button label="Back to events" variant="secondary" onPress={back} />
    </>}
    <Sheet title="Review event import" visible={!!edited} onClose={() => setSelected(null)}>
      {edited && <>
        <Copy>{edited.preview.remote.title || 'Untitled event'}</Copy><Copy>{edited.preview.remote.notes || 'No notes'}</Copy>
        <Copy>{scheduleDateTime(edited.preview.remote.schedule.eventStartMs, edited.preview.remote.schedule.zoneId)} – {scheduleDateTime(edited.preview.remote.schedule.eventEndMs, edited.preview.remote.schedule.zoneId)} · {edited.preview.remote.schedule.zoneId}</Copy>
        <Copy muted>Checked {scheduleDateTime(edited.preview.checkedAtMs)}. Confirming rechecks this event.</Copy>
        <Field label="Title" required multiline compactMultiline value={title(edited)} maxLength={200} editable={!locked} onChangeText={value => change(edited.eventId, { title: value })} />
        {(['Alarm', 'Notification', 'None'] as const).map(value => <Choice key={value} label={value === 'None' ? 'No alert' : value} selected={choices(edited).mode === value} disabled={locked} onPress={() => change(edited.eventId, { mode: value })} />)}
        {choices(edited).mode !== 'None' && !edited.preview.recurrence && <DateTimeFields labelPrefix="Import alert" value={alert(edited)} zoneId={edited.preview.remote.schedule.zoneId} allDay={false} disabled={locked} onError={setError} onChange={value => change(edited.eventId, { alarmAtMs: value })} />}
        {edited.preview.recurrence && <Copy muted>Repeating event. Its next dates and alerts follow the named event zone; edit individual alerts in Remilo after import.</Copy>}
        <Toggle label="Disable this event's Google reminders" value={choices(edited).disableReminders || false} disabled={locked} onChange={value => change(edited.eventId, { disableReminders: value })} />
        <Toggle label="Automatic sync for this event" value={choices(edited).automaticSync ?? true} disabled={locked} onChange={value => change(edited.eventId, { automaticSync: value })} />
        <Copy muted>{edited.preview.googleReminders ? 'Google reminders are currently enabled.' : 'No Google reminders are currently configured.'}</Copy>
        <Button label="Done reviewing" onPress={() => setSelected(null)} />
      </>}
    </Sheet>
  </Page>;
}
