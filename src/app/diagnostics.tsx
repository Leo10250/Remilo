import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Share } from 'react-native';
import { retainedOriginParams, type OriginParams } from '../domain/navigation';
import { ActionFeedback, Button, Copy, Group, IconButton, Page, QueryState, SettingRow, shortDateTime } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';
import { usePageHandoff } from '../ui/handoff';

const stateNames: Record<string, string> = {
  Alerting: 'Ringing', Stopped: 'Alarm stopped', TimedOut: 'Alarm timed out', Interrupted: 'Alarm interrupted', Missed: 'Alert missed',
  Blocked: 'Alert blocked', Failed: 'Delivery failed', Changing: 'Updating alert', SeriesChanging: 'Updating repeat', Pending: 'Scheduling',
  Scheduled: 'Scheduled', Notified: 'Notification sent', NoAlert: 'No alert', Completed: 'Completed', Deleted: 'In Trash', Skipped: 'Skipped', Paused: 'Paused', Replaced: 'Replaced',
};
type Feedback = { message: string; tone: 'success' | 'danger' | 'muted' };
export default function Diagnostics() {
  const params = useLocalSearchParams<OriginParams>();
  const report = useQuery({ queryKey: ['diagnostics'], queryFn: () => engine().getDiagnostics(), enabled: nativeAvailable });
  const [sharing, setSharing] = useState(false), [shareFeedback, setShareFeedback] = useState<Feedback>(), [refreshFeedback, setRefreshFeedback] = useState<Feedback>();
  const shareRunning = useRef(false), mounted = useRef(true), refreshTicket = useRef(0), shareTicket = useRef(0);
  const handoff = usePageHandoff(() => setSharing(shareRunning.current));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const counts = report.data?.states as Record<string, number> | undefined, caps = report.data?.capabilities as Record<string, unknown> | undefined;
  const observed = typeof report.data?.observedAtMs === 'number' ? report.data.observedAtMs : undefined;
  const refresh = async () => {
    const ticket = ++refreshTicket.current, page = handoff.scope.capture(); setRefreshFeedback(undefined);
    const result = await report.refetch();
    if (mounted.current && ticket === refreshTicket.current && !result.error) handoff.commit(page, () => setRefreshFeedback({ message: 'Diagnostic report refreshed.', tone: 'success' }));
  };
  const share = async () => {
    if (!report.data || shareRunning.current) return;
    const snapshot = JSON.stringify(report.data, null, 2), sharedAt = observed, ticket = ++shareTicket.current, page = handoff.scope.capture();
    if (!handoff.scope.markOpened(page)) return;
    shareRunning.current = true; setSharing(true); setShareFeedback(undefined);
    try {
      await Share.share({ message: snapshot, title: 'Remilo diagnostics' });
      if (mounted.current && ticket === shareTicket.current) handoff.commit(page, () => setShareFeedback({ message: 'Diagnostic report opened in the share sheet' + (sharedAt != null ? ` · snapshot observed ${shortDateTime(sharedAt)}.` : '.'), tone: 'muted' }));
    } catch { if (mounted.current && ticket === shareTicket.current) handoff.commit(page, () => setShareFeedback({ message: 'Could not open the share sheet. Try again.', tone: 'danger' })); }
    finally { shareRunning.current = false; if (mounted.current && ticket === shareTicket.current && handoff.scope.active()) setSharing(false); }
  };
  const stateOrder = counts ? [...Object.keys(stateNames).filter((state) => state in counts), ...Object.keys(counts).filter((state) => !(state in stateNames)).sort()] : [];
  const capability = (key: string, limited = false) => typeof caps?.[key] !== 'boolean' ? 'Unavailable' : caps[key] ? 'Allowed' : limited ? 'Limited' : 'Blocked';
  return <Page compact title="Diagnostics" onBack={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/settings', params: retainedOriginParams(params) })}
    actions={<IconButton icon="refresh" label="Refresh report" disabled={!nativeAvailable || report.isFetching} onPress={() => void refresh()} />}>
    <Copy muted>This snapshot helps investigate delivery. It does not verify that an alarm was heard.</Copy>
    {observed != null && <Copy muted size={14}>Observed {shortDateTime(observed)}</Copy>}
    <ActionFeedback message={report.isFetching && report.data ? 'Refreshing report…' : report.error && report.data ? 'Could not refresh. Showing the previous report.' : refreshFeedback?.message}
      tone={report.error ? 'danger' : refreshFeedback?.tone} loading={report.isFetching && !!report.data} />
    {report.error && report.data && <Button label="Retry" variant="secondary" disabled={report.isFetching} onPress={() => void refresh()} />}
    <QueryState loading={nativeAvailable && report.isLoading && !report.data} error={!report.data ? report.error : undefined} empty={!report.data && !report.isLoading || !nativeAvailable}
      emptyMessage={!nativeAvailable ? 'Use the Android app to view diagnostics.' : 'No report available.'} onRetry={nativeAvailable ? () => void refresh() : undefined} />
    {!!report.data && <>
      <Group title="Alarm snapshot">
        <Copy muted size={14}>All retained operational alert rows, including Completed, Trash and Skipped. These are not unfinished tasks or guaranteed future alarms.</Copy>
        {!stateOrder.length && <Copy muted>No operational alerts in this snapshot.</Copy>}
        {stateOrder.map((state) => <SettingRow key={state} label={stateNames[state] ?? state} value={String(counts![state])} />)}
        <SettingRow label="Pending reminder updates" value={String(report.data.pendingOperations ?? '—')} />
        <Copy muted size={14}>Pending reminder updates counts credential-store reminder projections; it does not count every recovery job.</Copy>
      </Group>
      {caps && <Group title="Observed permissions">
        {typeof caps.observedAtMs === 'number' && <Copy muted size={14}>Permissions observed {shortDateTime(caps.observedAtMs)}</Copy>}
        <SettingRow label="On-time alarms" value={capability('exactAlarms')} />
        <SettingRow label="App notifications" value={capability('notifications')} />
        <SettingRow label="Alarm channel" value={capability('channelEnabled')} />
        <SettingRow label="Reminder channel" value={capability('notificationChannelEnabled')} />
        <SettingRow label="Lock-screen alarms" value={capability('fullScreen', true)} />
        <SettingRow label="Credential storage" value={caps.unlocked === true ? 'Unlocked' : caps.unlocked === false ? 'Locked' : 'Unavailable'} />
      </Group>}
      <Group title="Technical metadata"><SettingRow label="Content schema" value={String(report.data.contentSchema ?? '—')} />
        <SettingRow label="Delivery schema" value={String(report.data.operationalSchema ?? '—')} /></Group>
    </>}
    <Group><SettingRow label="Share diagnostic report" icon="upload"
      description="Delivery permissions, state counts and technical metadata. Reminder titles and notes are excluded." disabled={!report.data || sharing}
      onPress={() => void share()} /><ActionFeedback message={sharing ? 'Opening share sheet…' : shareFeedback?.message} loading={sharing} tone={shareFeedback?.tone} /></Group>
  </Page>;
}
