import { useQuery } from '@tanstack/react-query';
import { Share } from 'react-native';
import { Copy, Group, IconButton, Page, SettingRow } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';

export default function Diagnostics() {
  const report = useQuery({ queryKey: ['diagnostics'], queryFn: () => engine().getDiagnostics(), enabled: nativeAvailable });
  const counts = report.data?.states as Record<string, number> | undefined;
  return <Page title="Diagnostics" actions={<IconButton icon="undo" label="Refresh report" onPress={() => void report.refetch()} />}>
    <Group title="Alarm snapshot">{counts && Object.entries(counts).map(([state, count]) => <SettingRow key={state} label={state} value={String(count)} />)}
      {!counts && <Copy>{report.isLoading ? 'Loading…' : 'No report available.'}</Copy>}
      <SettingRow label="Awaiting recovery" value={String(report.data?.pendingOperations ?? '—')} /></Group>
    <Group><SettingRow label="Share diagnostic report" icon="upload" description="Permissions and counts only. Reminder text and notes are excluded." disabled={!report.data} onPress={() => {
        void Share.share({ message: JSON.stringify(report.data, null, 2), title: 'Remilo diagnostics' });
      }} /></Group>
  </Page>;
}
