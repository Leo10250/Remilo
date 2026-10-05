import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Share } from 'react-native';
import { ActionFeedback, Copy, Group, IconButton, Page, QueryState, SettingRow } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';

const stateNames: Record<string, string> = {
  Alerting: 'Ringing', Stopped: 'Alarm stopped', TimedOut: 'Alarm timed out', Interrupted: 'Alarm interrupted',
  Blocked: 'Permission needed', Failed: 'Alarm could not play', Changing: 'Updating', Pending: 'Scheduling',
  Notified: 'Notification sent', NoAlert: 'No alert',
};
export default function Diagnostics() {
  const report = useQuery({ queryKey: ['diagnostics'], queryFn: () => engine().getDiagnostics(), enabled: nativeAvailable });
  const [sharing, setSharing] = useState(false);
  const shareRunning = useRef(false);
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'danger' | 'muted' }>();
  const counts = report.data?.states as Record<string, number> | undefined;
  const refresh = async () => {
    setFeedback(undefined);
    const result = await report.refetch();
    if (!result.error) setFeedback({ message: 'Diagnostic report refreshed.', tone: 'success' });
  };
  const share = async () => {
    if (!report.data || shareRunning.current) return;
    shareRunning.current = true; setSharing(true); setFeedback(undefined);
    try {
      const result = await Share.share({ message: JSON.stringify(report.data, null, 2), title: 'Remilo diagnostics' });
      setFeedback({ message: result.action === Share.dismissedAction ? 'Sharing cancelled.' : 'Diagnostic report opened in the share sheet.', tone: 'muted' });
    } catch { setFeedback({ message: 'Could not open the share sheet. Try again.', tone: 'danger' }); }
    finally { shareRunning.current = false; setSharing(false); }
  };
  return <Page title="Diagnostics" actions={<IconButton icon="undo" label="Refresh report"
    disabled={!nativeAvailable || report.isFetching} onPress={() => void refresh()} />}>
    <Copy muted>This snapshot helps investigate delivery. It does not verify that an alarm was heard.</Copy>
    <ActionFeedback message={sharing ? 'Opening share sheet…' : report.isFetching && report.data ? 'Refreshing report…' : feedback?.message}
      tone={feedback?.tone} loading={sharing || report.isFetching && !!report.data} />
    <QueryState loading={report.isLoading} error={report.error} empty={!report.data}
      emptyMessage={!nativeAvailable ? 'Use the Android app to view diagnostics.' : 'No report available.'} onRetry={() => void refresh()} />
    {!!report.data && <Group title="Alarm snapshot">
      {counts && Object.entries(counts).map(([state, count]) => <SettingRow key={state} label={stateNames[state] ?? state} value={String(count)} />)}
      <SettingRow label="Awaiting recovery" value={String(report.data.pendingOperations ?? '—')} />
    </Group>}
    <Group><SettingRow label={sharing ? 'Opening share sheet…' : 'Share diagnostic report'} icon="upload"
      description="Permissions and counts only. Reminder titles and notes are excluded." disabled={!report.data || sharing}
      onPress={() => void share()} /></Group>
  </Page>;
}
