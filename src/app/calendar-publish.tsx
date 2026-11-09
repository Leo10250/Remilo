import { useLocalizedState, useTranslation } from '../localization/react';

import { useTimeFormatting } from '../ui/time-display';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type {
  CalendarCommand,
  CalendarPublicationPreview,
} from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import {
  retainedOriginParams,
  secondaryOriginRoute,
  type OriginParams,
} from '../domain/navigation';
import { publicationCommand, calendarError } from '../domain/calendar';
import {
  ActionPair,
  ActionFeedback,
  BottomActionBar,
  Button,
  ConnectedGroup,
  Copy,
  Page,
  QueryState,
  ReadOnlyRow,
} from '../ui/components';
import { civilAt } from '../domain/time';
import { engine, iosReminders } from '../ui/native';
import { CalendarPublicationStatus, useCalendarPublications } from '../ui/calendar-publication';
import {
  calendarAuthorizationError,
  calendarReadAccess,
  rememberCalendarConnection,
} from '../ui/calendar-local-import';
import { useAppearanceHold } from '../ui/theme';
import { useAppearanceConfirmation } from '../ui/confirmation';

export default function CalendarPublish() {
  'use no memo';
  const t = useTranslation();
  const { scheduleDateTime } = useTimeFormatting();
  const params = useLocalSearchParams<OriginParams & { id: string }>(),
    routeParams = retainedOriginParams(params),
    id = params.id;
  const client = useQueryClient();
  const confirm = useAppearanceConfirmation();
  const { available, current, connection, publications: jobs } = useCalendarPublications();
  const connectionError = iosReminders ? connection.error : null;
  const ready = !iosReminders || calendarReadAccess(current);
  const canWrite = !iosReminders || current?.canWriteOwnedEvents === true;
  const [reviewedOperation, setReviewedOperation] = useState<string | null>(null);
  const latest = jobs.data?.find(
    (value) =>
      value.occurrenceId === id &&
      (value.state !== 'Cancelled' || (iosReminders && value.canReviewAgain)),
  );
  const publication = latest?.operationId === reviewedOperation ? undefined : latest;
  const preview = useQuery({
    queryKey: iosReminders
      ? ['calendar', 'preview', id, current?.revision, reviewedOperation]
      : ['calendar', 'preview', id],
    queryFn: () =>
      iosReminders
        ? engine().previewCalendarPublication(id, current!.revision)
        : engine().previewCalendarPublication(id),
    enabled:
      available && !!jobs.data && !publication && ready && (!iosReminders || !!current?.calendarId),
  });
  const [work, setWork] = useState<'publish' | 'authorize' | null>(null),
    [error, setError] = useLocalizedState(''),
    [uncertain, setUncertain] = useState(false);
  const busy = work !== null;
  const [captured, setCaptured] = useState<{
    command: CalendarCommand;
    review: CalendarPublicationPreview;
  } | null>(null);
  const shown = iosReminders && uncertain ? captured?.review : preview.data;
  const reviewed =
    !iosReminders || (!preview.error && shown?.connectionRevision === current?.revision)
      ? shown
      : undefined;
  const running = useRef(false);
  useAppearanceHold(busy || (uncertain && !publication));
  usePreventRemove(iosReminders && busy, () => confirm(t('m_0c849c393ca3'), t('m_e71fd74c140f')));
  const back = () =>
    router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(routeParams));
  const publish = async () => {
    if (running.current || !ready || !canWrite || (!reviewed && !captured)) return;
    running.current = true;
    const request = captured ?? {
      command: publicationCommand(reviewed!, engine().createOperationId()),
      review: reviewed!,
    };
    setCaptured(request);
    setWork('publish');
    setError('');
    try {
      await engine().applyCalendarCommand(request.command);
      setCaptured(null);
      setUncertain(false);
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      const rejected = [
        'STALE_PREVIEW',
        'INELIGIBLE',
        'NOT_FOUND',
        'ALREADY_PUBLISHED',
        'INVALID_INPUT',
        'OPERATION_REUSED',
        'NEEDS_CONNECTION',
        ...(iosReminders ? ['STALE_CONNECTION', 'OPERATION_PENDING'] : []),
      ].some((value) => code.includes(value));
      if (rejected) {
        setCaptured(null);
        setUncertain(false);
      } else setUncertain(true);
      setError(calendarError(error));
    } finally {
      await client.invalidateQueries({ queryKey: ['calendar'] });
      running.current = false;
      setWork(null);
    }
  };
  const allowPublishing = async () => {
    if (!current || !reviewed || !ready || canWrite || running.current || uncertain) return;
    running.current = true;
    setWork('authorize');
    setError('');
    try {
      const next = await engine().authorizeCalendarFromUserAction!(
        current.revision,
        'authorizeOwnedCalendarWrites',
      );
      await rememberCalendarConnection(client, next);
    } catch (e) {
      setError(calendarAuthorizationError(e));
    } finally {
      await client.invalidateQueries({ queryKey: ['calendar'] });
      running.current = false;
      setWork(null);
    }
  };
  return (
    <Page
      sectionSpacing
      title={publication ? t('m_6f6b42de13f4') : t('m_3a4c8285963f')}
      onBack={back}
      footer={
        !publication && (reviewed || (uncertain && canWrite)) ? (
          <BottomActionBar>
            <ActionPair>
              <Button
                label={t(
                  uncertain
                    ? 'm_f122e37c423b'
                    : canWrite
                      ? 'm_859390eb495b'
                      : 'ios_calendar_allow_publish',
                )}
                disabled={busy || (uncertain && !canWrite)}
                onPress={() => void (canWrite ? publish() : allowPublishing())}
              />
              <Button
                label={t('m_19766ed6ccb2')}
                variant="secondary"
                disabled={busy || uncertain}
                onPress={back}
              />
            </ActionPair>
          </BottomActionBar>
        ) : undefined
      }
    >
      <QueryState
        loading={
          (iosReminders && connection.isLoading) ||
          jobs.isLoading ||
          (preview.isLoading && !preview.data)
        }
      />
      {iosReminders && !available && <ActionFeedback message={t('ios_calendar_unavailable')} />}
      {(connectionError || jobs.error || (!publication && preview.error)) && (
        <View style={{ gap: 8 }}>
          <ActionFeedback
            message={
              jobs.error ? t('m_17d37810740a') : calendarError(connectionError || preview.error)
            }
            tone="warning"
          />
          <Button
            label={t('m_942087cc2d41')}
            variant="secondary"
            onPress={() => void client.invalidateQueries({ queryKey: ['calendar'] })}
          />
        </View>
      )}
      {publication ? (
        <CalendarPublicationStatus
          key={publication.operationId}
          publication={publication}
          routeParams={routeParams}
          iosConnection={iosReminders ? current : undefined}
          onReviewAgain={() => {
            setCaptured(null);
            setUncertain(false);
            setError('');
            setReviewedOperation(publication.operationId);
          }}
        />
      ) : (
        reviewed && (
          <>
            <ConnectedGroup title={t('m_7ed9b82a767f')}>
              <View key="review" style={{ padding: 16, gap: 12 }}>
                <Copy heading>{reviewed.title}</Copy>
                <Copy>{reviewed.notes || t('m_efe1cde67784')}</Copy>
                <Copy>
                  {reviewed.allDay
                    ? t('m_415306057afe', {
                        arg0: String(civilAt(reviewed.eventStartMs, reviewed.zoneId).slice(0, 10)),
                        arg1: String(civilAt(reviewed.eventEndMs, reviewed.zoneId).slice(0, 10)),
                      })
                    : `${scheduleDateTime(reviewed.eventStartMs, reviewed.zoneId)} – ${scheduleDateTime(reviewed.eventEndMs, reviewed.zoneId)}`}
                </Copy>
                {reviewed.allDay && <Copy muted>{t('m_34233e542b7b')}</Copy>}
                {!!reviewed.recurrence?.length && <Copy>{t('m_0158ffecbd50')}</Copy>}
              </View>
              <ReadOnlyRow key="zone" label={t('m_b9fe1464783e')} value={reviewed.zoneId} />
              <ReadOnlyRow
                key="calendar"
                label={t('m_d5d0a30b517e')}
                value={reviewed.calendarName}
              />
              <ReadOnlyRow key="account" label={t('m_7da2bcb6bb6b')} value={reviewed.email} />
            </ConnectedGroup>
            <Copy muted>{t('m_d8811e01b3a3')}</Copy>
            {!canWrite && <Copy muted>{t('ios_calendar_allow_publish_detail')}</Copy>}
            {reviewed.pinsZone && (
              <Copy muted>{t('ui_calendar_pinned_zone', { zone: reviewed.zoneId })}</Copy>
            )}
          </>
        )
      )}
      {!!error && !publication && <ActionFeedback message={error} tone="warning" />}
      {uncertain && !publication && <Copy muted>{t('m_558aba6db20a')}</Copy>}
      {busy && !publication && (
        <ActionFeedback
          loading
          message={t(work === 'authorize' ? 'm_22c3fbbc38db' : 'm_688e2f9b65c7')}
        />
      )}
      {!publication &&
        !reviewed &&
        (!iosReminders || (available && (!ready || !current?.calendarId))) && (
          <Button
            label={t('m_3b9b76bc9d82')}
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/calendar',
                params: { ...routeParams, originReminderId: id },
              })
            }
          />
        )}
    </Page>
  );
}
