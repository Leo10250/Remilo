import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Copy, Disclosure, formatTime, Group, Page, SettingRow, Status } from '../../ui/components';
import { engine, nativeAvailable, useCommand } from '../../ui/native';
import { repeatLabel } from '../../ui/recurrence';
import { ReminderRow } from '../../ui/reminder-row';
export default function SeriesDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: ['series', id], queryFn: () => engine().getSeries(id), enabled: nativeAvailable });
  const occurrences = useInfiniteQuery({ queryKey: ['series-occurrences', id], enabled: nativeAvailable, initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => engine().queryReminders({ view: 'all', segmentId: id }, pageParam), getNextPageParam: (page) => page.nextCursor });
  const command = useCommand(), series = query.data;
  return <Page title="Repeat details">
    {query.isLoading && <Copy>Loading…</Copy>}{query.error && <Copy>Could not load this reminder.</Copy>}
    {series && <>
      <Copy size={24}>{series.template.title}</Copy><Copy>{repeatLabel(series.rule)}</Copy>
      <Status label={series.state === 'Paused' ? 'Paused' : series.exhausted ? 'Repeat has ended' : series.state === 'Archived' ? 'Previous schedule' : 'Active'}
        tone={series.state === 'Active' && !series.exhausted ? 'success' : 'muted'} />
      <Copy muted size={14}>{series.rule.zoneId ? 'Time zone · ' + series.rule.zoneId : 'Follows your device time zone'}</Copy>
      <Copy muted size={14}>{series.rule.count ? 'Ends after ' + series.rule.count + ' occurrences' : series.rule.until ? 'Ends on ' + series.rule.until : 'Does not end'}</Copy>
      {series.state !== 'Archived' && <Group>
        <SettingRow icon={series.state === 'Paused' ? 'play_arrow' : 'pause'} label={series.state === 'Paused' ? 'Resume repeat' : 'Pause repeat'} disabled={command.isPending}
          onPress={() => command.mutate({ kind: series.state === 'Paused' ? 'ResumeSeries' : 'PauseSeries', segmentId: id, expectedRevision: series.revision, operationId: engine().createOperationId() })} />
        <SettingRow icon="edit" label="Edit entire series" onPress={() => router.push({ pathname: '/edit', params: { segmentId: id } })} />
      </Group>}
      <Group title="Next dates">{series.upcoming.slice(0, 3).map((slot) => <SettingRow key={slot.nominalSlot} label={formatTime(slot.eventStartMs)} description={'Alarm ' + formatTime(slot.alarmAtMs)} />)}
        {!series.upcoming.length && <SettingRow label="No future dates" />}</Group>
      <Disclosure title="Unfinished occurrences" initial>
        {occurrences.data?.pages.flatMap((page) => page.items).map((item) => <ReminderRow key={item.id} item={item}
          onOpen={() => router.push({ pathname: '/reminder/[id]', params: { id: item.id } })} />)}
        {occurrences.hasNextPage && <Button label="Load more" variant="secondary" onPress={() => void occurrences.fetchNextPage()} />}
      </Disclosure>
      <Copy muted size={13}>Pausing retains independently postponed alarms and unfinished occurrences.</Copy>
    </>}
    {command.error && <Status label={command.error.message} tone="danger" />}
  </Page>;
}
