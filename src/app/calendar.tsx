import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { CalendarCommand, OwnedCalendar } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { calendarError } from '../domain/calendar';
import { ActionFeedback, Button, ConnectedGroup, Copy, Page, QueryState, SettingRow, Sheet } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';
import { CalendarPublicationStatus } from '../ui/calendar-publication';
import { CalendarOperationStatus } from '../ui/calendar-linked';
import type { Href } from 'expo-router';
import { useAppearanceHold } from '../ui/theme';
import { useAppearanceConfirmation } from '../ui/confirmation';

export default function CalendarSettings() {
  const params = useLocalSearchParams<OriginParams>(), routeParams = retainedOriginParams(params);
  const client = useQueryClient(), confirm = useAppearanceConfirmation();
  const connection = useQuery({ queryKey: ['calendar', 'connection'], queryFn: () => engine().getCalendarConnection(), enabled: nativeAvailable });
  const jobs = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(), enabled: nativeAvailable });
  const linkedJobs = useQuery({ queryKey: ['calendar', 'operations'], queryFn: () => engine().getCalendarOperations(), enabled: nativeAvailable });
  const [selecting, setSelecting] = useState(false), [busy, setBusy] = useState(false), [feedback, setFeedback] = useState('');
  const [rows, setRows] = useState<OwnedCalendar[]>([]), [cursor, setCursor] = useState<string | null>(null), [listLoaded, setListLoaded] = useState(false);
  const selection = useRef<CalendarCommand | null>(null);
  const [selectionPending, setSelectionPending] = useState(false);
  const needsCalendar = connection.data?.connected && !connection.data.calendarId;
  useAppearanceHold(busy || selecting);
  const refresh = () => client.invalidateQueries({ queryKey: ['calendar'] });
  const run = async (task: () => Promise<void>) => {
    if (busy) return; setBusy(true); setFeedback('');
    try { await task(); await refresh(); } catch (error) { setFeedback(calendarError(error)); } finally { setBusy(false); }
  };
  const load = (next: string | null) => run(async () => {
    const page = await engine().listOwnedCalendars(next);
    if (page.connectionRevision !== connection.data?.revision) { await refresh(); throw new Error('Connection changed'); }
    setRows((old) => next ? [...old, ...page.items.filter((item) => !old.some((row) => row.id === item.id))] : page.items);
    setCursor(page.nextCursor); setListLoaded(true);
  });
  const select = (calendar: OwnedCalendar) => run(async () => {
    if (!connection.data || selection.current) return;
    selection.current = { kind: 'SelectCalendar', operationId: engine().createOperationId(), calendarId: calendar.id, expectedConnectionRevision: connection.data.revision };
    setSelectionPending(true);
    try { await engine().applyCalendarCommand(selection.current); selection.current = null; setSelectionPending(false); setSelecting(false); }
    catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (['STALE_CONNECTION', 'NOT_OWNER', 'INVALID_INPUT', 'AUTH', 'NEEDS_ACCESS', 'FORBIDDEN'].some((value) => code.includes(value))) { selection.current = null; setSelectionPending(false); }
      throw error;
    }
  });
  const retrySelection = () => run(async () => {
    if (!selection.current) return;
    try { await engine().applyCalendarCommand(selection.current); setSelecting(false); }
    catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (['STALE_CONNECTION', 'NOT_OWNER', 'INVALID_INPUT', 'AUTH', 'NEEDS_ACCESS', 'FORBIDDEN'].some((value) => code.includes(value))) { selection.current = null; setSelectionPending(false); }
      throw error;
    }
    selection.current = null;
    setSelectionPending(false);
  });
  const authorize = () => run(async () => {
    await engine().authorizeCalendar(null);
    setRows([]); setListLoaded(false); setCursor(null);
    setFeedback('After connecting your Google account, choose a publishing calendar to finish setup. Connecting publishes nothing.');
  });
  const chooseCalendar = () => { setSelecting(true); if (!listLoaded) void load(null); };
  const disconnect = () => {
    if (!connection.data || busy || selection.current) return;
    confirm('Disconnect Google Calendar?', 'Published events remain in Google. A request already sent may still finish. Future requests stop.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Disconnect', onPress: () => void run(async () => {
      await engine().applyCalendarCommand({ kind: 'DisconnectCalendar', operationId: engine().createOperationId(), expectedConnectionRevision: connection.data!.revision });
      setRows([]); setListLoaded(false);
    }) }]);
  };
  return <Page title="Google Calendar" scrollKey="calendar-settings" onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(routeParams))}>
    <QueryState loading={connection.isLoading && nativeAvailable} error={connection.error} empty={!nativeAvailable} emptyMessage="Use the Android app to connect Google Calendar." onRetry={() => void refresh()} />
    <Copy muted>Optional publishing, individual imports and manually reviewed linked updates. Local reminders and alarms work without Google or network access.</Copy>
    <Button label="Import from Google Calendar" disabled={busy || selectionPending || !connection.data?.connected}
      onPress={() => router.push({ pathname: '/calendar-import', params: routeParams } as Href)} />
    {connection.data?.available === false && <ActionFeedback message="Google Play services is unavailable or needs updating. Google authorization cannot open on this device." tone="warning" />}
    {needsCalendar && <><ActionFeedback message="Google account connected. Choose a publishing calendar to finish setup." tone="warning" />
      <Button label="Choose publishing calendar" disabled={busy || selectionPending || !connection.data?.available} onPress={chooseCalendar} /></>}
    {connection.data && <ConnectedGroup title="Publishing setup" footer={<Copy muted>Both a connected Google account and a selected calendar are required. Setup publishes nothing.</Copy>}>
      <SettingRow key="connect" icon="event" label={connection.data.connected ? '1. Google account' : '1. Connect Google account'} value={connection.data.connected ? connection.data.email : undefined}
        description={connection.data.connected ? 'Connected · tap to change account' : 'Allow Remilo to access Google Calendar.'}
        disabled={busy || selectionPending || !connection.data.available} onPress={authorize} />
      <SettingRow key="calendar" icon="event" label="2. Publishing calendar" value={connection.data.calendarName || 'Not selected'}
        description="Choose a calendar you own where published tasks will appear."
        disabled={busy || selectionPending || !connection.data.available || !connection.data.connected} onPress={chooseCalendar} />
      {connection.data.connected && <SettingRow key="disconnect" icon="close" label="Disconnect" disabled={busy || selectionPending} onPress={disconnect} />}
    </ConnectedGroup>}
    {connection.data?.message && <Copy muted>{connection.data.message}</Copy>}
    {!!feedback && <ActionFeedback message={feedback} tone="warning" />}
    {busy && <ActionFeedback loading message="Checking Google Calendar…" />}
    {selectionPending && !busy && <Button label="Retry same calendar selection" variant="secondary" onPress={() => void retrySelection()} />}
    {jobs.error && <ActionFeedback message="Saved publication status could not be refreshed. Retry before starting another publication." tone="warning" />}
    {jobs.data?.map((publication) => <CalendarPublicationStatus key={publication.operationId} publication={publication} routeParams={routeParams} />)}
    {linkedJobs.error && <ActionFeedback message="Saved linked operation status could not be refreshed." tone="warning" />}
    {linkedJobs.data?.map(operation => <CalendarOperationStatus key={operation.operationId} operation={operation} />)}
    <Sheet visible={selecting} title="Choose an owned calendar" onClose={() => { if (!busy && !selection.current) setSelecting(false); }}>
      <View style={{ gap: 12 }}>
        <Copy muted>Only calendars you own are available. Changing this default leaves previous publications in their original destination.</Copy>
        {rows.length > 0 && <ConnectedGroup>{rows.map((calendar) => <SettingRow key={calendar.id} label={calendar.name} description={calendar.zoneId}
          disabled={busy || selectionPending} onPress={() => void select(calendar)} />)}</ConnectedGroup>}
        {listLoaded && rows.length === 0 && <Copy>No owned calendars were found.</Copy>}
        {!!feedback && <ActionFeedback message={feedback} tone="warning" />}
        {busy && <ActionFeedback loading message="Checking calendars…" />}
        {selectionPending && !busy ? <Button label="Retry same calendar selection" variant="secondary" onPress={() => void retrySelection()} /> :
          <Button label={cursor ? 'Load more calendars' : 'Refresh calendars'} variant="secondary" disabled={busy} onPress={() => void load(cursor)} />}
      </View>
    </Sheet>
  </Page>;
}
