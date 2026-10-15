import { useTimeFormatting } from '../ui/time-display';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import type { Tone } from '../domain/actions';
import { calendarDate } from '../domain/presentation';
import { calendarActivityLabel } from '../domain/calendar-ux';
import { deviceZone } from '../domain/time';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { ActionFeedback, Button, Copy, Group, Icon, Page, QueryState, type IconName } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';
import { ZoneSummary } from '../ui/schedule';
import { useFontScaleOverride, useTheme } from '../ui/theme';
import { typography } from '../ui/tokens';

const events: Record<string, { label: string; icon: IconName; tone: Tone }> = {
  CalendarActivated: { label: 'Automatic Calendar sync enabled', icon: 'event', tone: 'muted' },
  CalendarRecoveredAlertsEnabled: { label: 'Recovered Calendar alerts enabled', icon: 'alarm', tone: 'muted' },
  CalendarUpdatedGoogle: { label: 'Updated Google Calendar', icon: 'upload', tone: 'muted' },
  CalendarUpdatedRemilo: { label: 'Updated from Google Calendar', icon: 'download', tone: 'muted' },
  CalendarResolved: { label: 'Calendar changes reviewed', icon: 'check', tone: 'muted' },
  CalendarSuspended: { label: 'Calendar sync paused', icon: 'pause', tone: 'muted' },
  CalendarResumed: { label: 'Calendar sync resumed', icon: 'play_arrow', tone: 'muted' },
  CalendarUnlinked: { label: 'Unlinked from Google Calendar', icon: 'link_off', tone: 'muted' },
  Done: { label: 'Completed', icon: 'check_circle', tone: 'success' },
  Reopen: { label: 'Reopened', icon: 'undo', tone: 'muted' }, UndoDelete: { label: 'Restored', icon: 'undo', tone: 'muted' },
  Delete: { label: 'Moved to Trash', icon: 'delete', tone: 'danger' }, Skip: { label: 'Occurrence skipped', icon: 'cancel', tone: 'muted' },
  Create: { label: 'Created', icon: 'add', tone: 'muted' }, Edit: { label: 'Edited', icon: 'edit', tone: 'muted' },
  Stop: { label: 'Alarm stopped', icon: 'stop', tone: 'muted' }, StopAll: { label: 'Ringing stopped', icon: 'stop', tone: 'muted' },
  Notified: { label: 'Notification sent', icon: 'notifications', tone: 'muted' },
  Snooze: { label: 'Snoozed', icon: 'snooze', tone: 'muted' }, Postpone: { label: 'Postponed', icon: 'schedule', tone: 'muted' },
  PauseSeries: { label: 'Repeat paused', icon: 'pause', tone: 'muted' }, ResumeSeries: { label: 'Repeat resumed', icon: 'play_arrow', tone: 'muted' },
  Missed: { label: 'Alert missed', icon: 'warning', tone: 'warning' }, TimedOut: { label: 'Alarm timed out', icon: 'warning', tone: 'warning' },
  Interrupted: { label: 'Alarm interrupted', icon: 'warning', tone: 'warning' }, Failed: { label: 'Alarm failed', icon: 'error', tone: 'danger' },
  Blocked: { label: 'Alert blocked', icon: 'error', tone: 'danger' },
};
export default function Activity() {
  const { shortTime } = useTimeFormatting();
  const params = useLocalSearchParams<OriginParams & { id: string; filter?: string }>(), { id } = params;
  const calendarOnly = params.filter === 'calendar';
  const query = useQuery({ queryKey: ['occurrence', id], queryFn: () => engine().getCalendarContext(id), enabled: nativeAvailable });
  const colors = useTheme(), zone = deviceZone(), scale = useFontScaleOverride();
  const { fontScale } = useWindowDimensions();
  const labelHeight = Math.max(24, typography.body * scale * fontScale * 1.4);
  const entries = [...query.data?.history ?? []].filter(entry => !calendarOnly || entry.kind.startsWith('Calendar')).sort((a, b) => b.atMs - a.atMs);
  return <Page title={calendarOnly ? 'Recent Calendar changes' : 'Activity'} onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute({ ...retainedOriginParams(params), originReminderId: id }))}>
    <QueryState loading={query.isLoading && nativeAvailable && !query.data} error={!query.data ? query.error : undefined} empty={!query.data && !query.isLoading}
      emptyMessage="This reminder is unavailable." onRetry={() => void query.refetch()} />
    {query.data && <>
      {query.error && <><ActionFeedback message="Could not refresh activity. Showing previously recorded entries." tone="warning" />
        <Button label="Retry" variant="secondary" onPress={() => void query.refetch()} /></>}
      <Copy heading size={typography.title}>{query.data.title}</Copy>
      <Copy muted size={typography.supporting}>{calendarOnly ? 'Confirmed Calendar changes for this reminder or linked repeat. Routine checks and retries aren’t listed.' : 'Recorded actions for this occurrence, including confirmed linked Calendar changes.'}</Copy>
      {!!entries.length && <ZoneSummary zoneId={zone} atMs={entries[0].atMs} prefix="Times shown in " />}
      {!entries.length && <Copy muted>{calendarOnly ? 'No recorded Calendar changes.' : 'No recorded activity.'}</Copy>}
      {!!entries.length && <Group>{entries.map((entry, index) => {
        const event = events[entry.kind] ?? { label: 'Other recorded action', icon: 'history' as const, tone: 'muted' as const };
        const day = calendarDate(entry.atMs, zone), previousDay = index ? calendarDate(entries[index - 1].atMs, zone) : null;
        return <View key={`${entry.atMs}:${entry.kind}:${index}`} style={{ gap: 8,paddingHorizontal:16,paddingTop:12,paddingBottom:8 }}>
          {day !== previousDay && <Copy heading size={typography.supporting}>{day}</Copy>}
          <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 8 }}>
            <View style={{ width: 24, alignItems: 'center', gap: 8 }}>
              <View style={{ height: labelHeight, justifyContent: 'center' }}><Icon name={event.icon} size={24} color={colors[event.tone]} /></View>
              {index < entries.length - 1 && <View aria-hidden style={{ width: 1, flex: 1, minHeight: 12, backgroundColor: colors.border }} />}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ minHeight: labelHeight, justifyContent: 'center' }}><Copy>{calendarActivityLabel(entry.kind, entry.groups) || event.label}</Copy></View><Copy muted size={typography.label}>{shortTime(entry.atMs, zone)}</Copy>
              {entry.targetMs != null && ['Snooze', 'Postpone'].includes(entry.kind) && <Copy muted size={typography.supporting}>
                Alert moved to {calendarDate(entry.targetMs, zone)} · {shortTime(entry.targetMs, zone)}
              </Copy>}
            </View>
          </View>
        </View>;
      })}</Group>}
    </>}
  </Page>;
}
