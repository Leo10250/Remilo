import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { alertPresentation, calendarDate, eventRange, modeLabel, ordinaryDue, scheduleDateTime, scheduleNeedsDetails, type ScheduleItem } from '../domain/presentation';
import { deviceZone } from '../domain/time';
import { Copy, Disclosure, formatTime, Group } from './components';
import { engine, nativeAvailable } from './native';
import { typography } from './tokens';

export function ZoneSummary({ zoneId, atMs, prefix = '' }: { zoneId: string; atMs: number; prefix?: string }) {
  const zones = useQuery({ queryKey: ['time-zones', atMs], queryFn: () => engine().getTimeZones(atMs), enabled: nativeAvailable });
  const zone = zones.data?.find((candidate) => candidate.id === zoneId);
  const minutes = zone ? Math.abs(Math.trunc(zone.offsetSeconds / 60)) : null;
  const offset = minutes == null ? '' : ` · UTC${zone!.offsetSeconds < 0 ? '−' : '+'}${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return <Copy muted size={typography.supporting}>{prefix}{zone?.label ?? zoneId.split('/').at(-1)?.replaceAll('_', ' ')}{offset}</Copy>;
}

/** Read-only formatting of native instants; this component never resolves or schedules times. */
export function Schedule({ item, draft = false, details = true }: { item: ScheduleItem; draft?: boolean; details?: boolean }) {
  const zone = item.zoneId || deviceZone();
  const { label: alert, target: current, changed, targetZone: currentZone } = alertPresentation(item, draft);
  return <Group title="Schedule"><View style={{ padding: 16, gap: 8 }}>
    <Copy>{eventRange(item)}</Copy>
    {(!ordinaryDue(item) || item.overdue && !item.allDay) && <Copy muted size={typography.supporting}>Due {scheduleDateTime(item.dueAtMs, zone)}</Copy>}
    {item.allDay && ordinaryDue(item) && <Copy muted size={typography.supporting}>Due by end of day{item.overdue ? ' · ' + calendarDate(item.eventStartMs, zone) : ''}</Copy>}
    <Copy muted size={typography.supporting}>{alert}</Copy>
    {changed && <Copy muted size={typography.label}>Originally {scheduleDateTime(item.alarmAtMs, zone)} · When and due time stay unchanged.</Copy>}
    {(zone !== deviceZone() || item.repeatRule?.zoneMode === 'pinned') && <ZoneSummary zoneId={zone} atMs={item.eventStartMs} />}
    {changed && currentZone !== zone && <ZoneSummary zoneId={currentZone} atMs={current!} prefix="Current alert uses " />}
    {details && <ScheduleDetails item={item} draft={draft} />}
  </View></Group>;
}

export function ScheduleDetails({ item, draft = false }: { item: ScheduleItem; draft?: boolean }) {
  const zone = item.zoneId || deviceZone(), mode = modeLabel(item.mode);
  const { changed } = alertPresentation(item, draft);
  return scheduleNeedsDetails(item) ? <Disclosure title="Schedule details">
      {!ordinaryDue(item) && <Copy size={typography.supporting}>Due · {formatTime(item.dueAtMs, zone)} · {item.dueLinked === false ? 'Independent of When' : 'Linked to When with an offset'}</Copy>}
      {item.mode !== 'None' && item.alarmLinked === false && <Copy size={typography.supporting}>{mode} · {formatTime(item.alarmAtMs, zone)} · Independent of due time</Copy>}
      {item.exception && <Copy size={typography.supporting}>This occurrence has an individual change. The ordinary repeat schedule is unchanged.</Copy>}
      {(zone !== deviceZone() || item.repeatRule?.zoneMode === 'pinned') && <>
        <ZoneSummary zoneId={zone} atMs={item.eventStartMs} prefix="Schedule time zone · " />
        <Copy muted size={typography.label}>{zone}</Copy>
      </>}
      {changed && <Copy muted size={typography.supporting}>Only the current alert changed. Event and Due stay unchanged.</Copy>}
    </Disclosure> : null;
}
