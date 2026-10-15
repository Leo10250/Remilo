import { useLocalizedState, useTranslation } from '../localization/react';

import { useTimeFormatting } from '../ui/time-display';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { CalendarCommand } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { publicationCommand, calendarError } from '../domain/calendar';
import { ActionFeedback, BottomActionBar, Button, ConnectedGroup, Copy, Page, QueryState } from '../ui/components';
import { civilAt } from '../domain/time';
import { engine, nativeAvailable } from '../ui/native';
import { CalendarPublicationStatus } from '../ui/calendar-publication';
import { useAppearanceHold } from '../ui/theme';

export default function CalendarPublish() {
  'use no memo';
  const t = useTranslation();
  const { scheduleDateTime } = useTimeFormatting();
  const params = useLocalSearchParams<OriginParams & { id: string }>(), routeParams = retainedOriginParams(params), id = params.id;
  const client = useQueryClient();
  const jobs = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(), enabled: nativeAvailable });
  const publication = jobs.data?.find((value) => value.occurrenceId === id && value.state !== 'Cancelled');
  const preview = useQuery({ queryKey: ['calendar', 'preview', id], queryFn: () => engine().previewCalendarPublication(id), enabled: nativeAvailable && !!jobs.data && !publication });
  const [busy, setBusy] = useState(false), [error, setError] = useLocalizedState(''), [uncertain, setUncertain] = useState(false);
  const captured = useRef<CalendarCommand | null>(null);
  useAppearanceHold(busy || uncertain && !publication);
  const back = () => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(routeParams));
  const publish = async () => {
    if (busy || !preview.data && !captured.current) return;
    captured.current ??= publicationCommand(preview.data!, engine().createOperationId());
    setBusy(true); setError('');
    try { await engine().applyCalendarCommand(captured.current); captured.current = null; setUncertain(false); }
    catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      const rejected = ['STALE_PREVIEW', 'INELIGIBLE', 'NOT_FOUND', 'ALREADY_PUBLISHED', 'INVALID_INPUT', 'OPERATION_REUSED', 'NEEDS_CONNECTION'].some((value) => code.includes(value));
      if (rejected) { captured.current = null; setUncertain(false); } else setUncertain(true);
      setError(calendarError(error));
    } finally { await client.invalidateQueries({ queryKey: ['calendar'] }); setBusy(false); }
  };
  return <Page title={publication ? t('m_6f6b42de13f4') : t('m_3a4c8285963f')} onBack={back}
    footer={!publication && preview.data ? <BottomActionBar><Button label={uncertain ? t('m_f122e37c423b') : t('m_859390eb495b')} disabled={busy} onPress={() => void publish()} />
      <Button label={t('m_19766ed6ccb2')} variant="secondary" disabled={busy || uncertain} onPress={back} /></BottomActionBar> : undefined}>
    <QueryState loading={jobs.isLoading || preview.isLoading && !preview.data} />
    {(jobs.error || !publication && preview.error) && <View style={{ gap: 8 }}>
      <ActionFeedback message={jobs.error ? t('m_17d37810740a') : calendarError(preview.error)} tone="warning" />
      <Button label={t('m_942087cc2d41')} variant="secondary" onPress={() => void client.invalidateQueries({ queryKey: ['calendar'] })} />
    </View>}
    {publication ? <CalendarPublicationStatus publication={publication} routeParams={routeParams} /> : preview.data && <>
      <ConnectedGroup title={t('m_7ed9b82a767f')}><View key="review" style={{ padding: 16, gap: 12 }}>
        <Copy heading>{preview.data.title}</Copy><Copy>{preview.data.notes || t('m_efe1cde67784')}</Copy>
        <Copy>{preview.data.allDay ? t('m_415306057afe', { arg0: String(civilAt(preview.data.eventStartMs, preview.data.zoneId).slice(0, 10)), arg1: String(civilAt(preview.data.eventEndMs, preview.data.zoneId).slice(0, 10)) }) : `${scheduleDateTime(preview.data.eventStartMs, preview.data.zoneId)} – ${scheduleDateTime(preview.data.eventEndMs, preview.data.zoneId)}`}</Copy>
        <Copy muted>{preview.data.allDay ? t('m_7d93cadaf7ad') : ''}{preview.data.zoneId}</Copy>
        {!!preview.data.recurrence?.length && <Copy>{t('m_0158ffecbd50')}</Copy>}
        <Copy>{preview.data.calendarName} · {preview.data.email}</Copy>
      </View></ConnectedGroup>
      <Copy muted>{t('m_d8811e01b3a3')}</Copy>
      {preview.data.pinsZone && <Copy muted>{t('m_dd83acb79e4a')}{preview.data.zoneId} {t('m_e497b292f139')}</Copy>}
    </>}
    {!!error && !publication && <ActionFeedback message={error} tone="warning" />}
    {uncertain && !publication && <Copy muted>{t('m_558aba6db20a')}</Copy>}
    {busy && !publication && <ActionFeedback loading message={t('m_688e2f9b65c7')} />}
    {!publication && !preview.data && <Button label={t('m_3b9b76bc9d82')} variant="secondary" onPress={() => router.push({ pathname: '/calendar', params: { ...routeParams, originReminderId: id } })} />}
  </Page>;
}
