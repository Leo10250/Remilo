import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useRef, useState } from 'react';
import type { CalendarCommand, ManagedCalendarCommand, OwnedCalendar } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { calendarError } from '../domain/calendar';
import { calendarCaptureRejected } from '../domain/calendar-link';
import { calendarStatusPresentation, calendarSyncOutcome } from '../domain/calendar-ux';
import { ActionFeedback, Button, ConnectedGroup, Copy, Disclosure, Page, QueryState, RowSupport, SettingRow, Sheet, Toggle } from '../ui/components';
import { CalendarStatusCard, useCalendarAuthorization, useCalendarSync, useCalendarAction } from '../ui/calendar-sync';
import { engine, nativeAvailable } from '../ui/native';
import { CalendarPublicationStatus } from '../ui/calendar-publication';
import { CalendarOperationStatus } from '../ui/calendar-linked';
import { useAppearanceHold } from '../ui/theme';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { useTimeFormatting } from '../ui/time-display';

export default function CalendarSettings() {
  const calendarAction = useCalendarAction();
  const params = useLocalSearchParams<OriginParams>(), origin = retainedOriginParams(params), client = useQueryClient(), confirm = useAppearanceConfirmation();
  const { scheduleDateTime } = useTimeFormatting();
  const connection = useQuery({ queryKey: ['calendar', 'connection'], queryFn: () => engine().getCalendarConnection(), enabled: nativeAvailable });
  const jobs = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(), enabled: nativeAvailable });
  const linkedJobs = useQuery({ queryKey: ['calendar', 'operations'], queryFn: () => engine().getCalendarOperations(), enabled: nativeAvailable });
  const links = useQuery({ queryKey: ['calendar', 'links'], queryFn: () => engine().getCalendarLinks(), enabled: nativeAvailable });
  const sync = useQuery({ queryKey: ['calendar', 'sync-summary'], queryFn: () => engine().getCalendarSyncSummary(), enabled: nativeAvailable });
  const managed = useQuery({ queryKey: ['calendar', 'managed'], queryFn: () => engine().getManagedCalendarState(), enabled: nativeAvailable });
  const syncRequest = useCalendarSync({ kind: 'AllAuthorized' }, sync.data?.syncRequestId);
  const [selecting, setSelecting] = useState(false), [busy, setBusy] = useState(false), [feedback, setFeedback] = useState('');
  const [rows, setRows] = useState<OwnedCalendar[]>([]), [cursor, setCursor] = useState<string | null>(null), [loaded, setLoaded] = useState(false);
  const selection = useRef<CalendarCommand | null>(null), capture = useRef<ManagedCalendarCommand | null>(null), running = useRef(false);
  const [selectionPending, setSelectionPending] = useState(false), [unknown, setUnknown] = useState(false);
  const auth = useCalendarAuthorization(() => { setRows([]); setLoaded(false); setCursor(null); });
  useAppearanceHold(busy || selecting || unknown);
  usePreventRemove(unknown || selectionPending || calendarAction.unknown || syncRequest.unknown || syncRequest.busy, () => confirm('Calendar action not confirmed', 'Retry the same request before leaving.'));
  const refresh = () => client.invalidateQueries({ queryKey: ['calendar'] });
  const run = async (task: () => Promise<void>) => {
    if (running.current) return; running.current = true; setBusy(true); setFeedback('');
    try { await task(); await refresh(); } catch (error) { setFeedback(calendarError(error)); } finally { running.current = false; setBusy(false); }
  };
  const managedAction = (command?: ManagedCalendarCommand) => run(async () => {
    capture.current ??= command ?? null;
    if (!capture.current) return;
    try { const kind = capture.current.kind; await calendarAction.submit(capture.current); capture.current = null; setUnknown(false);
      if (kind === 'PauseManagedCalendar') setFeedback('Sync paused. Local alerts continue.');
      if (kind === 'DisableManagedCalendar') setFeedback('Sync turned off. Both copies and local alerts are kept.'); }
    catch (error) { if (calendarCaptureRejected(error)) { capture.current = null; setUnknown(false); } else setUnknown(true); throw error; }
  });
  const load = (next: string | null) => run(async () => {
    const page = await engine().listOwnedCalendars(next);
    if (page.connectionRevision !== connection.data?.revision) throw new Error('Connection changed');
    setRows(old => next ? [...old, ...page.items.filter(item => !old.some(row => row.id === item.id))] : page.items);
    setCursor(page.nextCursor); setLoaded(true);
  });
  const select = (calendar?: OwnedCalendar) => run(async () => {
    if (!connection.data) return;
    selection.current ??= calendar ? { kind: 'SelectCalendar', operationId: engine().createOperationId(), calendarId: calendar.id, expectedConnectionRevision: connection.data.revision } : null;
    if (!selection.current) return;
    setSelectionPending(true);
    try { await calendarAction.submit(selection.current); selection.current = null; setSelectionPending(false); setSelecting(false); }
    catch (error) { if (calendarCaptureRejected(error)) { selection.current = null; setSelectionPending(false); } throw error; }
  });
  const setup = (mode = 'setup', extra: Record<string, string> = {}) => router.push({ pathname: '/calendar-managed', params: { ...origin, mode, ...extra } });
  const base = connection.data && managed.data ? calendarStatusPresentation(connection.data, managed.data) : null;
  const result = syncRequest.showResult && syncRequest.status?.syncResult ? calendarSyncOutcome(syncRequest.status) : null;
  const presentation = base && ['Sync', 'Progress'].includes(base.action) && (sync.data?.reviewCount ?? 0) > 0 ? { ...base, title: 'Calendar items need review', description: 'Review these items. Other authorized work can continue.', label: 'Review items', action: 'ReviewItems' as const, tone: sync.data?.attention?.tone || 'warning' as const } :
    base?.action === 'Sync' && result ? { ...base, ...result, ...(syncRequest.status?.syncResult?.outcome === 'AccessRequired' ? { label: 'Reconnect Google', action: 'Connect' as const } : syncRequest.status?.syncResult?.outcome === 'NeedsReview' || syncRequest.status?.syncResult?.outcome === 'Unconfirmed' ? { label: 'Review items', action: 'ReviewItems' as const } : {}) } : base;
  const mainAction = () => {
    if (!presentation || !managed.data) return;
    if (presentation.action === 'Connect' || presentation.action === 'Authorize') { void auth.start(presentation.action === 'Authorize' ? managed.data.operationId || null : null); return; }
    if (presentation.action === 'ReviewItems') { router.push({ pathname: '/calendar-reviews', params: origin }); return; }
    if (presentation.action === 'Resume') { setup('resume'); return; }
    if (presentation.action === 'Progress') { setup('progress', managed.data.operationId ? { operationId: managed.data.operationId } : {}); return; }
    if (presentation.action === 'InspectCreation' && managed.data.operationId) { void managedAction({ kind: 'RetryManagedCalendarOperation', operationId: managed.data.operationId }); return; }
    if (presentation.action === 'Sync') { void syncRequest.start(); return; }
    setup();
  };
  const changeMode = (kind: 'PauseManagedCalendar' | 'DisableManagedCalendar') => {
    if (!managed.data) return;
    if (kind === 'PauseManagedCalendar') { void managedAction({ kind, operationId: engine().createOperationId(), expectedRevision: managed.data.revision }); return; }
    confirm('Turn off Calendar sync?', 'Both copies and your local alerts are kept. New reminders won’t be queued for Google.', [{ text: 'Cancel', style: 'cancel' },
      { text: 'Turn off sync', onPress: () => void managedAction({ kind, operationId: engine().createOperationId(), expectedRevision: managed.data!.revision }) }]);
  };
  const disconnect = () => {
    if (!connection.data) return;
    confirm('Disconnect Google Calendar?', 'Google events and local reminders are kept. Future automatic work stops.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Disconnect', onPress: () => void run(async () => {
      await calendarAction.submit({ kind: 'DisconnectCalendar', operationId: engine().createOperationId(), expectedConnectionRevision: connection.data!.revision }); setRows([]); setLoaded(false);
    }) }]);
  };
  const manualCount = links.data?.filter(link => link.syncMode !== 'Automatic' && link.state !== 'Detached').length ?? 0;
  const locked = busy || unknown || selectionPending || auth.waiting || calendarAction.unknown || syncRequest.busy || syncRequest.unknown;
  return <Page title="Google Calendar" scrollKey="calendar-settings" onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin))}>
    <QueryState loading={connection.isLoading && nativeAvailable} error={connection.error || managed.error} empty={!nativeAvailable} emptyMessage="Use the Android app to connect Google Calendar." onRetry={() => void refresh()} />
    {presentation && <CalendarStatusCard title={presentation.title} description={presentation.description} warning={presentation.warning} tone={presentation.tone}
      announce={!!syncRequest.operationId}
      label={presentation.label} secondary={presentation.action === 'Sync'} busy={locked || syncRequest.working} action={connection.data?.available === false ? undefined : mainAction}>
      {!!feedback && <ActionFeedback message={feedback} />}
      {!feedback && !!calendarAction.error && <ActionFeedback message={calendarAction.error} tone="warning" />}
      {calendarAction.unknown && !unknown && !selectionPending && <Button label="Retry same request" variant="secondary" onPress={() => void calendarAction.retry()} />}
      {!!auth.message && <ActionFeedback message={auth.message} tone={auth.tone} loading={auth.waiting} />}
      {!!syncRequest.error && <ActionFeedback message={syncRequest.error} tone="warning" />}
      {syncRequest.unknown && <Button label="Retry same request" variant="secondary" onPress={() => void syncRequest.start()} />}
      {connection.data?.available === false && <ActionFeedback message="Google Play services is unavailable or needs updating before authorization can open." tone="warning" />}
      {!!managed.data?.successfulAtMs && presentation.action === 'Sync' && <Copy muted size={14}>Last synced {scheduleDateTime(managed.data.successfulAtMs)}</Copy>}
      {unknown && <Button label="Retry same request" variant="secondary" onPress={() => void managedAction()} />}
    </CalendarStatusCard>}
    {managed.data && connection.data?.connected && <ConnectedGroup title="Account and calendar">
      <SettingRow icon="event" label="Google account" value={connection.data.email} />
      <SettingRow icon="event" label="Remilo calendar" value={managed.data.calendarName || 'Choose during setup'} description={managed.data.calendarZone || 'Automatic import and export use this dedicated calendar.'}
        onPress={() => setup(managed.data!.calendarId && managed.data!.mode !== 'Disabled' ? 'policy' : 'setup')} disabled={locked} />
    </ConnectedGroup>}
    {managed.data?.calendarId && <ConnectedGroup title="Sync preferences">
      <SettingRow icon="download" label="Google events to Remilo" value={managed.data.policy.automaticImport ? 'Add ongoing and upcoming events' : 'Automatic import off'} disabled={locked} onPress={() => setup('policy')} />
      <SettingRow icon="upload" label="New Remilo reminders to Google" value={managed.data.policy.exportNewReminders ? 'On · Local only is available' : 'Automatic export off'} disabled={locked} onPress={() => setup('policy')} />
      <ViewSummary pending={managed.data.progress?.pending ?? managed.data.pendingExportCount + (managed.data.pendingChangeCount ?? 0)} held={managed.data.progress?.held ?? managed.data.heldExportCount} />
      {!!managed.data.recoveryCount && <SettingRow icon="alarm" label="Review recovered alerts" value={`${managed.data.recoveryCount} with No alert`} disabled={locked} onPress={() => setup('recovered')} />}
      <Disclosure title="Sync controls" summary="Pause or turn off automatic work" icon="settings">
        {managed.data.mode === 'Enabled' && <Button label="Pause sync" variant="secondary" disabled={locked} onPress={() => changeMode('PauseManagedCalendar')} />}
        {managed.data.mode !== 'Disabled' && <Button label="Turn off sync" variant="neutral" disabled={locked} onPress={() => changeMode('DisableManagedCalendar')} />}
        <Copy muted size={14}>Local reminders and alerts continue. Other calendars keep their own link permissions.</Copy>
      </Disclosure>
    </ConnectedGroup>}
    {managed.data?.calendarId && <ConnectedGroup><Disclosure title="Sync details" icon="info">
      <Copy muted size={14}>{managed.data.calendarName} · {connection.data?.email}</Copy><Copy muted size={14}>{managed.data.calendarZone}</Copy>
      {managed.data.lastObservedAtMs != null && <Copy muted size={14}>Last Google observation {scheduleDateTime(managed.data.lastObservedAtMs)}</Copy>}
      {managed.data.successfulAtMs != null && <Copy muted size={14}>Last successful agreement {scheduleDateTime(managed.data.successfulAtMs)}</Copy>}
      {managed.data.attemptedAtMs != null && <Copy muted size={14}>Latest attempt {scheduleDateTime(managed.data.attemptedAtMs)}</Copy>}
      {managed.data.failedAtMs != null && <Copy muted size={14}>Last failed attempt {scheduleDateTime(managed.data.failedAtMs)}</Copy>}
      <Copy muted size={14}>Background checks are requested hourly. Android may delay them. Local alerts remain independent.</Copy>
    </Disclosure></ConnectedGroup>}
    <ConnectedGroup title="Review and linked reminders">
      <SettingRow icon="event" label="Calendar review" value={`${sync.data?.reviewCount ?? 0} ${sync.data?.reviewCount === 1 ? 'item' : 'items'}`} description="Reminders, incoming events and setup issues" onPress={() => router.push({ pathname: '/calendar-reviews', params: origin })} />
      {!!manualCount && <SettingRow icon="refresh" label="Sync linked reminders" value={`${manualCount} with manual updates`} description="Choose existing links to keep up to date in both apps." disabled={locked || !connection.data?.connected} onPress={() => router.push({ pathname: '/calendar-activate', params: origin })} />}
      {sync.data && <Toggle label="Quiet review notifications" value={sync.data.notifications.enabled} disabled={locked} onChange={enabled => void run(async () => { await calendarAction.submit({ kind: 'SetCalendarReviewNotifications', operationId: engine().createOperationId(), expectedRevision: sync.data!.notifications.revision, enabled }); })} />}
    </ConnectedGroup>
    <ConnectedGroup><Disclosure title="Advanced manual tools" summary="Import history, publish to other calendars and account controls" icon="settings">
      <Copy muted size={14}>These manual tools use separate reviews. The publishing destination below doesn’t change your automatic Remilo calendar.</Copy>
      <Button label="Import from Google Calendar" variant="secondary" disabled={locked || !connection.data?.connected} onPress={() => router.push({ pathname: '/calendar-import', params: origin })} />
      <SettingRow icon="event" label="Manual publishing calendar" value={connection.data?.calendarName || 'Not selected'} disabled={locked || !connection.data?.connected}
        onPress={() => { setSelecting(true); if (!loaded) void load(null); }} />
      <Button label={connection.data?.connected ? 'Change Google account' : 'Connect Google'} variant="neutral" disabled={locked || connection.data?.available === false} onPress={() => void auth.start()} />
      {connection.data?.connected && <Button label="Disconnect Google" variant="neutral" disabled={locked} onPress={disconnect} />}
      {managed.data && ['CalendarUnavailable', 'CreationUnconfirmed'].includes(managed.data.phase) && <Button label="Review a replacement calendar" variant="neutral" disabled={locked} onPress={() => setup('setup', { replacement: 'true' })} />}
      <Copy muted size={14}>Background checks are requested hourly. Android may delay them.</Copy>
    </Disclosure></ConnectedGroup>
    {jobs.data?.filter(job => job.state !== 'Published' && job.state !== 'Cancelled').map(job => <CalendarPublicationStatus key={job.operationId} publication={job} routeParams={origin} />)}
    {linkedJobs.data?.filter(job => ['Unconfirmed', 'NeedsAccess', 'Blocked', 'Conflict', 'Failed'].includes(job.state)).map(job => <CalendarOperationStatus key={job.operationId} operation={job} />)}
    <Sheet visible={selecting} title="Manual publishing calendar" onClose={() => { if (!busy && !selection.current) setSelecting(false); }}>
      <Copy muted>Choose an owned calendar for individually reviewed publication. This doesn’t configure automatic import or change existing links.</Copy>
      <ConnectedGroup>{rows.map(calendar => <SettingRow key={calendar.id} label={calendar.name} description={calendar.zoneId} disabled={busy || selectionPending} onPress={() => void select(calendar)} />)}</ConnectedGroup>
      {loaded && !rows.length && <Copy>No owned calendars found.</Copy>}
      {!!feedback && <ActionFeedback message={feedback} tone="warning" />}
      <Button label={selectionPending ? 'Retry same calendar selection' : busy ? 'Checking calendars…' : cursor ? 'Load more calendars' : 'Check calendars again'} variant="secondary" disabled={busy} onPress={() => selectionPending ? void select() : void load(cursor)} />
    </Sheet>
  </Page>;
}
function ViewSummary({ pending, held }: { pending: number; held: number }) {
  if (!pending && !held) return null;
  return <RowSupport><Copy muted size={14}>{[pending ? `${pending} ${pending === 1 ? 'update' : 'updates'} waiting` : '', held ? `${held} held for review` : ''].filter(Boolean).join(' · ')}</Copy></RowSupport>;
}
