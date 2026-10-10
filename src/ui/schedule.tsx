import { useQuery } from '@tanstack/react-query';
import { Children, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { alertPresentation, eventRange, modeLabel, ordinaryDue, scheduleDateTime, scheduleNeedsDetails, type ScheduleItem } from '../domain/presentation';
import { deviceZone } from '../domain/time';
import { ConnectedGroup, Copy, Disclosure, formatTime, Group, InformationRow } from './components';
import { engine, nativeAvailable } from './native';
import { typography } from './tokens';
export { InformationRow } from './components';

export function ZoneSummary({ zoneId, atMs, prefix = '' }: { zoneId: string; atMs: number; prefix?: string }) {
  const zones = useQuery({ queryKey: ['time-zones', atMs], queryFn: () => engine().getTimeZones(atMs), enabled: nativeAvailable });
  const zone = zones.data?.find((candidate) => candidate.id === zoneId);
  const minutes = zone ? Math.abs(Math.trunc(zone.offsetSeconds / 60)) : null;
  const offset = minutes == null ? '' : ` · UTC${zone!.offsetSeconds < 0 ? '−' : '+'}${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return <Copy muted size={typography.supporting}>{prefix}{zone?.label ?? zoneId.split('/').at(-1)?.replaceAll('_', ' ')}{offset}</Copy>;
}

/** Read-only formatting of native instants; this component never resolves or schedules times. */
export function Schedule({ item, draft = false, details = true, connected = false, children }: PropsWithChildren<{ item: ScheduleItem; draft?: boolean; details?: boolean; connected?: boolean }>) {
  const zone = item.zoneId || deviceZone();
  const { label: alert, target: current, changed, targetZone: currentZone } = alertPresentation(item, draft);
  const showZone = zone !== deviceZone() || item.repeatRule?.zoneMode === 'pinned', showAlertZone = changed && currentZone !== zone;
  const rows = [
    <InformationRow key="when" icon="event" label="When" value={eventRange(item)} supporting={ordinaryDue(item) ? item.allDay ? 'Due by end of day' : 'Due at event start' : undefined} />,
    !ordinaryDue(item) && <InformationRow key="due" icon="schedule" label="Due" value={scheduleDateTime(item.dueAtMs, zone)} supporting={item.dueLinked === false ? 'Independent of When' : undefined} />,
    <InformationRow key="mode" icon={item.mode === 'None' ? 'alarm_off' : item.mode === 'Notification' ? 'notifications' : 'alarm'} label="Alert mode" value={modeLabel(item.mode)} />,
    item.mode !== 'None' && <InformationRow key="alert" icon="schedule" label="Next alert" value={alert} supporting={changed ? 'Originally ' + scheduleDateTime(item.alarmAtMs, zone) + ' · Event and due time stay unchanged.' : item.alarmLinked === false ? 'Independent of Due' : undefined} />,
    ...Children.toArray(children),
  ];
  const support = <>
    {showZone && <ZoneSummary zoneId={zone} atMs={item.eventStartMs} />}
    {showAlertZone && <ZoneSummary zoneId={currentZone} atMs={current!} prefix="Current alert uses " />}
    {details && <ScheduleDetails item={item} draft={draft} />}
  </>;
  return connected ? <ConnectedGroup title="Schedule" footer={showZone || showAlertZone || details && scheduleNeedsDetails(item) ? support : undefined}>{rows}</ConnectedGroup> :
    <Group title="Schedule">{rows}<View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>{support}</View></Group>;
}

export function ScheduleDetails({ item, draft = false }: { item: ScheduleItem; draft?: boolean }) {
  const zone = item.zoneId || deviceZone(), mode = modeLabel(item.mode);
  const { changed } = alertPresentation(item, draft);
  return scheduleNeedsDetails(item) ? <Disclosure title="Schedule details" icon="info">
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
