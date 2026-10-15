import { useLocale, useTranslation } from '../localization/react';

import { useTimeFormatting } from './time-display';
import { useQuery } from '@tanstack/react-query';
import { Children, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { modeLabel, ordinaryDue, scheduleNeedsDetails, type ScheduleItem } from '../domain/presentation';
import { deviceZone } from '../domain/time';
import { ConnectedGroup, Copy, Disclosure, Group, InformationRow } from './components';
import { engine, nativeAvailable } from './native';
import { typography } from './tokens';
export { InformationRow } from './components';

export function SchedulePrimary({ item }: { item: ScheduleItem }) {
  'use no memo';
  useLocale();
  const { detailSchedulePresentation } = useTimeFormatting();
  const primary = detailSchedulePresentation(item);
  return <ConnectedGroup><InformationRow key="alert" prominent icon={item.mode === 'None' ? 'event' : item.mode === 'Notification' ? 'notifications' : 'alarm'}
    label={primary.label} value={primary.value} supporting={item.mode === 'None' ? primary.supporting : undefined} /></ConnectedGroup>;
}

export function ZoneSummary({ zoneId, atMs, prefix = '' }: { zoneId: string; atMs: number; prefix?: string }) {
  'use no memo';
  const t = useTranslation();
  const zones = useQuery({ queryKey: ['time-zones', atMs], queryFn: () => engine().getTimeZones(atMs), enabled: nativeAvailable });
  const zone = zones.data?.find((candidate) => candidate.id === zoneId);
  const minutes = zone ? Math.abs(Math.trunc(zone.offsetSeconds / 60)) : null;
  const offset = minutes == null ? '' : t('m_96f63af4d45b', { arg0: String(zone!.offsetSeconds < 0 ? '−' : '+'), arg1: String(String(Math.floor(minutes / 60)).padStart(2, '0')), arg2: String(String(minutes % 60).padStart(2, '0')) });
  return <Copy muted size={typography.supporting}>{prefix}{zone?.label ?? zoneId.split('/').at(-1)?.replaceAll('_', ' ')}{offset}</Copy>;
}

/** Read-only formatting of native instants; this component never resolves or schedules times. */
export function Schedule({ item, draft = false, details = true, connected = false, occurrence = false, hasPublication = false, children }: PropsWithChildren<{ item: ScheduleItem; draft?: boolean; details?: boolean; connected?: boolean; occurrence?: boolean; hasPublication?: boolean }>) {
  'use no memo';
  const t = useTranslation();
  const { alertPresentation, detailSchedulePresentation, eventRange, scheduleDateTime } = useTimeFormatting();
  const zone = item.zoneId || deviceZone();
  const { label: alert, target: current, changed, targetZone: currentZone } = alertPresentation(item, draft);
  const showZone = zone !== deviceZone() || item.repeatRule?.zoneMode === 'pinned', showAlertZone = changed && currentZone !== zone;
  const summary = detailSchedulePresentation(item, undefined, hasPublication);
  const rows = occurrence ? [
    summary.showEvent && <InformationRow key="when" icon="event" label={t('m_1d7fc661c9ce')} value={eventRange(item)} />,
    summary.showDue && <InformationRow key="due" icon="schedule" label={t('m_9071738f1459')} value={scheduleDateTime(item.dueAtMs, zone)} supporting={item.dueLinked === false ? t('m_54b61e4a03c4') : undefined} />,
    ...Children.toArray(children),
  ].filter(Boolean) : [
    <InformationRow key="when" icon="event" label={t('m_cf9c7aa24a26')} value={eventRange(item)} supporting={ordinaryDue(item) ? item.allDay ? t('m_35760eef25b2') : t('m_2062b803053d') : undefined} />,
    !ordinaryDue(item) && <InformationRow key="due" icon="schedule" label={t('m_9071738f1459')} value={scheduleDateTime(item.dueAtMs, zone)} supporting={item.dueLinked === false ? t('m_ac91aec2f1dc') : undefined} />,
    <InformationRow key="mode" icon={item.mode === 'None' ? 'alarm_off' : item.mode === 'Notification' ? 'notifications' : 'alarm'} label={t('m_9f9e808feb4c')} value={modeLabel(item.mode)} />,
    item.mode !== 'None' && <InformationRow key="alert" icon="schedule" label={t('m_ac9a908af109')} value={alert} supporting={changed ? t('m_c4662e6f0c7b') + scheduleDateTime(item.alarmAtMs, zone) + t('m_69127b5352fa') : item.alarmLinked === false ? t('m_d11be71c0a11') : undefined} />,
    ...Children.toArray(children),
  ];
  const support = <>
    {showZone && <ZoneSummary zoneId={zone} atMs={item.eventStartMs} />}
    {showAlertZone && <ZoneSummary zoneId={currentZone} atMs={current!} prefix={t('m_d05811a2fdbe')} />}
    {details && <ScheduleDetails item={item} draft={draft} occurrence={occurrence} hasPublication={hasPublication} />}
  </>;
  if (!rows.length) return showZone || showAlertZone ? <View style={{ paddingHorizontal: 16 }}>{support}</View> : null;
  return connected ? <ConnectedGroup title={t('m_f4830a1dae29')} footer={showZone || showAlertZone || details && scheduleNeedsDetails(item) ? support : undefined}>{rows}</ConnectedGroup> :
    <Group title={t('m_f4830a1dae29')}>{rows}<View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>{support}</View></Group>;
}

export function ScheduleDetails({ item, draft = false, occurrence = false, hasPublication = false }: { item: ScheduleItem; draft?: boolean; occurrence?: boolean; hasPublication?: boolean }) {
  'use no memo';
  const t = useTranslation();
  const { alertPresentation, detailSchedulePresentation, eventRange, formatTime, scheduleDateTime } = useTimeFormatting();
  const zone = item.zoneId || deviceZone(), mode = modeLabel(item.mode);
  const { changed } = alertPresentation(item, draft);
  const summary = detailSchedulePresentation(item, undefined, hasPublication);
  return occurrence || scheduleNeedsDetails(item) ? <Disclosure title={t('m_cd3b1cbbbae9')} icon="info">
      {occurrence && !summary.showEvent && <Copy size={typography.supporting}>{t('m_5b54d3a975a0')}{eventRange(item)}</Copy>}
      {occurrence && ordinaryDue(item) && <Copy size={typography.supporting}>{item.allDay ? t('m_d53a413c4b3d') : t('m_5931a76d3f72')}</Copy>}
      {!ordinaryDue(item) && <Copy size={typography.supporting}>{t('m_e2c5f1346634')}{formatTime(item.dueAtMs, zone)} · {item.dueLinked === false ? t('m_ac91aec2f1dc') : t('m_e4f9cd024d2a')}</Copy>}
      {item.mode !== 'None' && item.alarmLinked === false && <Copy size={typography.supporting}>{mode} · {formatTime(item.alarmAtMs, zone)} {t('m_6336068c5001')}</Copy>}
      {occurrence && item.mode !== 'None' && item.alarmLinked !== false && <Copy size={typography.supporting}>{item.allDay ? mode + t('m_778f9ac84ad7') : item.alarmAtMs === item.dueAtMs ? mode + t('m_5be8b201f432') : mode + t('m_9cf9159b91c4')}</Copy>}
      {item.exception && <Copy size={typography.supporting}>{t('m_fb91f46d73d7')}</Copy>}
      {(zone !== deviceZone() || item.repeatRule?.zoneMode === 'pinned') && <>
        <ZoneSummary zoneId={zone} atMs={item.eventStartMs} prefix={t('m_94dfde1d9df6')} />
        <Copy muted size={typography.label}>{zone}</Copy>
      </>}
      {(changed || occurrence && item.mode !== 'None' && !item.completed && !item.deleted && !item.skipped && summary.target !== item.alarmAtMs) && <><Copy size={typography.supporting}>{t('m_88d759ea02ce')}{mode.toLowerCase()} · {scheduleDateTime(item.alarmAtMs, zone)}</Copy><Copy muted size={typography.supporting}>{t('m_b430ca266a8a')}</Copy></>}
    </Disclosure> : null;
}
