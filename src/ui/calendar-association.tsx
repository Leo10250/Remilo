import { useTranslation } from '../localization/react';

import { router, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import type { CalendarLink, CalendarLinkedOperation, CalendarPublication, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { OriginParams } from '../domain/navigation';
import { calendarCancellation, calendarReviewReason, calendarRowNotice, calendarSummary } from '../domain/calendar-presentation';
import { calendarDispositionLabel } from '../domain/calendar-managed';
import { engine, nativeAvailable } from './native';
import { Button, ConnectedGroup, Copy, SettingRow } from './components';
import { useTimeFormatting } from './time-display';

export function useCalendarAssociation(ids: readonly string[], enabled = true) {
  const links = useQuery({ queryKey: ['calendar', 'links'], queryFn: () => engine().getCalendarLinks(), enabled: nativeAvailable && enabled });
  const publications = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(), enabled: nativeAvailable && enabled });
  return (links.data || []).some(link => ids.includes(link.occurrenceId)) || (publications.data || []).some(pub => ids.includes(pub.occurrenceId));
}
export function CalendarSummaryRow({ id, link, publication, jobs, origin, disabled = false }: { id: string; link?: CalendarLink; publication?: CalendarPublication; jobs: CalendarLinkedOperation[]; origin: OriginParams; disabled?: boolean }) {
  'use no memo';
  const t = useTranslation();
  const { scheduleDateTime } = useTimeFormatting();
  const disposition = useQuery({ queryKey: ['calendar', 'disposition', id], queryFn: () => engine().getCalendarReminderDisposition(id), enabled: nativeAvailable });
  if (!link && !publication && !jobs.length && !disposition.data) return null;
  const summary = (!link || link.state === 'Detached') && disposition.data ? calendarDispositionLabel(disposition.data) : calendarSummary(link, publication, jobs);
  return <ConnectedGroup><SettingRow icon="event" label={t('m_b074310e911f')} disabled={disabled}
    description={summary + (link?.successfulAtMs != null ? t('m_00fe18e6060b') + scheduleDateTime(link.successfulAtMs) : '')}
    onPress={() => router.push({ pathname: '/calendar-manage', params: { id: link?.occurrenceId ?? id, ...origin, originReminderId: id } } as Href)} /></ConnectedGroup>;
}
export function CalendarExceptionNotice({ item, link, jobs, onTrash, onManage, disabled }: { item: Occurrence; link?: CalendarLink; jobs: CalendarLinkedOperation[]; onTrash: () => void; onManage: () => void; disabled: boolean }) {
  'use no memo';
  const t = useTranslation();
  const { detailSchedulePresentation } = useTimeFormatting();
  const cancellation = calendarCancellation(item, link);
  const partial = !item.completed && !item.deleted && !item.skipped && jobs.some(job => job.localApplied && job.state === 'Unconfirmed');
  const review = !item.completed && !item.deleted && !item.skipped && ['Review', 'Paused', 'Unconfirmed'].includes(link?.syncStatus ?? '');
  if (!cancellation && !partial && !review) return null;
  const time = detailSchedulePresentation(item);
  return <ConnectedGroup><View key="notice" style={{ padding: 16, gap: 12 }}><Copy heading>{cancellation?.detail || calendarRowNotice(link) || t('m_1b35b915d7c0')}</Copy>
    {review && <Copy muted>{calendarReviewReason(link?.pauseReason)}</Copy>}
    {item.mode !== 'None' && <Copy muted>{item.deliveryState === 'Alerting' ? t('m_1ce1890d9f80') : time.label + ': ' + time.value + (time.supporting ? ' · ' + time.supporting : '')}</Copy>}
    {cancellation && <Button label={t('m_ca953e3b7639')} icon="delete" variant="secondary" disabled={disabled} onPress={onTrash} />}
    <Button label={review ? t('m_9e636d2d17ec') : t('m_53826bd0b89a')} variant={review ? 'primary' : 'secondary'} disabled={disabled} onPress={onManage} />
  </View></ConnectedGroup>;
}
