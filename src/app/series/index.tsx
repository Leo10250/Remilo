import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Copy, Group, Page, SettingRow } from '../../ui/components';
import { engine, nativeAvailable } from '../../ui/native';
export default function PausedSeries() {
  const query = useQuery({ queryKey: ['series'], queryFn: () => engine().querySeries(), enabled: nativeAvailable });
  const items = query.data?.filter((series) => series.state === 'Paused') ?? [];
  return <Page title="Paused repeats">
    {query.isLoading && <Copy>Loading…</Copy>}{query.error && <Copy>Could not load paused reminders.</Copy>}
    {!query.isLoading && !items.length && <Copy muted>No paused repeating reminders.</Copy>}
    <Group>{items.map((series) => <SettingRow key={series.id} label={series.template.title} value="Paused" icon="repeat"
      onPress={() => router.push({ pathname: '/series/[id]', params: { id: series.id } })} />)}</Group>
  </Page>;
}
