import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import type { Tone } from '../domain/actions';
import { calendarDate } from '../domain/presentation';
import { deviceZone } from '../domain/time';
import { Copy, Icon, Page, QueryState, shortTime, type IconName } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';
import { ZoneSummary } from '../ui/schedule';
import { useTheme } from '../ui/theme';
import { typography } from '../ui/tokens';

const events: Record<string, { label: string; icon: IconName; tone: Tone }> = {
  Done: { label: 'Completed', icon: 'check_circle', tone: 'success' },
  Reopen: { label: 'Reopened', icon: 'undo', tone: 'muted' }, UndoDelete: { label: 'Restored', icon: 'undo', tone: 'muted' },
  Delete: { label: 'Moved to Trash', icon: 'delete', tone: 'danger' }, Skip: { label: 'Occurrence skipped', icon: 'cancel', tone: 'muted' },
  Create: { label: 'Created', icon: 'add', tone: 'muted' }, Edit: { label: 'Edited', icon: 'edit', tone: 'muted' },
  Stop: { label: 'Alarm stopped', icon: 'stop', tone: 'muted' }, StopAll: { label: 'Ringing stopped', icon: 'stop', tone: 'muted' },
  Notified: { label: 'Notification sent', icon: 'notifications', tone: 'muted' },
  Snooze: { label: 'Snoozed', icon: 'snooze', tone: 'accent' }, Postpone: { label: 'Postponed', icon: 'schedule', tone: 'accent' },
  PauseSeries: { label: 'Repeat paused', icon: 'pause', tone: 'muted' }, ResumeSeries: { label: 'Repeat resumed', icon: 'play_arrow', tone: 'muted' },
  Missed: { label: 'Alert missed', icon: 'warning', tone: 'warning' }, TimedOut: { label: 'Alarm timed out', icon: 'warning', tone: 'warning' },
  Interrupted: { label: 'Alarm interrupted', icon: 'warning', tone: 'warning' }, Failed: { label: 'Alarm failed', icon: 'error', tone: 'danger' },
  Blocked: { label: 'Alert blocked', icon: 'error', tone: 'danger' },
};
export default function Activity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: ['occurrence', id], queryFn: () => engine().getOccurrence(id), enabled: nativeAvailable });
  const colors = useTheme(), zone = deviceZone();
  const entries = [...query.data?.history ?? []].sort((a, b) => b.atMs - a.atMs);
  return <Page title="Activity">
    <QueryState loading={query.isLoading && nativeAvailable} error={query.error} empty={!query.data && !query.isLoading}
      emptyMessage="This reminder is unavailable." onRetry={() => void query.refetch()} />
    {query.data && <>
      <Copy heading size={typography.heading}>{query.data.title}</Copy>
      <Copy muted size={typography.supporting}>Recorded actions for this occurrence. Changes to the whole repeat and individual edited fields are not recorded here.</Copy>
      {!!entries.length && <ZoneSummary zoneId={zone} atMs={entries[0].atMs} prefix="Times shown in " />}
      {!entries.length && <Copy muted>No recorded activity.</Copy>}
      {entries.map((entry, index) => {
        const event = events[entry.kind] ?? { label: 'Other recorded action', icon: 'history' as const, tone: 'muted' as const };
        const day = calendarDate(entry.atMs, zone), previousDay = index ? calendarDate(entries[index - 1].atMs, zone) : null;
        return <View key={`${entry.atMs}:${entry.kind}:${index}`} style={{ gap: 8 }}>
          {day !== previousDay && <Copy heading size={typography.supporting}>{day}</Copy>}
          <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 8 }}>
            <View style={{ width: 24, alignItems: 'center', gap: 8 }}>
              <Icon name={event.icon} size={20} color={colors[event.tone]} />
              {index < entries.length - 1 && <View aria-hidden style={{ width: 1, flex: 1, minHeight: 12, backgroundColor: colors.border }} />}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Copy>{event.label}</Copy><Copy muted size={typography.label}>{shortTime(entry.atMs, zone)}</Copy>
              {entry.targetMs != null && ['Snooze', 'Postpone'].includes(entry.kind) && <Copy muted size={typography.supporting}>
                Alert moved to {calendarDate(entry.targetMs, zone)} · {shortTime(entry.targetMs, zone)}
              </Copy>}
            </View>
          </View>
        </View>;
      })}
    </>}
  </Page>;
}
