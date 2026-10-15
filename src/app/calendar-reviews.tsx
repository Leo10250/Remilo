import { useInfiniteQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { calendarReviewIssueReason, calendarReviewIssueText, calendarReviewRoute } from '../domain/calendar-managed';
import { Button, ConnectedGroup, Copy, Page, QueryState, SettingRow } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';
import { RootNotice } from '../ui/navigation';
import { useCalendarReviewTiming } from '../ui/calendar-sync';
import type { CalendarReviewIssue } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export default function CalendarReviews() {
  const params = useLocalSearchParams<OriginParams>(), origin = retainedOriginParams(params);
  const query = useInfiniteQuery({ queryKey: ['calendar', 'review-issues'], enabled: nativeAvailable,
    initialPageParam: null as string | null, queryFn: ({ pageParam }) => engine().getCalendarReviewIssues(pageParam), getNextPageParam: page => page.nextCursor });
  const issues = [...new Map((query.data?.pages.flatMap(page => page.items) ?? []).map(issue => [issue.issueId, issue])).values()];
  const counts = query.data?.pages[0]?.counts;
  return <Page compact title="Calendar review" footer={<RootNotice />} onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin))}>
    <Copy muted>Choose an item to see what needs attention. Your current local alerts are kept.</Copy>
    {counts && counts.total > 0 && <Copy muted size={14}>{[counts.reminders ? `${counts.reminders} reminders` : '', counts.candidates ? `${counts.candidates} incoming events` : '', counts.setup ? `${counts.setup} setup issues` : ''].filter(Boolean).join(' · ')}</Copy>}
    <QueryState loading={query.isLoading && nativeAvailable} error={query.error} empty={!issues.length} emptyMessage={nativeAvailable ? 'No Calendar changes need review.' : 'Use the Android app to review Calendar sync.'} onRetry={nativeAvailable ? () => void query.refetch() : undefined} />
    {!!issues.length && <ConnectedGroup>{issues.map(issue => <CalendarIssueRow key={issue.issueId} issue={issue} onPress={() => { const route = calendarReviewRoute(issue); router.push({ ...route, params: { ...('params' in route ? route.params : {}), ...origin,
        ...(issue.kind === 'Candidate' ? { candidateRevision: String(issue.revision) } : {}) } }); }} />)}</ConnectedGroup>}
    {query.hasNextPage && <Button label={query.isFetchingNextPage ? 'Loading…' : 'Load more'} variant="secondary" disabled={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} />}
  </Page>;
}
function CalendarIssueRow({ issue, onPress }: { issue: CalendarReviewIssue; onPress: () => void }) {
  const timing = useCalendarReviewTiming(issue.kind === 'Association' ? issue.occurrenceId : undefined);
  const title = issue.title || (issue.kind === 'Setup' ? 'Remilo calendar setup' : 'Calendar item');
  const reason = calendarReviewIssueText(issue) + ' · ' + calendarReviewIssueReason(issue);
  return <SettingRow prominent icon="event" label={title} description={reason} supporting={timing ? <Copy heading size={16}>{timing}</Copy> : undefined}
    accessibilityLabel={[title, timing, reason].filter(Boolean).join('. ')} minHeight={56} onPress={onPress} />;
}
