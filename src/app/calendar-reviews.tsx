import { useInfiniteQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { calendarReviewIssueReason, calendarReviewIssueText, calendarReviewRoute } from '../domain/calendar-managed';
import { Button, ConnectedGroup, Copy, Page, QueryState, SettingRow } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';

export default function CalendarReviews() {
  const params = useLocalSearchParams<OriginParams>(), origin = retainedOriginParams(params);
  const query = useInfiniteQuery({ queryKey: ['calendar', 'review-issues'], enabled: nativeAvailable,
    initialPageParam: null as string | null, queryFn: ({ pageParam }) => engine().getCalendarReviewIssues(pageParam), getNextPageParam: page => page.nextCursor });
  const issues = [...new Map((query.data?.pages.flatMap(page => page.items) ?? []).map(issue => [issue.issueId, issue])).values()];
  const counts = query.data?.pages[0]?.counts;
  return <Page compact title="Calendar review" onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin))}>
    <Copy muted>Linked reminder reviews preserve your current local alerts. Incoming events are reviewed before a Remilo copy is created or linked. Setup problems and repeating families appear once.</Copy>
    {counts && <Copy muted>{counts.reminders} reminders · {counts.candidates} incoming events · {counts.setup} setup issues</Copy>}
    <QueryState loading={query.isLoading && nativeAvailable} error={query.error} empty={!issues.length} emptyMessage={nativeAvailable ? 'No Calendar changes need review.' : 'Use the Android app to review Calendar sync.'} onRetry={nativeAvailable ? () => void query.refetch() : undefined} />
    {!!issues.length && <ConnectedGroup>{issues.map(issue => <SettingRow key={issue.issueId} icon="event" label={issue.title || (issue.kind === 'Setup' ? 'Remilo calendar setup' : 'Calendar item')}
      description={calendarReviewIssueText(issue) + ' · ' + calendarReviewIssueReason(issue)} minHeight={56} onPress={() => { const route = calendarReviewRoute(issue); router.push({ ...route, params: { ...('params' in route ? route.params : {}), ...origin,
        ...(issue.kind === 'Candidate' ? { candidateRevision: String(issue.revision) } : {}) } }); }} />)}</ConnectedGroup>}
    {query.hasNextPage && <Button label={query.isFetchingNextPage ? 'Loading…' : 'Load more'} variant="secondary" disabled={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} />}
  </Page>;
}
