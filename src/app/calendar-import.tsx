import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { CalendarEventPage, OwnedCalendar } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { calendarError } from '../domain/calendar';
import { unsupportedCalendarReason } from '../domain/calendar-link';
import { civilAt, deviceZone } from '../domain/time';
import { ActionFeedback, Button, ConnectedGroup, Copy, DateField, Page, SettingRow, Sheet } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';
import { useTimeFormatting } from '../ui/time-display';

export default function CalendarImportBrowser() {
  const { scheduleDateTime, formatDate } = useTimeFormatting();
  const params = retainedOriginParams(useLocalSearchParams<OriginParams>());
  const connection = useQuery({ queryKey: ['calendar', 'connection'], queryFn: () => engine().getCalendarConnection(), enabled: nativeAvailable });
  const [savedCalendars, setCalendars] = useState<OwnedCalendar[]>([]), [savedCalendarCursor, setCalendarCursor] = useState<string | null>(null);
  const [calendarsRevision, setCalendarsRevision] = useState<number | null>(null), [sourceRevision, setSourceRevision] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false), [savedCalendar, setCalendar] = useState<OwnedCalendar | null>(null);
  const calendars = calendarsRevision === connection.data?.revision ? savedCalendars : [];
  const calendarCursor = calendarsRevision === connection.data?.revision ? savedCalendarCursor : null;
  const calendar = sourceRevision === connection.data?.revision ? savedCalendar : null;
  const [from, setFrom] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); });
  const [until, setUntil] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 30); return d.getTime(); });
  const [rows, setRows] = useState<CalendarEventPage['items']>([]), [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false), [error, setError] = useState('');
  const filterKey = JSON.stringify([calendar?.id, from, until, connection.data?.revision]);
  const [resultKey, setResultKey] = useState('');
  const visibleRows = resultKey === filterKey ? rows : [], visibleCursor = resultKey === filterKey ? cursor : null;
  const ticket = useRef(0), running = useRef(false);
  useEffect(() => { ticket.current++; }, [filterKey]);
  useEffect(() => () => { ticket.current++; }, []);
  const loadCalendars = async (next: string | null = null) => {
    if (running.current) return; running.current = true; setBusy(true); setError(''); setSelecting(true);
    const current = ++ticket.current, revision = connection.data?.revision;
    try {
      const page = await engine().listOwnedCalendars(next);
      if (current !== ticket.current || page.connectionRevision !== revision) return;
      setCalendars(old => next ? [...old, ...page.items.filter(item => !old.some(row => row.id === item.id))] : page.items);
      setCalendarsRevision(page.connectionRevision); setCalendarCursor(page.nextCursor);
    }
    catch (e) { setError(calendarError(e)); } finally { running.current = false; setBusy(false); }
  };
  const load = async (next: string | null = null) => {
    if (!calendar || running.current) return;
    const current = ++ticket.current; running.current = true; setBusy(true); setError('');
    try {
      const page = await engine().listCalendarEvents({ calendarId: calendar.id,
        from: civilAt(from, deviceZone()).slice(0, 10), until: civilAt(until, deviceZone()).slice(0, 10), cursor: next });
      if (current !== ticket.current || page.connectionRevision !== connection.data?.revision) return;
      setRows(old => next ? [...old, ...page.items.filter(item => !old.some(row => row.eventId === item.eventId))] : page.items);
      setCursor(page.nextCursor); setLoaded(true); setResultKey(filterKey);
    } catch (e) { if (current === ticket.current) setError(calendarError(e)); }
    finally { running.current = false; setBusy(false); }
  };
  return <Page title="Import from Google Calendar" scrollKey="calendar-import" onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(params))}>
    <Copy muted>Choose one personal event to review. Browsing imports nothing and leaves your publishing destination unchanged.</Copy>
    {!connection.data?.connected && <Button label="Open Calendar settings" onPress={() => router.push({ pathname: '/calendar', params })} />}
    <ConnectedGroup title="Source and dates">
      <SettingRow key="account" label="Google account" value={connection.data?.email || 'Not connected'} />
      <SettingRow key="calendar" label="Source calendar" value={calendar?.name || 'Choose an owned calendar'} disabled={busy || !connection.data?.connected} onPress={() => void loadCalendars()} />
      <DateField key="from" label="From date" dateOnly value={from} disabled={busy} onChange={setFrom} onError={setError} />
      <DateField key="until" label="Before date" dateOnly value={until} disabled={busy} onChange={setUntil} onError={setError} />
    </ConnectedGroup>
    <Copy muted>The end date is excluded. Choose a range of up to 366 days.</Copy>
    <Button label="Browse events" disabled={busy || !calendar || !connection.data?.connected} onPress={() => void load()} />
    {!!error && <ActionFeedback message={error} tone="warning" />}
    {busy && <ActionFeedback loading message="Reading Google Calendar…" />}
    {loaded && resultKey === filterKey && visibleRows.length === 0 && <Copy>No events in this page. Recurring events and meetings cannot be imported yet.</Copy>}
    {!!visibleRows.length && <ConnectedGroup title="Events">{visibleRows.map((event) => <SettingRow key={event.eventId} icon="event" label={event.title || 'Untitled event'}
      description={event.erased ? 'Previously imported and permanently deleted.' : event.occurrenceId ? 'Already in Remilo · open reminder' : event.unsupportedReason ? unsupportedCalendarReason(event.unsupportedReason) : event.fields ?
        (event.fields.schedule.allDay ? formatDate(event.fields.schedule.eventStartMs, event.fields.schedule.zoneId) + ' · All day' : scheduleDateTime(event.fields.schedule.eventStartMs, event.fields.schedule.zoneId)) : 'Review this event before importing'}
      disabled={busy || event.erased || !event.occurrenceId && !!event.unsupportedReason}
      onPress={() => event.occurrenceId ? router.push({ pathname: '/reminder/[id]', params: { ...params, id: event.occurrenceId } }) :
        router.push({ pathname: '/calendar-review', params: { ...params, calendarId: calendar!.id, eventId: event.eventId } } as Href)} />)}</ConnectedGroup>}
    {visibleCursor && <Button label="Load more" variant="secondary" disabled={busy} onPress={() => void load(visibleCursor)} />}
    <Sheet title="Choose source calendar" visible={selecting} onClose={() => { if (!busy) setSelecting(false); }}>
      <Copy muted>Only calendars you own. This does not change your publishing calendar.</Copy>
      <ConnectedGroup>{calendars.map(row => <SettingRow key={row.id} label={row.name} description={row.zoneId} disabled={busy} onPress={() => { setCalendar(row); setSourceRevision(connection.data!.revision); setSelecting(false); }} />)}</ConnectedGroup>
      {calendarCursor && <Button label="Load more calendars" variant="secondary" disabled={busy} onPress={() => void loadCalendars(calendarCursor)} />}
      {!calendars.length && !busy && <Copy>No owned calendars found.</Copy>}
      {!!error && <ActionFeedback message={error} tone="warning" />}
    </Sheet>
  </Page>;
}
