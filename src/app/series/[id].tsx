import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { commandFeedback, type Tone } from '../../domain/actions';
import { modeLabel } from '../../domain/presentation';
import { ActionFeedback, Button, Copy, Disclosure, Group, Page, QueryState, SettingRow, shortDateTime, Status } from '../../ui/components';
import { engine, nativeAvailable, useCommand } from '../../ui/native';
import { repeatLabel } from '../../ui/recurrence';
import { ReminderRow } from '../../ui/reminder-row';
import { typography } from '../../ui/tokens';
import { ZoneSummary } from '../../ui/schedule';
import { deviceZone } from '../../domain/time';

export default function SeriesDetails() {
  const { id, seriesId: requestedFamily } = useLocalSearchParams<{ id: string; seriesId?: string }>();
  const [feedback, setFeedback] = useState<{ message: string; tone: Tone }>();
  const query = useQuery({ queryKey: ['series', id], queryFn: () => engine().getSeries(id), enabled: nativeAvailable });
  const families = useQuery({ queryKey: ['repeat-families'], queryFn: () => engine().queryRepeatFamilies(), enabled: nativeAvailable });
  const familyId = requestedFamily ?? query.data?.seriesId;
  const family = families.data?.find((item) => item.seriesId === familyId || item.current.id === id);
  const series = family?.current ?? query.data;
  const seriesId = family?.seriesId ?? series?.seriesId;
  const occurrences = useInfiniteQuery({ queryKey: ['series-occurrences', seriesId], enabled: nativeAvailable && !!seriesId,
    initialPageParam: null as string | null, queryFn: ({ pageParam }) => engine().queryReminders({ view: 'all', seriesId }, pageParam),
    getNextPageParam: (page) => page.nextCursor });
  const command = useCommand();
  const state = family?.state ?? (series?.exhausted || series?.state === 'Archived' ? 'Ended' : series?.state);
  const items = occurrences.data?.pages.flatMap((page) => page.items) ?? [];
  // Only the family projection excludes completed, skipped and exceptional slots.
  const upcoming = family?.upcoming ?? [];
  const changeState = async () => {
    if (!series || command.isPending) return;
    setFeedback(undefined);
    try {
      const result = await command.mutateAsync({ kind: state === 'Paused' ? 'ResumeSeries' : 'PauseSeries', segmentId: series.id,
        expectedRevision: series.revision, operationId: engine().createOperationId() });
      setFeedback(commandFeedback(result, state === 'Paused' ? 'Repeat resumed.' : 'Repeat paused.'));
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : 'Could not update this repeat. Try again.', tone: 'danger' }); }
  };
  return <Page title="Repeat details">
    <QueryState loading={!series && (query.isLoading || families.isLoading)} error={!series ? query.error ?? families.error : undefined}
      empty={!series} emptyMessage={!nativeAvailable ? 'Use the Android app to manage repeats.' : 'This repeat is no longer available.'}
      onRetry={() => { void query.refetch(); void families.refetch(); }} />
    {series && <>
      <Copy heading size={typography.title}>{series.template.title}</Copy>
      <Copy>{repeatLabel(series.rule)}</Copy>
      <Status label={state === 'Ended' ? 'Repeat has ended' : state ?? 'Active'} tone={state === 'Active' ? 'success' : 'muted'} />
      {state !== 'Active' && <Copy muted size={typography.supporting}>{state === 'Paused' ? 'Ordinary repeat alerts are paused.' : 'There are no ordinary future occurrences.'} Individually changed occurrences can still have their own alerts.</Copy>}
      <QueryState loading={families.isLoading} error={families.error} onRetry={() => void families.refetch()} />
      <Group title="Schedule">
        <SettingRow label="Time zone" value={series.rule.zoneId ?? 'Follows your device'} />
        <SettingRow label="Ends" value={series.rule.count ? `After ${series.rule.count} occurrences` : series.rule.until ?? 'Does not end'} />
        {!!series.template.listName && <SettingRow label="List" value={series.template.listName} />}
      </Group>
      {series.state !== 'Archived' && <Group title="Manage repeat">
        {state !== 'Ended' && <SettingRow icon={state === 'Paused' ? 'play_arrow' : 'pause'} label={state === 'Paused' ? 'Resume repeat' : 'Pause repeat'}
          disabled={command.isPending} onPress={() => void changeState()} />}
        <SettingRow icon="edit" label="Edit entire series" disabled={command.isPending}
          onPress={() => router.push({ pathname: '/edit', params: { segmentId: series.id } })} />
      </Group>}
      <ActionFeedback message={command.isPending ? 'Updating repeat…' : feedback?.message} tone={feedback?.tone} loading={command.isPending} />
      <Group title={state === 'Paused' ? 'Planned dates' : 'Next dates'}>{upcoming.slice(0, 3).map((slot) => {
        const paused = (slot.state ?? state) === 'Paused', mode = slot.mode ?? series.template.mode;
        return <SettingRow key={slot.segmentId + ':' + slot.nominalSlot}
        label={shortDateTime(slot.eventStartMs, slot.zoneId ?? series.rule.zoneId ?? undefined)}
        description={mode === 'None' ? 'No alert' : (paused ? 'Planned ' : '') + modeLabel(mode) + ' · ' +
          shortDateTime(slot.alarmAtMs, slot.zoneId ?? series.rule.zoneId ?? undefined) + (paused ? ' · Paused' : '')}>
          {(slot.zoneId ?? series.rule.zoneId) && (slot.zoneId ?? series.rule.zoneId) !== deviceZone() && <ZoneSummary zoneId={(slot.zoneId ?? series.rule.zoneId)!} atMs={slot.eventStartMs} />}
        </SettingRow>;
      })}
        {!upcoming.length && !families.isLoading && !families.error && <SettingRow label="No ordinary future dates" />}</Group>
      <Disclosure title="Unfinished occurrences" initial>
        <QueryState loading={occurrences.isLoading} error={occurrences.error} empty={!items.length}
          emptyMessage="No unfinished occurrences." onRetry={() => void occurrences.refetch()} />
        {items.map((item) => <ReminderRow key={item.id} item={item}
          onOpen={() => router.push({ pathname: '/reminder/[id]', params: { id: item.id } })} />)}
        {occurrences.hasNextPage && <Button label={occurrences.isFetchingNextPage ? 'Loading more…' : 'Load more'}
          disabled={occurrences.isFetchingNextPage} variant="secondary" onPress={() => void occurrences.fetchNextPage()} />}
      </Disclosure>
      <Copy muted size={14}>Earlier unfinished and postponed occurrences remain here after a schedule changes.</Copy>
    </>}
  </Page>;
}
