import { useInfiniteQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { calendarReviewReason } from '../domain/calendar-presentation';
import { Button, ConnectedGroup, Copy, Page, QueryState, SettingRow } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';

export default function CalendarReviews() {
  const params = useLocalSearchParams<OriginParams>(), origin = retainedOriginParams(params);
  const query = useInfiniteQuery({ queryKey: ['calendar', 'review-issues'], enabled: nativeAvailable,
    initialPageParam: null as string | null, queryFn: ({ pageParam }) => engine().getCalendarReviewIssues(pageParam), getNextPageParam: page => page.nextCursor });
  const issues = query.data?.pages.flatMap(page => page.items) ?? [];
  return <Page compact title="Calendar review" onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin))}>
    <Copy muted>Review affects the linked Calendar relationship. Your current Remilo alerts remain in effect. Repeating families appear once.</Copy>
    <QueryState loading={query.isLoading} error={query.error} empty={!issues.length} emptyMessage="No Calendar changes need review." onRetry={() => void query.refetch()} />
    {!!issues.length && <ConnectedGroup>{issues.map(issue => <SettingRow key={issue.occurrenceId} icon="event" label={issue.title}
      description={calendarReviewReason(issue.reason) + (issue.affectedScopes?.length ? ' Affected occurrences: ' + issue.affectedScopes.join(', ') : '')} minHeight={56} onPress={() => router.push({ pathname: '/calendar-manage', params: { id: issue.occurrenceId, ...origin } })} />)}</ConnectedGroup>}
    {query.hasNextPage && <Button label={query.isFetchingNextPage ? 'Loading…' : 'Load more'} variant="secondary" disabled={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} />}
  </Page>;
}
