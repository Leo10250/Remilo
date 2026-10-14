import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { CalendarCommand, ManagedCalendarCommand, OwnedCalendar } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { calendarError } from '../domain/calendar';
import { calendarCaptureRejected } from '../domain/calendar-link';
import { managedCalendarStatus } from '../domain/calendar-managed';
import { ActionFeedback, Button, ConnectedGroup, Copy, Page, QueryState, SettingRow, Sheet, Toggle } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';
import { CalendarPublicationStatus } from '../ui/calendar-publication';
import { CalendarOperationStatus } from '../ui/calendar-linked';
import type { Href } from 'expo-router';
import { useAppearanceHold } from '../ui/theme';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { useTimeFormatting } from '../ui/time-display';

export default function CalendarSettings() {
  const params = useLocalSearchParams<OriginParams>(), routeParams = retainedOriginParams(params);
  const client = useQueryClient(), confirm = useAppearanceConfirmation();
  const { scheduleDateTime } = useTimeFormatting();
  const connection = useQuery({ queryKey: ['calendar', 'connection'], queryFn: () => engine().getCalendarConnection(), enabled: nativeAvailable });
  const jobs = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(), enabled: nativeAvailable });
  const linkedJobs = useQuery({ queryKey: ['calendar', 'operations'], queryFn: () => engine().getCalendarOperations(), enabled: nativeAvailable });
  const sync = useQuery({ queryKey: ['calendar', 'sync-summary'], queryFn: () => engine().getCalendarSyncSummary(), enabled: nativeAvailable });
  const managed = useQuery({ queryKey: ['calendar', 'managed'], queryFn: () => engine().getManagedCalendarState(), enabled: nativeAvailable });
  const [selecting, setSelecting] = useState(false), [busy, setBusy] = useState(false), [feedback, setFeedback] = useState('');
  const [rows, setRows] = useState<OwnedCalendar[]>([]), [cursor, setCursor] = useState<string | null>(null), [listLoaded, setListLoaded] = useState(false);
  const selection = useRef<CalendarCommand | null>(null);
  const [selectionPending, setSelectionPending] = useState(false);
  const managedCapture = useRef<ManagedCalendarCommand | null>(null), [managedUncertain, setManagedUncertain] = useState(false);
  const needsCalendar = connection.data?.connected && !connection.data.calendarId && managed.data?.phase === 'NotConfigured';
  useAppearanceHold(busy || selecting || managedUncertain);
  usePreventRemove(managedUncertain, () => confirm('Calendar action not confirmed', 'Retry the same captured action before leaving.'));
  const refresh = () => client.invalidateQueries({ queryKey: ['calendar'] });
  const run = async (task: () => Promise<void>) => {
    if (busy) return; setBusy(true); setFeedback('');
    try { await task(); await refresh(); } catch (error) { setFeedback(calendarError(error)); } finally { setBusy(false); }
  };
  const managedAction = (command?: ManagedCalendarCommand) => run(async () => {
    managedCapture.current ??= command ?? null;
    if (!managedCapture.current) return;
    try { await engine().applyCalendarCommand(managedCapture.current); managedCapture.current = null; setManagedUncertain(false); }
    catch (error) { if (calendarCaptureRejected(error)) { managedCapture.current = null; setManagedUncertain(false); } else setManagedUncertain(true); throw error; }
  });
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
  const authorize = (managedOperationId: string | null = null) => run(async () => {
    await engine().authorizeCalendar(managedOperationId);
    setRows([]); setListLoaded(false); setCursor(null);
    setFeedback('Google account connected. Review Remilo calendar setup to enable automatic import and new-reminder sync. Connecting alone changes no reminders.');
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
    <Copy muted>Use an owned Remilo calendar for automatic reminders and ordinary linked updates. Local reminders and alarms work without Google or network access.</Copy>
    {managed.error && <ActionFeedback message="Saved Remilo calendar setup could not be refreshed." tone="warning" />}
    {managed.data && <ConnectedGroup title="Remilo calendar">
      <SettingRow key="managed" icon="event" label={managedCalendarStatus(managed.data)} value={managed.data.calendarName || 'Not selected'}
        description={managed.data.message || 'A known Remilo calendar is reused; otherwise setup reviews an existing match or creates one.'} disabled={busy || managedUncertain || !connection.data?.connected}
        onPress={() => router.push({ pathname: '/calendar-managed', params: { ...routeParams, mode: ['NotConfigured', 'Reviewing', 'AccessRequired', 'CalendarUnavailable', 'OwnershipUnknown'].includes(managed.data!.phase) || managed.data!.mode === 'Disabled' ? 'setup' : 'policy' } })} />
      {!!managed.data.calendarZone && <Copy muted>Calendar time zone: {managed.data.calendarZone}</Copy>}
      {!!managed.data.pendingChangeCount && <Copy muted>{managed.data.pendingChangeCount} linked changes waiting</Copy>}
      {!!managed.data.recoveryCount && <Copy muted>{managed.data.recoveryCount} recovered reminders with No alert</Copy>}
      {managed.data.successfulAtMs != null && <Copy muted>Last successful sync {scheduleDateTime(managed.data.successfulAtMs)}</Copy>}
      {managed.data.lastObservedAtMs != null && <Copy muted>Last observed {scheduleDateTime(managed.data.lastObservedAtMs)}</Copy>}
      {managed.data.failedAtMs != null && <Copy muted>Last failed attempt {scheduleDateTime(managed.data.failedAtMs)}</Copy>}
      {!!managed.data.calendarId && <SettingRow key="policy" label="New reminder defaults" description={'Incoming: ' + (managed.data.policy.importMode === 'None' ? 'No alert' : managed.data.policy.importMode) + ' · New Remilo reminders: ' + (managed.data.policy.exportNewReminders ? 'Sync automatically' : 'Local only by default')}
        disabled={busy || managedUncertain} onPress={() => router.push({ pathname: '/calendar-managed', params: { ...routeParams, mode: 'policy' } })} />}
      {managed.data.mode === 'Paused' && <SettingRow key="resume" icon="play_arrow" label="Review and resume" value={String(managed.data.heldExportCount + managed.data.pendingExportCount)}
        description="Your local alerts continue. New reminders selected for sync and compatible edits wait for reviewed resume."
        disabled={busy || managedUncertain || !connection.data?.connected} onPress={() => router.push({ pathname: '/calendar-managed', params: { ...routeParams, mode: 'resume' } })} />}
      {managed.data.mode === 'Enabled' && <SettingRow key="pause" icon="pause" label="Pause Remilo calendar sync" description="Other Calendar sources keep their own permissions. Explicit manual actions remain available."
        disabled={busy || managedUncertain} onPress={() => confirm('Pause Remilo calendar sync?', 'Your local alerts continue. New reminders selected for sync and compatible edits will wait for a reviewed resume. A request already sent may still finish.',
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Pause', onPress: () => void managedAction({ kind: 'PauseManagedCalendar', operationId: engine().createOperationId(), expectedRevision: managed.data!.revision }) }])} />}
      {managed.data.mode !== 'Disabled' && <SettingRow key="disable" icon="link_off" label="Stop managed sync" description="Keep local reminders, alerts and Google events. Fresh setup review is needed before restarting."
        disabled={busy || managedUncertain} onPress={() => confirm('Stop managed Calendar sync?', 'Keep your reminders, local alerts and Google events. Automatic work in the Remilo calendar stops. Other Calendar sources keep their own permissions. A request already sent may still finish.',
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Stop managed sync', onPress: () => void managedAction({ kind: 'DisableManagedCalendar', operationId: engine().createOperationId(), expectedRevision: managed.data!.revision }) }])} />}
      {managed.data.initialMode === 'None' && managed.data.initialRecoveryComplete && <SettingRow key="recovered" icon="alarm" label="Review recovered alerts" description="Initial recovered reminders have No alert. Enable selected future alarms after review."
        disabled={busy || managedUncertain} onPress={() => router.push({ pathname: '/calendar-managed', params: { ...routeParams, mode: 'recovered' } })} />}
      {!!managed.data.calendarId && <SettingRow key="history" icon="history" label="Import older events" description="Review a selected date range. Elapsed alerts never replay."
        disabled={busy || managedUncertain || !connection.data?.connected} onPress={() => router.push({ pathname: '/calendar-import', params: { ...routeParams, managedHistory: 'true', calendarId: managed.data!.calendarId } } as Href)} />}
    </ConnectedGroup>}
    {managed.data?.phase === 'NotConfigured' && <Button label="Review Remilo calendar setup" disabled={busy || managedUncertain || !connection.data?.connected}
      onPress={() => router.push({ pathname: '/calendar-managed', params: { ...routeParams, mode: 'setup' } })} />}
    {managed.data?.phase === 'CreationUnconfirmed' && managed.data.operationId && <Button label="Check calendar creation result" variant="secondary" disabled={busy || managedUncertain}
      onPress={() => void managedAction({ kind: 'RetryManagedCalendarOperation', operationId: managed.data!.operationId! })} />}
    {managed.data?.phase === 'CreationUnconfirmed' && <><Copy muted>The original request may have created a calendar. Inspect its result before confirming a replacement. Remilo keeps any existing Google calendars.</Copy>
      <Button label="Review replacement calendar" variant="secondary" disabled={busy || managedUncertain || !connection.data?.connected}
        onPress={() => router.push({ pathname: '/calendar-managed', params: { ...routeParams, mode: 'setup', replacement: 'true' } })} /></>}
    {managed.data?.phase === 'AccessRequired' && <><Copy muted>Use the original Google account for this Remilo calendar. Renewed access does not by itself grant automatic update permission.</Copy>
      <Button label="Review Google access" variant="secondary" disabled={busy || managedUncertain || !connection.data?.available} onPress={() => void authorize(managed.data!.operationId || null)} />
      {connection.data?.connected && <Button label="Review Remilo calendar recovery" disabled={busy || managedUncertain} onPress={() => router.push({ pathname: '/calendar-managed', params: { ...routeParams, mode: 'setup' } })} />}</>}
    {!!managed.data && ['CalendarUnavailable', 'OwnershipUnknown', 'Reviewing'].includes(managed.data.phase) && <Button label="Review Remilo calendar recovery" variant="secondary" disabled={busy || managedUncertain || !connection.data?.connected}
      onPress={() => router.push({ pathname: '/calendar-managed', params: { ...routeParams, mode: 'setup' } })} />}
    {managedUncertain && <Button label="Retry same Calendar action" variant="secondary" disabled={busy} onPress={() => void managedAction()} />}
    {!!managed.data && (managed.data.pendingExportCount > 0 || managed.data.heldExportCount > 0) && <Copy muted>{managed.data.pendingExportCount} reminders waiting to publish · {managed.data.heldExportCount} held while paused</Copy>}
    <ConnectedGroup title="Linked updates">
      <SettingRow key="activate" icon="event" label="Enable automatic sync for existing links" description="Review eligible reminders and their source calendars before confirming." disabled={busy || !connection.data?.connected}
        onPress={() => router.push({ pathname: '/calendar-activate', params: routeParams } as Href)} />
      <SettingRow key="review" icon="event" label="Calendar review" value={String(sync.data?.reviewCount ?? 0)} onPress={() => router.push({ pathname: '/calendar-reviews', params: routeParams } as Href)} />
      {sync.data && <Toggle key="notifications" label="Calendar review notifications" value={sync.data.notifications.enabled} disabled={busy}
        onChange={value => void run(async () => { await engine().applyCalendarCommand({ kind: 'SetCalendarReviewNotifications', operationId: engine().createOperationId(), expectedRevision: sync.data!.notifications.revision, enabled: value }); })} />}
    </ConnectedGroup>
    <Copy muted>Background sync requests an hourly opportunity while connected. Android may delay it. Review notifications are quiet and use existing notification permission.</Copy>
    {sync.data?.lastRun && <Copy muted>Last sync run {scheduleDateTime(sync.data.lastRun.atMs)}: {sync.data.lastRun.confirmed} confirmed updates
      {sync.data.lastRun.imported != null ? ' · ' + sync.data.lastRun.imported + ' imported' : ''}{sync.data.lastRun.published != null ? ' · ' + sync.data.lastRun.published + ' published' : ''}
      {sync.data.lastRun.continuation ? ' · More work is queued' : ''}</Copy>}
    <Button label="Sync now" variant="secondary" disabled={busy || !connection.data?.connected} onPress={() => void run(async () => { await engine().syncCalendarNow(null); })} />
    <Button label="Import from Google Calendar" disabled={busy || selectionPending || !connection.data?.connected}
      onPress={() => router.push({ pathname: '/calendar-import', params: routeParams } as Href)} />
    {connection.data?.available === false && <ActionFeedback message="Google Play services is unavailable or needs updating. Google authorization cannot open on this device." tone="warning" />}
    {needsCalendar && <><ActionFeedback message="Review Remilo calendar setup, or choose an owned calendar for separate manual publication." tone="warning" />
      <Button label="Choose publishing calendar" disabled={busy || selectionPending || !connection.data?.available} onPress={chooseCalendar} /></>}
    {connection.data && <ConnectedGroup title="Google account and manual publishing" footer={<Copy muted>Connecting alone changes no reminders. Choosing a manual destination leaves existing links in their original calendars.</Copy>}>
      <SettingRow key="connect" icon="event" label={connection.data.connected ? 'Google account' : 'Connect Google account'} value={connection.data.connected ? connection.data.email : undefined}
        description={connection.data.connected ? 'Connected · tap to change account' : 'Allow Remilo to access Google Calendar.'}
        disabled={busy || selectionPending || managedUncertain || !connection.data.available} onPress={() => void authorize()} />
      <SettingRow key="calendar" icon="event" label="Manual publishing calendar" value={connection.data.calendarName || 'Not selected'}
        description="Choose a calendar you own where published tasks will appear."
        disabled={busy || selectionPending || !connection.data.available || !connection.data.connected} onPress={chooseCalendar} />
      {connection.data.connected && <SettingRow key="disconnect" icon="close" label="Disconnect" disabled={busy || selectionPending} onPress={disconnect} />}
    </ConnectedGroup>}
    {connection.data?.message && <Copy muted>{connection.data.message}</Copy>}
    {!!feedback && <ActionFeedback message={feedback} tone="warning" />}
    {busy && <ActionFeedback loading message="Checking Google Calendar…" />}
    {selectionPending && !busy && <Button label="Retry same calendar selection" variant="secondary" onPress={() => void retrySelection()} />}
    {jobs.error && <ActionFeedback message="Saved publication status could not be refreshed. Retry before starting another publication." tone="warning" />}
    {jobs.data?.filter(publication => publication.state !== 'Published' && publication.state !== 'Cancelled').map((publication) => <CalendarPublicationStatus key={publication.operationId} publication={publication} routeParams={routeParams} />)}
    {linkedJobs.error && <ActionFeedback message="Saved linked operation status could not be refreshed." tone="warning" />}
    {linkedJobs.data?.filter(operation => ['Waiting', 'Sending', 'Unconfirmed', 'NeedsAccess', 'Blocked'].includes(operation.state)).map(operation => <CalendarOperationStatus key={operation.operationId} operation={operation} />)}
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
