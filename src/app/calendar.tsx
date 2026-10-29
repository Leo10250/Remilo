import { useLocalizedState, useTranslation } from '../localization/react';

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
  'use no memo';
  const t = useTranslation();
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
  const [selecting, setSelecting] = useState(false), [busy, setBusy] = useState(false), [feedback, setFeedback] = useLocalizedState('');
  const [rows, setRows] = useState<OwnedCalendar[]>([]), [cursor, setCursor] = useState<string | null>(null), [loaded, setLoaded] = useState(false);
  const selection = useRef<CalendarCommand | null>(null), capture = useRef<ManagedCalendarCommand | null>(null), running = useRef(false);
  const [selectionPending, setSelectionPending] = useState(false), [unknown, setUnknown] = useState(false);
  const auth = useCalendarAuthorization(() => { setRows([]); setLoaded(false); setCursor(null); });
  useAppearanceHold(busy || selecting || unknown);
  usePreventRemove(unknown || selectionPending || calendarAction.unknown || syncRequest.unknown || syncRequest.busy, () => confirm(t('m_0c849c393ca3'), t('m_e71fd74c140f')));
  const refresh = () => client.invalidateQueries({ queryKey: ['calendar'] });
  const run = async (task: () => Promise<void>) => {
    if (running.current) return; running.current = true; setBusy(true); setFeedback('');
    try { await task(); await refresh(); } catch (error) { setFeedback(calendarError(error)); } finally { running.current = false; setBusy(false); }
  };
  const managedAction = (command?: ManagedCalendarCommand) => run(async () => {
    capture.current ??= command ?? null;
    if (!capture.current) return;
    try { const kind = capture.current.kind; await calendarAction.submit(capture.current); capture.current = null; setUnknown(false);
      if (kind === 'PauseManagedCalendar') setFeedback(t('m_5864aae7b8ca'));
      if (kind === 'DisableManagedCalendar') setFeedback(t('m_1cc896b600c5')); }
    catch (error) { if (calendarCaptureRejected(error)) { capture.current = null; setUnknown(false); } else setUnknown(true); throw error; }
  });
  const load = (next: string | null) => run(async () => {
    const page = await engine().listOwnedCalendars(next);
    if (page.connectionRevision !== connection.data?.revision) throw new Error(t('m_17a0e412897f'));
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
  const presentation = base && ['Sync', 'Progress'].includes(base.action) && (sync.data?.reviewCount ?? 0) > 0 ? { ...base, title: t('m_3d2d5eb3e995'), description: t('m_638daed11ef3'), label: t('m_e6bc867f7622'), action: 'ReviewItems' as const, tone: sync.data?.attention?.tone || 'warning' as const } :
    base?.action === 'Sync' && result ? { ...base, ...result, ...(syncRequest.status?.syncResult?.outcome === 'AccessRequired' ? { label: t('m_b724411569e0'), action: 'Connect' as const } : syncRequest.status?.syncResult?.outcome === 'NeedsReview' || syncRequest.status?.syncResult?.outcome === 'Unconfirmed' ? { label: t('m_e6bc867f7622'), action: 'ReviewItems' as const } : {}) } : base;
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
    confirm(t('m_2132b07d8515'), t('m_0bab9b31dda7'), [{ text: t('m_19766ed6ccb2'), style: 'cancel' },
      { text: t('m_72497f61493d'), onPress: () => void managedAction({ kind, operationId: engine().createOperationId(), expectedRevision: managed.data!.revision }) }]);
  };
  const disconnect = () => {
    if (!connection.data) return;
    confirm(t('m_e51cd852cc99'), t('m_a4c09550b715'), [{ text: t('m_19766ed6ccb2'), style: 'cancel' }, { text: t('m_acfc5be785a9'), onPress: () => void run(async () => {
      await calendarAction.submit({ kind: 'DisconnectCalendar', operationId: engine().createOperationId(), expectedConnectionRevision: connection.data!.revision }); setRows([]); setLoaded(false);
    }) }]);
  };
  const manualCount = links.data?.filter(link => link.syncMode !== 'Automatic' && link.state !== 'Detached').length ?? 0;
  const locked = busy || unknown || selectionPending || auth.waiting || calendarAction.unknown || syncRequest.busy || syncRequest.unknown;
  return <Page title={t('m_b074310e911f')} scrollKey="calendar-settings" onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin))}>
    <QueryState loading={connection.isLoading && nativeAvailable} error={connection.error || managed.error} empty={!nativeAvailable} emptyMessage={t('m_59432f57b3c5')} onRetry={() => void refresh()} />
    {presentation && <CalendarStatusCard title={presentation.title} description={presentation.description} warning={presentation.warning} tone={presentation.tone}
      announce={!!syncRequest.operationId}
      label={presentation.label} secondary={presentation.action === 'Sync'} busy={locked || syncRequest.working} action={connection.data?.available === false ? undefined : mainAction}>
      {!!feedback && <ActionFeedback message={feedback} />}
      {!feedback && !!calendarAction.error && <ActionFeedback message={calendarAction.error} tone="warning" />}
      {calendarAction.unknown && !unknown && !selectionPending && <Button label={t('m_16003a1a9190')} variant="secondary" onPress={() => void calendarAction.retry()} />}
      {!!auth.message && <ActionFeedback message={auth.message} tone={auth.tone} loading={auth.waiting} />}
      {!!syncRequest.error && <ActionFeedback message={syncRequest.error} tone="warning" />}
      {syncRequest.unknown && <Button label={t('m_16003a1a9190')} variant="secondary" onPress={() => void syncRequest.start()} />}
      {connection.data?.available === false && <ActionFeedback message={t('m_e351735905e7')} tone="warning" />}
      {!!managed.data?.successfulAtMs && presentation.action === 'Sync' && <Copy muted size={14}>{t('m_52f55f8ae5c2')}{scheduleDateTime(managed.data.successfulAtMs)}</Copy>}
      {unknown && <Button label={t('m_16003a1a9190')} variant="secondary" onPress={() => void managedAction()} />}
    </CalendarStatusCard>}
    {managed.data && connection.data?.connected && <ConnectedGroup title={t('m_4daf4f599e5c')}>
      <SettingRow intent="action" icon="event" label={t('m_7da2bcb6bb6b')} value={connection.data.email} />
      <SettingRow intent="action" icon="event" label={t('m_d1f78591d052')} value={managed.data.calendarName || t('m_7498e51581fd')} description={managed.data.calendarZone || t('m_b9508bbefe31')}
        onPress={() => setup(managed.data!.calendarId && managed.data!.mode !== 'Disabled' ? 'policy' : 'setup')} disabled={locked} />
    </ConnectedGroup>}
    {managed.data?.calendarId && <ConnectedGroup title={t('m_fc7921108075')}>
      <SettingRow intent="action" icon="download" label={t('m_59909a83ae12')} value={managed.data.policy.automaticImport ? t('m_b4ec2d7e78ce') : t('m_192bc55a3400')} disabled={locked} onPress={() => setup('policy')} />
      <SettingRow intent="action" icon="upload" label={t('m_40a3bf59729e')} value={managed.data.policy.exportNewReminders ? t('m_066eff43059c') : t('m_f1fc666eb56b')} disabled={locked} onPress={() => setup('policy')} />
      <ViewSummary pending={managed.data.progress?.pending ?? managed.data.pendingExportCount + (managed.data.pendingChangeCount ?? 0)} held={managed.data.progress?.held ?? managed.data.heldExportCount} />
      {!!managed.data.recoveryCount && <SettingRow intent="action" icon="alarm" label={t('m_2b92a414df3c')} value={t('m_e0fad4b7a1fb', { arg0: String(managed.data.recoveryCount) })} disabled={locked} onPress={() => setup('recovered')} />}
      <Disclosure title={t('m_4e42724833a8')} summary={t('m_a75b7528db02')} icon="settings">
        {managed.data.mode === 'Enabled' && <Button label={t('m_430a5aaa1e87')} variant="secondary" disabled={locked} onPress={() => changeMode('PauseManagedCalendar')} />}
        {managed.data.mode !== 'Disabled' && <Button label={t('m_72497f61493d')} variant="neutral" disabled={locked} onPress={() => changeMode('DisableManagedCalendar')} />}
        <Copy muted size={14}>{t('m_b87a00a6a35b')}</Copy>
      </Disclosure>
    </ConnectedGroup>}
    {managed.data?.calendarId && <ConnectedGroup><Disclosure title={t('m_358299bb64a8')} icon="info">
      <Copy muted size={14}>{managed.data.calendarName} · {connection.data?.email}</Copy><Copy muted size={14}>{managed.data.calendarZone}</Copy>
      {managed.data.lastObservedAtMs != null && <Copy muted size={14}>{t('m_3ca2b1323cd4')}{scheduleDateTime(managed.data.lastObservedAtMs)}</Copy>}
      {managed.data.successfulAtMs != null && <Copy muted size={14}>{t('m_07330d3b86d7')}{scheduleDateTime(managed.data.successfulAtMs)}</Copy>}
      {managed.data.attemptedAtMs != null && <Copy muted size={14}>{t('m_6b01b7236ce1')}{scheduleDateTime(managed.data.attemptedAtMs)}</Copy>}
      {managed.data.failedAtMs != null && <Copy muted size={14}>{t('m_50f0f027b7fa')}{scheduleDateTime(managed.data.failedAtMs)}</Copy>}
      <Copy muted size={14}>{t('m_6ed0e8d64c24')}</Copy>
    </Disclosure></ConnectedGroup>}
    <ConnectedGroup title={t('m_61a3a75ede58')}>
      <SettingRow intent="navigation" icon="event" label={t('m_4e680674ef4c')} value={t('item_count', { count: sync.data?.reviewCount ?? 0 })} description={t('m_86a0b9633d1a')} onPress={() => router.push({ pathname: '/calendar-reviews', params: origin })} />
      {!!manualCount && <SettingRow intent="navigation" icon="refresh" label={t('m_41103efd431d')} value={t('m_d6d29aa39032', { arg0: String(manualCount) })} description={t('m_616bfa2638e3')} disabled={locked || !connection.data?.connected} onPress={() => router.push({ pathname: '/calendar-activate', params: origin })} />}
      {sync.data && <Toggle label={t('m_b93ff5508561')} value={sync.data.notifications.enabled} disabled={locked} onChange={enabled => void run(async () => { await calendarAction.submit({ kind: 'SetCalendarReviewNotifications', operationId: engine().createOperationId(), expectedRevision: sync.data!.notifications.revision, enabled }); })} />}
    </ConnectedGroup>
    <ConnectedGroup><Disclosure title={t('m_7f921a79b834')} summary={t('m_3cce7d103438')} icon="settings">
      <Copy muted size={14}>{t('m_7b1f363121ad')}</Copy>
      <Button label={t('m_357bcb0ce661')} variant="secondary" disabled={locked || !connection.data?.connected} onPress={() => router.push({ pathname: '/calendar-import', params: origin })} />
      <SettingRow intent="action" icon="event" label={t('m_3994b5141305')} value={connection.data?.calendarName || t('m_df12aeba9bb9')} disabled={locked || !connection.data?.connected}
        onPress={() => { setSelecting(true); if (!loaded) void load(null); }} />
      <Button label={connection.data?.connected ? t('m_2da87a0fec50') : t('m_2035e3f9baed')} variant="neutral" disabled={locked || connection.data?.available === false} onPress={() => void auth.start()} />
      {connection.data?.connected && <Button label={t('m_1f4e6793ca99')} variant="neutral" disabled={locked} onPress={disconnect} />}
      {managed.data && ['CalendarUnavailable', 'CreationUnconfirmed'].includes(managed.data.phase) && <Button label={t('m_9da420eee6cc')} variant="neutral" disabled={locked} onPress={() => setup('setup', { replacement: 'true' })} />}
      <Copy muted size={14}>{t('m_881ae0b38793')}</Copy>
    </Disclosure></ConnectedGroup>
    {jobs.data?.filter(job => job.state !== 'Published' && job.state !== 'Cancelled').map(job => <CalendarPublicationStatus key={job.operationId} publication={job} routeParams={origin} />)}
    {linkedJobs.data?.filter(job => ['Unconfirmed', 'NeedsAccess', 'Blocked', 'Conflict', 'Failed'].includes(job.state)).map(job => <CalendarOperationStatus key={job.operationId} operation={job} />)}
    <Sheet visible={selecting} title={t('m_3994b5141305')} onClose={() => { if (!busy && !selection.current) setSelecting(false); }}>
      <Copy muted>{t('m_da51f269c894')}</Copy>
      <ConnectedGroup>{rows.map(calendar => <SettingRow intent="action" key={calendar.id} label={calendar.name} description={calendar.zoneId} disabled={busy || selectionPending} onPress={() => void select(calendar)} />)}</ConnectedGroup>
      {loaded && !rows.length && <Copy>{t('m_0e913a16bf22')}</Copy>}
      {!!feedback && <ActionFeedback message={feedback} tone="warning" />}
      <Button label={selectionPending ? t('m_9d7aad01f8b5') : busy ? t('m_453d0743c738') : cursor ? t('m_bea5fb6b1e61') : t('m_1ab5366752db')} variant="secondary" disabled={busy} onPress={() => selectionPending ? void select() : void load(cursor)} />
    </Sheet>
  </Page>;
}
function ViewSummary({ pending, held }: { pending: number; held: number }) {
  'use no memo';
  const t = useTranslation();
  if (!pending && !held) return null;
  return <RowSupport><Copy muted size={14}>{[pending ? t('pending_updates', { count: pending }) : '', held ? t('m_e99987fe700c', { arg0: String(held) }) : ''].filter(Boolean).join(' · ')}</Copy></RowSupport>;
}
