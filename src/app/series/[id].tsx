import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Copy, formatTime, Heading, Page } from '../../ui/components';
import { engine, nativeAvailable, useCommand } from '../../ui/native';
import { repeatNames } from '../../ui/recurrence';

export default function SeriesDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: ['series', id], queryFn: () => engine().getSeries(id), enabled: nativeAvailable });
  const occurrences = useInfiniteQuery({ queryKey: ['series-occurrences', id], enabled: nativeAvailable,
    initialPageParam: null as string | null, queryFn: ({ pageParam }) => engine().queryReminders({ view: 'all', segmentId: id }, pageParam),
    getNextPageParam: (page) => page.nextCursor });
  const command = useCommand();
  const series = query.data;
  return <Page title={series?.template.title ?? 'Repeating reminder'}>
    {query.isLoading && <Copy>Loading…</Copy>}{query.error && <Copy>Could not load the series.</Copy>}
    {series && <>
      <Card><Heading>{repeatNames[series.rule.frequency]} · {series.state}</Heading>
        <Copy>Every {series.rule.interval} {series.rule.frequency === 'daily' ? 'days' : series.rule.frequency === 'weekly' ? 'weeks' : series.rule.frequency === 'yearly' ? 'years' : 'months'}.</Copy>
        <Copy muted>Original segment anchor: {series.rule.anchor.replace('T', ' ')}</Copy>
        <Copy>{series.rule.zoneId ? `Pinned to ${series.rule.zoneId}` : 'Follows the device time zone'}</Copy>
        <Copy>{series.rule.count ? `${series.rule.count} nominal occurrences` : series.rule.until ? `Through ${series.rule.until}` : 'No ending'}{series.rule.endExclusive ? ` · split before ${series.rule.endExclusive}` : ''}</Copy>
        <Copy>{series.template.mode === 'None' ? 'No alert mode' : `${series.registered} future ordinary alerts registered; ${series.pending} blocked.`}</Copy>
        <Copy muted>Up to two future ordinary occurrences are registered independently. Postponed exceptions have their own alerts.</Copy>
        {series.exhausted && <Copy>The ending has been reached. Old unfinished occurrences are retained.</Copy>}
      </Card>
      {series.state !== 'Archived' && <Card><Heading>Series actions</Heading>
        <Button label={series.state === 'Paused' ? 'Resume series' : 'Pause series'} variant="secondary" disabled={command.isPending}
          onPress={() => command.mutate({ kind: series.state === 'Paused' ? 'ResumeSeries' : 'PauseSeries',
            segmentId: id, expectedRevision: series.revision, operationId: engine().createOperationId() })} />
        <Button label="Edit whole series" variant="secondary" onPress={() => router.push({ pathname: '/edit', params: { segmentId: id } })} />
        <Copy muted>Pause stops future ordinary alerts. Existing postponed and unfinished occurrences stay separate. Resume never replays elapsed alerts.</Copy>
      </Card>}
      <Card><Heading>Next nominal dates</Heading>
        {series.upcoming.map((slot) => <Copy key={slot.nominalSlot}>{slot.nominalSlot.replace('T', ' ')} · alert {formatTime(slot.alarmAtMs)}</Copy>)}
        {!series.upcoming.length && <Copy muted>No future nominal dates.</Copy>}
        <Copy muted>This rule preview includes slots skipped or edited individually. The occurrence list shows their current state.</Copy>
      </Card>
      <Heading>Saved unfinished occurrences</Heading>
      {occurrences.data?.pages.flatMap((page) => page.items).map((item) => <Card key={item.id}>
        <Copy>{formatTime(item.eventStartMs)} · {item.deliveryState}{item.exception ? ' · individual exception' : ''}</Copy>
        <Button label="Open occurrence" variant="secondary" onPress={() => router.push({ pathname: '/reminder/[id]', params: { id: item.id } })} />
      </Card>)}
      {occurrences.hasNextPage && <Button label="Load more occurrences" variant="secondary" onPress={() => void occurrences.fetchNextPage()} />}
    </>}
    {command.error && <Copy>{command.error.message}</Copy>}
  </Page>;
}
