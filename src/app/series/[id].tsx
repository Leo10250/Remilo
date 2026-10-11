import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { eventRange, modeLabel } from '../../domain/presentation';
import { creationOrigin, familyBackRoute, familyOriginParams, type OriginParams } from '../../domain/navigation';
import { ActionFeedback, AtmosphericHeader, Button, Copy, Disclosure, Group, Page, QueryState, SettingRow, shortDateTime, Status } from '../../ui/components';
import { engine, nativeAvailable } from '../../ui/native';
import { CommandRecovery, useCapturedCommand, useDestinationNavigation } from '../../ui/navigation';
import { repeatLabel } from '../../ui/recurrence';
import { ReminderRow } from '../../ui/reminder-row';
import { typography } from '../../ui/tokens';
import { ZoneSummary } from '../../ui/schedule';
import { deviceZone } from '../../domain/time';

export default function SeriesDetails() {
  const params = useLocalSearchParams<OriginParams & { id: string; seriesId?: string }>();
  const { id, seriesId: requestedFamily } = params, origin = creationOrigin(params);
  const query = useQuery({ queryKey: ['series', id], queryFn: () => engine().getSeries(id), enabled: nativeAvailable });
  const families = useQuery({ queryKey: ['repeat-families'], queryFn: () => engine().queryRepeatFamilies(), enabled: nativeAvailable });
  const familyId = requestedFamily ?? query.data?.seriesId;
  const family = families.data?.find((item) => item.seriesId === familyId || item.current.id === id);
  const series = family?.current ?? query.data;
  const seriesId = family?.seriesId ?? series?.seriesId;
  const occurrences = useInfiniteQuery({ queryKey: ['series-occurrences', seriesId], enabled: nativeAvailable && !!seriesId,
    initialPageParam: null as string | null, queryFn: ({ pageParam }) => engine().queryReminders({ view: 'all', seriesId }, pageParam),
    getNextPageParam: (page) => page.nextCursor });
  const action = useCapturedCommand(), back = useDestinationNavigation(origin, undefined, action.guarded, origin, familyBackRoute(params));
  const state = family?.state ?? (series?.exhausted || series?.state === 'Archived' ? 'Ended' : series?.state);
  const items = occurrences.data?.pages.flatMap((page) => page.items) ?? [];
  // Only the family projection excludes completed, skipped and exceptional slots.
  const upcoming = family?.upcoming ?? [];
  const changeState = async () => {
    if (!series || action.guarded) return;
    await action.execute({ command: { kind: state === 'Paused' ? 'ResumeSeries' : 'PauseSeries', segmentId: series.id,
      expectedRevision: series.revision, operationId: engine().createOperationId() }, success: state === 'Paused' ? 'Repeat resumed.' : 'Repeat paused.' });
  };
  return <Page title="Repeat details" onBack={back} scrollKey={'family:' + (seriesId ?? id)} scrollReady={!query.isLoading && !families.isLoading}
    header={<AtmosphericHeader title="Repeat details" onBack={back} />} footer={<CommandRecovery action={action} />}>
    <QueryState loading={!series && (query.isLoading || families.isLoading)} error={!series ? query.error ?? families.error : undefined}
      empty={!series} emptyMessage={!nativeAvailable ? 'Use the Android app to manage repeats.' : 'This repeat is no longer available.'}
      onRetry={() => { void query.refetch(); void families.refetch(); }} />
    {series && <>
      <Copy heading size={typography.title}>{series.template.title}</Copy>
      <Status label={state === 'Ended' ? 'Repeat has ended' : state ?? 'Active'} tone={state === 'Active' ? 'success' : 'muted'} />
      <Copy muted size={typography.supporting}>{repeatLabel(series.rule)}</Copy>
      {state !== 'Active' && <Copy muted size={typography.supporting}>{state === 'Paused' ? 'Repeat alerts are paused.' : 'No new dates remain.'} Alerts changed for individual dates may still ring.</Copy>}
      <QueryState loading={families.isLoading} error={families.error} onRetry={() => void families.refetch()} />
      <Group title="Schedule">
        <SettingRow icon="event" label="Event" description={eventRange(series.template)} />
        {(series.template.dueLinked === false || series.template.dueAtMs !== series.template.eventStartMs) && <SettingRow icon="schedule" label="Due" description={series.template.allDay && series.template.dueLinked ? 'By end of day' : shortDateTime(series.template.dueAtMs, series.rule.zoneId ?? undefined) + (series.template.dueLinked === false ? ' · Independent of Event' : ' · Linked to Event')} />}
        <SettingRow icon={series.template.mode === 'Alarm' ? 'alarm' : series.template.mode === 'Notification' ? 'notifications' : 'alarm_off'} label={modeLabel(series.template.mode)} description={series.template.mode === 'None' ? 'No alert' : shortDateTime(series.template.alarmAtMs, series.rule.zoneId ?? undefined) + (series.template.alarmLinked === false ? ' · Independent of Due' : ' · Follows Due')} />
        {series.rule.zoneId ? <ZoneSummary zoneId={series.rule.zoneId} atMs={series.template.eventStartMs} prefix="Time zone · " /> : <SettingRow label="Time zone" value="Follows your device" />}
        <SettingRow icon="repeat" label="Ends" value={series.rule.count ? `After ${series.rule.count} occurrences` : series.rule.until ?? 'Does not end'} />
        {!!series.template.listName && <SettingRow icon="checklist" label="List" value={series.template.listName} />}
      </Group>
      {series.state !== 'Archived' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {state !== 'Ended' && <View style={{ flexGrow: 1, flexBasis: 160 }}><Button icon={state === 'Paused' ? 'play_arrow' : 'pause'} label={state === 'Paused' ? 'Resume repeat' : 'Pause repeat'}
          disabled={action.guarded} onPress={() => void changeState()} /></View>}
        <View style={{ flexGrow: 1, flexBasis: 160 }}><Button icon="edit" label="Edit entire series" variant="secondary" disabled={action.guarded}
          onPress={() => router.push({ pathname: '/edit', params: { segmentId: series.id, ...familyOriginParams(params, seriesId ?? series.seriesId, series.id) } })} /></View>
      </View>}
      <Group title={state === 'Paused' ? 'Planned dates' : 'Next dates'}>{upcoming.slice(0, 3).map((slot) => {
        const paused = (slot.state ?? state) === 'Paused', mode = slot.mode ?? series.template.mode;
        return <SettingRow key={slot.segmentId + ':' + slot.nominalSlot} icon="event"
        label={shortDateTime(slot.eventStartMs, slot.zoneId ?? series.rule.zoneId ?? undefined)}
        description={mode === 'None' ? 'No alert' : (paused ? 'Planned ' : '') + modeLabel(mode) + ' · ' +
          shortDateTime(slot.alarmAtMs, slot.zoneId ?? series.rule.zoneId ?? undefined) + (paused ? ' · Paused' : '')}>
          {(slot.zoneId ?? series.rule.zoneId) && (slot.zoneId ?? series.rule.zoneId) !== deviceZone() && <ZoneSummary zoneId={(slot.zoneId ?? series.rule.zoneId)!} atMs={slot.eventStartMs} />}
        </SettingRow>;
      })}
        {!upcoming.length && !families.isLoading && !families.error && <SettingRow label="No new dates remain" />}</Group>
      {!!upcoming.length && upcoming.length < 3 && <Copy muted size={14}>Fewer than three dates remain.</Copy>}
      <Disclosure title="Unfinished occurrences" initial>
        <QueryState loading={occurrences.isLoading} error={occurrences.error} empty={!items.length}
          emptyMessage="No unfinished occurrences." onRetry={() => void occurrences.refetch()} />
        {items.map((item) => <ReminderRow key={item.id} item={item}
          onOpen={() => { if (!action.guarded) router.push({ pathname: '/reminder/[id]', params: { id: item.id, ...familyOriginParams(params, seriesId ?? series.seriesId, series.id) } }); }} busy={action.guarded} />)}
        {occurrences.isFetchNextPageError && <ActionFeedback message="Could not load more. Previously loaded occurrences remain available." tone="danger" />}
        {occurrences.hasNextPage && <Button label={occurrences.isFetchingNextPage ? 'Loading more…' : occurrences.isFetchNextPageError ? 'Retry loading more' : 'Load more'}
          disabled={occurrences.isFetchingNextPage} variant="secondary" onPress={() => void occurrences.fetchNextPage()} />}
      </Disclosure>
      <Copy muted size={14}>Earlier unfinished and postponed occurrences remain here after a schedule changes.</Copy>
    </>}
  </Page>;
}
