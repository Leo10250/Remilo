import { useTranslation } from '../localization/react';

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
  'use no memo';
  const t = useTranslation();
  const params = useLocalSearchParams<OriginParams>(), origin = retainedOriginParams(params);
  const query = useInfiniteQuery({ queryKey: ['calendar', 'review-issues'], enabled: nativeAvailable,
    initialPageParam: null as string | null, queryFn: ({ pageParam }) => engine().getCalendarReviewIssues(pageParam), getNextPageParam: page => page.nextCursor });
  const issues = [...new Map((query.data?.pages.flatMap(page => page.items) ?? []).map(issue => [issue.issueId, issue])).values()];
  const counts = query.data?.pages[0]?.counts;
  return <Page compact title={t('m_4e680674ef4c')} footer={<RootNotice />} onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin))}>
    <Copy muted>{t('m_30396d5d3520')}</Copy>
    {counts && counts.total > 0 && <Copy muted size={14}>{[counts.reminders ? t('m_941c12b896c0', { arg0: String(counts.reminders) }) : '', counts.candidates ? t('m_6f590bbcaf8e', { arg0: String(counts.candidates) }) : '', counts.setup ? t('m_bfbb89b5c707', { arg0: String(counts.setup) }) : ''].filter(Boolean).join(' · ')}</Copy>}
    <QueryState loading={query.isLoading && nativeAvailable} error={query.error} empty={!issues.length} emptyMessage={nativeAvailable ? t('m_fd77f4918b01') : t('m_e25de1435bf8')} onRetry={nativeAvailable ? () => void query.refetch() : undefined} />
    {!!issues.length && <ConnectedGroup>{issues.map(issue => <CalendarIssueRow key={issue.issueId} issue={issue} onPress={() => { const route = calendarReviewRoute(issue); router.push({ ...route, params: { ...('params' in route ? route.params : {}), ...origin,
        ...(issue.kind === 'Candidate' ? { candidateRevision: String(issue.revision) } : {}) } }); }} />)}</ConnectedGroup>}
    {query.hasNextPage && <Button label={query.isFetchingNextPage ? t('m_ba3bbbe10d8b') : t('m_ac8991ef0101')} variant="secondary" disabled={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} />}
  </Page>;
}
function CalendarIssueRow({ issue, onPress }: { issue: CalendarReviewIssue; onPress: () => void }) {
  'use no memo';
  const t = useTranslation();
  const timing = useCalendarReviewTiming(issue.kind === 'Association' ? issue.occurrenceId : undefined);
  const title = issue.title || (issue.kind === 'Setup' ? t('m_eb79753ab339') : t('m_f6e8452bebf4'));
  const reason = calendarReviewIssueText(issue) + ' · ' + calendarReviewIssueReason(issue);
  return <SettingRow prominent icon="event" label={title} description={reason} supporting={timing ? <Copy heading size={16}>{timing}</Copy> : undefined}
    accessibilityLabel={[title, timing, reason].filter(Boolean).join('. ')} minHeight={56} onPress={onPress} />;
}
