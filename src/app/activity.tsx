import { useTranslation } from '../localization/react';
import { t, live } from '../localization';
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

const events: Record<string, { label: string; icon: IconName; tone: Tone }> = live(() => ({
  CalendarActivated: { label: t('m_bf4156d6b15c'), icon: 'event', tone: 'muted' },
  CalendarRecoveredAlertsEnabled: { label: t('m_8089865e173e'), icon: 'alarm', tone: 'muted' },
  CalendarUpdatedGoogle: { label: t('m_71ad1b9eb735'), icon: 'upload', tone: 'muted' },
  CalendarUpdatedRemilo: { label: t('m_99ddfe321f9f'), icon: 'download', tone: 'muted' },
  CalendarResolved: { label: t('m_86babbe85e1e'), icon: 'check', tone: 'muted' },
  CalendarSuspended: { label: t('m_d4f4db50dfc3'), icon: 'pause', tone: 'muted' },
  CalendarResumed: { label: t('m_925237e9b749'), icon: 'play_arrow', tone: 'muted' },
  CalendarUnlinked: { label: t('m_9e09f61bb7c3'), icon: 'link_off', tone: 'muted' },
  Done: { label: t('m_22a970d2e5b1'), icon: 'check_circle', tone: 'success' },
  Reopen: { label: t('m_53a4ae1c597a'), icon: 'undo', tone: 'muted' }, UndoDelete: { label: t('m_5d561a1e3f17'), icon: 'undo', tone: 'muted' },
  Delete: { label: t('m_2d65f262cc64'), icon: 'delete', tone: 'danger' }, Skip: { label: t('m_9151e9a2464d'), icon: 'cancel', tone: 'muted' },
  Create: { label: t('m_d70b9e24bca2'), icon: 'add', tone: 'muted' }, Edit: { label: t('m_7117f0807129'), icon: 'edit', tone: 'muted' },
  Stop: { label: t('m_f36a51f323bf'), icon: 'stop', tone: 'muted' }, StopAll: { label: t('m_f9435c3c51ce'), icon: 'stop', tone: 'muted' },
  Notified: { label: t('m_02e87bf90c4c'), icon: 'notifications', tone: 'muted' },
  Snooze: { label: t('m_88096584e4a8'), icon: 'snooze', tone: 'muted' }, Postpone: { label: t('m_fd4879b3f653'), icon: 'schedule', tone: 'muted' },
  PauseSeries: { label: t('m_83e8432c0130'), icon: 'pause', tone: 'muted' }, ResumeSeries: { label: t('m_b0bfe35718ef'), icon: 'play_arrow', tone: 'muted' },
  Missed: { label: t('m_14d64a9f7100'), icon: 'warning', tone: 'warning' }, TimedOut: { label: t('m_ba0c9f7afee3'), icon: 'warning', tone: 'warning' },
  Interrupted: { label: t('m_a48a8f6a3fa3'), icon: 'warning', tone: 'warning' }, Failed: { label: t('m_510ed464f04a'), icon: 'error', tone: 'danger' },
  Blocked: { label: t('m_4bf68dddf882'), icon: 'error', tone: 'danger' },
}));
export default function Activity() {
  'use no memo';
  const t = useTranslation();
  const { shortTime } = useTimeFormatting();
  const params = useLocalSearchParams<OriginParams & { id: string; filter?: string }>(), { id } = params;
  const calendarOnly = params.filter === 'calendar';
  const query = useQuery({ queryKey: ['occurrence', id], queryFn: () => engine().getCalendarContext(id), enabled: nativeAvailable });
  const colors = useTheme(), zone = deviceZone(), scale = useFontScaleOverride();
  const { fontScale } = useWindowDimensions();
  const labelHeight = Math.max(24, typography.body * scale * fontScale * 1.4);
  const entries = [...query.data?.history ?? []].filter(entry => !calendarOnly || entry.kind.startsWith('Calendar')).sort((a, b) => b.atMs - a.atMs);
  return <Page title={calendarOnly ? t('m_215ccf52f5f3') : t('m_38da1505ca83')} onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute({ ...retainedOriginParams(params), originReminderId: id }))}>
    <QueryState loading={query.isLoading && nativeAvailable && !query.data} error={!query.data ? query.error : undefined} empty={!query.data && !query.isLoading}
      emptyMessage={t('m_7f00c5392527')} onRetry={() => void query.refetch()} />
    {query.data && <>
      {query.error && <><ActionFeedback message={t('m_602e5e5f720f')} tone="warning" />
        <Button label={t('m_942087cc2d41')} variant="secondary" onPress={() => void query.refetch()} /></>}
      <Copy heading size={typography.title}>{query.data.title}</Copy>
      <Copy muted size={typography.supporting}>{calendarOnly ? t('m_55428760b86c') : t('m_b4c4124aa85a')}</Copy>
      {!!entries.length && <ZoneSummary zoneId={zone} atMs={entries[0].atMs} prefix={t('m_8ddf33c9aaba')} />}
      {!entries.length && <Copy muted>{calendarOnly ? t('m_a575e54879c9') : t('m_aac7fb21009b')}</Copy>}
      {!!entries.length && <Group>{entries.map((entry, index) => {
        const event = events[entry.kind] ?? { label: t('m_51c8035f3e90'), icon: 'history' as const, tone: 'muted' as const };
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
                {t('m_a6e6d7148c57')}{calendarDate(entry.targetMs, zone)} · {shortTime(entry.targetMs, zone)}
              </Copy>}
            </View>
          </View>
        </View>;
      })}</Group>}
    </>}
  </Page>;
}
