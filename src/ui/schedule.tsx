import { useQuery } from '@tanstack/react-query';
import { Children, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { alertPresentation, detailSchedulePresentation, eventRange, modeLabel, ordinaryDue, scheduleDateTime, scheduleNeedsDetails, type ScheduleItem } from '../domain/presentation';
import { deviceZone } from '../domain/time';
import { ConnectedGroup, Copy, Disclosure, formatTime, Group, InformationRow } from './components';
import { engine, nativeAvailable } from './native';
import { typography } from './tokens';
export { InformationRow } from './components';

export function SchedulePrimary({ item }: { item: ScheduleItem }) {
  const primary = detailSchedulePresentation(item);
  return <ConnectedGroup><InformationRow key="alert" prominent icon={item.mode === 'None' ? 'event' : item.mode === 'Notification' ? 'notifications' : 'alarm'}
    label={primary.label} value={primary.value} supporting={item.mode === 'None' ? primary.supporting : undefined} /></ConnectedGroup>;
}

export function ZoneSummary({ zoneId, atMs, prefix = '' }: { zoneId: string; atMs: number; prefix?: string }) {
  const zones = useQuery({ queryKey: ['time-zones', atMs], queryFn: () => engine().getTimeZones(atMs), enabled: nativeAvailable });
  const zone = zones.data?.find((candidate) => candidate.id === zoneId);
  const minutes = zone ? Math.abs(Math.trunc(zone.offsetSeconds / 60)) : null;
  const offset = minutes == null ? '' : ` · UTC${zone!.offsetSeconds < 0 ? '−' : '+'}${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return <Copy muted size={typography.supporting}>{prefix}{zone?.label ?? zoneId.split('/').at(-1)?.replaceAll('_', ' ')}{offset}</Copy>;
}

/** Read-only formatting of native instants; this component never resolves or schedules times. */
export function Schedule({ item, draft = false, details = true, connected = false, occurrence = false, hasPublication = false, children }: PropsWithChildren<{ item: ScheduleItem; draft?: boolean; details?: boolean; connected?: boolean; occurrence?: boolean; hasPublication?: boolean }>) {
  const zone = item.zoneId || deviceZone();
  const { label: alert, target: current, changed, targetZone: currentZone } = alertPresentation(item, draft);
  const showZone = zone !== deviceZone() || item.repeatRule?.zoneMode === 'pinned', showAlertZone = changed && currentZone !== zone;
  const summary = detailSchedulePresentation(item, undefined, hasPublication);
  const rows = occurrence ? [
    summary.showEvent && <InformationRow key="when" icon="event" label="Event time" value={eventRange(item)} />,
    summary.showDue && <InformationRow key="due" icon="schedule" label="Due" value={scheduleDateTime(item.dueAtMs, zone)} supporting={item.dueLinked === false ? 'Independent time' : undefined} />,
    ...Children.toArray(children),
  ].filter(Boolean) : [
    <InformationRow key="when" icon="event" label="When" value={eventRange(item)} supporting={ordinaryDue(item) ? item.allDay ? 'Due by end of day' : 'Due at event start' : undefined} />,
    !ordinaryDue(item) && <InformationRow key="due" icon="schedule" label="Due" value={scheduleDateTime(item.dueAtMs, zone)} supporting={item.dueLinked === false ? 'Independent of When' : undefined} />,
    <InformationRow key="mode" icon={item.mode === 'None' ? 'alarm_off' : item.mode === 'Notification' ? 'notifications' : 'alarm'} label="Alert mode" value={modeLabel(item.mode)} />,
    item.mode !== 'None' && <InformationRow key="alert" icon="schedule" label="Next alert" value={alert} supporting={changed ? 'Originally ' + scheduleDateTime(item.alarmAtMs, zone) + ' · Event and due time stay unchanged.' : item.alarmLinked === false ? 'Independent of Due' : undefined} />,
    ...Children.toArray(children),
  ];
  const support = <>
    {showZone && <ZoneSummary zoneId={zone} atMs={item.eventStartMs} />}
    {showAlertZone && <ZoneSummary zoneId={currentZone} atMs={current!} prefix="Current alert uses " />}
    {details && <ScheduleDetails item={item} draft={draft} occurrence={occurrence} hasPublication={hasPublication} />}
  </>;
  if (!rows.length) return showZone || showAlertZone ? <View style={{ paddingHorizontal: 16 }}>{support}</View> : null;
  return connected ? <ConnectedGroup title="Schedule" footer={showZone || showAlertZone || details && scheduleNeedsDetails(item) ? support : undefined}>{rows}</ConnectedGroup> :
    <Group title="Schedule">{rows}<View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>{support}</View></Group>;
}

export function ScheduleDetails({ item, draft = false, occurrence = false, hasPublication = false }: { item: ScheduleItem; draft?: boolean; occurrence?: boolean; hasPublication?: boolean }) {
  const zone = item.zoneId || deviceZone(), mode = modeLabel(item.mode);
  const { changed } = alertPresentation(item, draft);
  const summary = detailSchedulePresentation(item, undefined, hasPublication);
  return occurrence || scheduleNeedsDetails(item) ? <Disclosure title="Schedule details" icon="info">
      {occurrence && !summary.showEvent && <Copy size={typography.supporting}>Event time · {eventRange(item)}</Copy>}
      {occurrence && ordinaryDue(item) && <Copy size={typography.supporting}>{item.allDay ? 'Due at the end of this date' : 'Due follows event start'}</Copy>}
      {!ordinaryDue(item) && <Copy size={typography.supporting}>Due · {formatTime(item.dueAtMs, zone)} · {item.dueLinked === false ? 'Independent of When' : 'Linked to When with an offset'}</Copy>}
      {item.mode !== 'None' && item.alarmLinked === false && <Copy size={typography.supporting}>{mode} · {formatTime(item.alarmAtMs, zone)} · Independent of due time</Copy>}
      {occurrence && item.mode !== 'None' && item.alarmLinked !== false && <Copy size={typography.supporting}>{item.allDay ? mode + ' at 9 AM on this date' : item.alarmAtMs === item.dueAtMs ? mode + ' follows due time' : mode + ' follows due time with an offset'}</Copy>}
      {item.exception && <Copy size={typography.supporting}>This occurrence has an individual change. The ordinary repeat schedule is unchanged.</Copy>}
      {(zone !== deviceZone() || item.repeatRule?.zoneMode === 'pinned') && <>
        <ZoneSummary zoneId={zone} atMs={item.eventStartMs} prefix="Schedule time zone · " />
        <Copy muted size={typography.label}>{zone}</Copy>
      </>}
      {(changed || occurrence && item.mode !== 'None' && !item.completed && !item.deleted && !item.skipped && summary.target !== item.alarmAtMs) && <><Copy size={typography.supporting}>Original {mode.toLowerCase()} · {scheduleDateTime(item.alarmAtMs, zone)}</Copy><Copy muted size={typography.supporting}>Postponement keeps event and due times unchanged.</Copy></>}
    </Disclosure> : null;
}
