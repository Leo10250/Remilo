import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Button, Card, Copy, Heading, Page } from '../../ui/components';
import { engine, nativeAvailable } from '../../ui/native';
import { repeatNames } from '../../ui/recurrence';

export default function SeriesList() {
  const query = useQuery({ queryKey: ['series'], queryFn: () => engine().querySeries(), enabled: nativeAvailable });
  return <Page title="Repeating reminders" subtitle="Each occurrence stays independent.">
    <Button label="New repeating reminder" onPress={() => router.push('/edit')} />
    {query.isLoading && <Copy>Loading…</Copy>}
    {query.error && <Copy>Could not load series. Go back and retry.</Copy>}
    {query.data?.length === 0 && <Card><Copy>Turn on Repeat when creating a reminder to start a series.</Copy></Card>}
    {query.data?.map((series) => <Card key={series.id}><Heading>{series.template.title}</Heading>
      <Copy>{repeatNames[series.rule.frequency]} · {series.state}{series.exhausted ? ' · ending reached' : ''}</Copy>
      <Copy muted>Segment starts {series.rule.anchor.replace('T', ' ')}. {series.registered} future alerts registered.</Copy>
      <Button label="Manage series" variant="secondary" onPress={() => router.push({ pathname: '/series/[id]', params: { id: series.id } })} />
    </Card>)}
  </Page>;
}
