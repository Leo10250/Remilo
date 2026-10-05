import { useQuery } from '@tanstack/react-query';
import { Share } from 'react-native';
import { Button, Card, Copy, Heading, Page } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';

export default function Diagnostics() {
  const report = useQuery({ queryKey: ['diagnostics'], queryFn: () => engine().getDiagnostics(), enabled: nativeAvailable });
  const counts = report.data?.states as Record<string, number> | undefined;
  return <Page title="Local diagnostics" subtitle="A snapshot to help investigate delivery problems.">
    <Card><Heading>Alert states</Heading>{counts && Object.entries(counts).map(([state, count]) => <Copy key={state}>{state}: {count}</Copy>)}
      {!counts && <Copy>{report.isLoading ? 'Loading…' : 'No report available.'}</Copy>}
      <Copy muted>Scheduling operations awaiting recovery: {String(report.data?.pendingOperations ?? '—')}</Copy>
      <Button label="Refresh report" variant="secondary" onPress={() => void report.refetch()} /></Card>
    <Card><Heading>Share a report</Heading><Copy muted>Includes permissions and alert counts. Reminder text and notes are excluded.</Copy>
      <Button label="Share diagnostic snapshot" disabled={!report.data} onPress={() => {
        void Share.share({ message: JSON.stringify(report.data, null, 2), title: 'Remilo diagnostics' });
      }} /></Card>
  </Page>;
}
