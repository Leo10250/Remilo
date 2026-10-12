import { router, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import type { CalendarLink, CalendarLinkedOperation, CalendarPublication, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { OriginParams } from '../domain/navigation';
import { calendarCancellation, calendarSummary } from '../domain/calendar-presentation';
import { engine, nativeAvailable } from './native';
import { Button, ConnectedGroup, Copy, SettingRow } from './components';
import { useTimeFormatting } from './time-display';

export function useCalendarAssociation(ids: readonly string[], enabled = true) {
  const links = useQuery({ queryKey: ['calendar', 'links'], queryFn: () => engine().getCalendarLinks(), enabled: nativeAvailable && enabled });
  const publications = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(), enabled: nativeAvailable && enabled });
  return (links.data || []).some(link => ids.includes(link.occurrenceId)) || (publications.data || []).some(pub => ids.includes(pub.occurrenceId));
}
export function CalendarSummaryRow({ id, link, publication, jobs, origin, disabled = false }: { id: string; link?: CalendarLink; publication?: CalendarPublication; jobs: CalendarLinkedOperation[]; origin: OriginParams; disabled?: boolean }) {
  const { scheduleDateTime } = useTimeFormatting();
  if (!link && !publication && !jobs.length) return null;
  const summary = calendarSummary(link, publication, jobs);
  return <ConnectedGroup><SettingRow icon="event" label="Google Calendar" disabled={disabled}
    description={summary === 'Linked' && link?.observedAtMs != null ? 'Linked · Last checked ' + scheduleDateTime(link.observedAtMs) : summary}
    onPress={() => router.push({ pathname: '/calendar-manage', params: { id, ...origin, originReminderId: id } } as Href)} /></ConnectedGroup>;
}
export function CalendarExceptionNotice({ item, link, jobs, onTrash, onManage, disabled }: { item: Occurrence; link?: CalendarLink; jobs: CalendarLinkedOperation[]; onTrash: () => void; onManage: () => void; disabled: boolean }) {
  const { detailSchedulePresentation } = useTimeFormatting();
  const cancellation = calendarCancellation(item, link);
  const partial = !item.completed && !item.deleted && !item.skipped && jobs.some(job => job.localApplied && job.state === 'Unconfirmed');
  if (!cancellation && !partial) return null;
  const time = detailSchedulePresentation(item);
  return <ConnectedGroup><View key="notice" style={{ padding: 16, gap: 12 }}><Copy heading>{cancellation?.detail || 'Reminder saved. Google update not confirmed.'}</Copy>
    {cancellation && item.mode !== 'None' && <Copy muted>{item.deliveryState === 'Alerting' ? 'Alarm ringing' : time.label + ': ' + time.value + (time.supporting ? ' · ' + time.supporting : '')}</Copy>}
    {cancellation && <Button label="Move reminder to Trash" icon="delete" variant="secondary" disabled={disabled} onPress={onTrash} />}
    <Button label="Calendar details" variant="secondary" disabled={disabled} onPress={onManage} />
  </View></ConnectedGroup>;
}
