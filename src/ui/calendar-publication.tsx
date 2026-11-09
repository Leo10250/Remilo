import { useLocalizedState, useTranslation } from '../localization/react';

import { Linking, View } from 'react-native';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CalendarConnection,
  CalendarPublication,
} from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import {
  calendarError,
  canRetryPublication,
  iosPublicationRetryAction,
  publicationCheckFeedback,
} from '../domain/calendar';
import type { OriginParams } from '../domain/navigation';
import { useCalendarAction, useCalendarAuthorization } from './calendar-sync';
import { useCalendarLinks, useIOSCalendarLinkCandidate } from './calendar-links';
import { calendarAuthorizationError, rememberCalendarConnection } from './calendar-local-import';
import { ActionFeedback, Button, ConnectedGroup, Copy, Status } from './components';
import { engine, iosReminders, nativeAvailable, useIOSCalendarPublish } from './native';
import { useAppearanceHold } from './theme';
import { router, type Href } from 'expo-router';

export function useCalendarPublications(enabled = true) {
  const iosPublish = useIOSCalendarPublish();
  const available = nativeAvailable && (!iosReminders || iosPublish);
  const connection = useQuery({
    queryKey: ['calendar', 'connection'],
    queryFn: () => engine().getCalendarConnection(),
    enabled: enabled && iosPublish,
  });
  const current = connection.error ? undefined : connection.data;
  const revision = current?.revision;
  const publications = useQuery({
    queryKey: iosReminders ? ['calendar', 'publications', revision] : ['calendar', 'publications'],
    queryFn: () =>
      iosReminders
        ? engine().getCalendarPublications(revision!)
        : engine().getCalendarPublications(),
    enabled: enabled && available && (!iosReminders || revision !== undefined),
  });
  return { available, connection, current, publications };
}

export function CalendarPublicationStatus({
  publication,
  routeParams = {},
  iosConnection,
  onReviewAgain,
}: {
  publication: CalendarPublication;
  routeParams?: OriginParams;
  iosConnection?: CalendarConnection;
  onReviewAgain?: () => void;
}) {
  'use no memo';
  const t = useTranslation();
  const reviewPublished =
    !!iosConnection && publication.state === 'Published' && !publication.readOnly;
  const { links } = useCalendarLinks(reviewPublished);
  const manualCandidate = useIOSCalendarLinkCandidate(
    publication.occurrenceId,
    iosConnection,
    reviewPublished,
  );
  const manualLink = links.data?.find((link) => link.occurrenceId === publication.occurrenceId);
  const action = useCalendarAction(),
    auth = useCalendarAuthorization(),
    [error, setError] = useLocalizedState('');
  const client = useQueryClient();
  const iosRunning = useRef(false);
  const [iosBusy, setIOSBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const busy = iosBusy || action.busy || auth.waiting || publication.state === 'Publishing';
  const result = publicationCheckFeedback(publication);
  const check = publication.retryMode === 'check';
  const needsAccess = publication.state === 'NeedsAccess';
  const iosRetry = iosConnection ? iosPublicationRetryAction(publication) : null;
  const retryable = iosConnection ? iosRetry !== null : canRetryPublication(publication);
  const legacyDetail = publication.readOnly
    ? 'publication_inactive_context'
    : publication.state === 'Unconfirmed'
      ? 'm_b8bc02aeb328'
      : needsAccess
        ? 'm_33112f933562'
        : publication.state === 'Cancelled'
          ? 'm_4c84897d5791'
          : 'm_9476f8cd6b94';
  const detail =
    iosConnection && publication.state === 'Cancelled'
      ? 'publication_checked_cancelled'
      : iosRetry === 'reauthorizeCheck'
        ? 'ios_calendar_publish_readback_access'
        : iosConnection && publication.canCancel && iosRetry !== 'send'
          ? 'ios_calendar_publish_waiting_access'
          : legacyDetail;
  useAppearanceHold(busy);

  const runIOS = async (kind: 'RetryPublication' | 'CancelPublication') => {
    if (!iosConnection || iosRunning.current || busy) return;
    if (kind === 'RetryPublication' ? !iosRetry : !publication.canCancel) return;
    iosRunning.current = true;
    setIOSBusy(true);
    setError('');
    setChecked(false);
    try {
      let revision = iosConnection.revision;
      if (kind === 'RetryPublication' && iosRetry === 'reauthorizeCheck') {
        const next = await engine().authorizeCalendarFromUserAction!(
          revision,
          'reauthorizeCurrentAccount',
        );
        await rememberCalendarConnection(client, next);
        revision = next.revision;
      }
      await engine().applyCalendarCommand({
        kind,
        operationId: publication.operationId,
        expectedConnectionRevision: revision,
      });
      setChecked(kind === 'RetryPublication' && check);
    } catch (e) {
      setError(needsAccess && check ? calendarAuthorizationError(e) : calendarError(e));
    } finally {
      await client.invalidateQueries({ queryKey: ['calendar'] });
      iosRunning.current = false;
      setIOSBusy(false);
    }
  };
  const retry = async () => {
    if (busy) return;
    if (iosConnection) return runIOS('RetryPublication');
    setError('');
    setChecked(false);
    if (publication.state === 'NeedsAccess') await auth.start(publication.operationId);
    else
      setChecked(
        await action.run({ kind: 'RetryPublication', operationId: publication.operationId }),
      );
  };
  return (
    <ConnectedGroup title={t('m_b074310e911f')}>
      <View key="publication" style={{ padding: 16, gap: 12 }}>
        <Status
          tone={
            ['Failed', 'NeedsAccess'].includes(publication.state)
              ? 'danger'
              : ['Conflict', 'Unconfirmed'].includes(publication.state)
                ? 'warning'
                : publication.state === 'Published'
                  ? 'success'
                  : 'muted'
          }
          label={
            {
              Waiting: t('m_6e54c2b65b4e'),
              Publishing: t('m_582e0f1abad4'),
              Unconfirmed: t('m_aefa0a239997'),
              NeedsAccess: t('m_2bac957cacfe'),
              Failed: t('m_ef4953108c87'),
              Conflict: t('m_b196ff9b8f1f'),
              Cancelled: t('m_67f02b0ad769'),
              Published: t('m_f24802b28eb5'),
            }[publication.state]
          }
        />
        <Copy muted>
          {publication.calendarName || t('m_42dc73b15d7e')}
          {publication.email ? ` · ${publication.email}` : ''}
        </Copy>
        {publication.state !== 'Published' && (
          <Copy muted size={14}>
            {t(detail)}
          </Copy>
        )}
        {(action.busy || iosBusy) && (
          <ActionFeedback
            loading
            message={t(!iosConnection || check ? 'publication_checking' : 'm_5474eef8d0f1')}
          />
        )}
        {checked && !busy && <ActionFeedback {...result} />}
        {publication.differs && publication.state === 'Published' && (
          <Copy muted>{t('m_45b7352f8d39')}</Copy>
        )}
        {!!(error || action.error) && (
          <ActionFeedback message={error || action.error} tone="warning" />
        )}
        {!!auth.message && (
          <ActionFeedback message={auth.message} tone={auth.tone} loading={auth.waiting} />
        )}
        {retryable && (
          <Button
            label={
              action.unknown
                ? t('m_16003a1a9190')
                : publication.state === 'NeedsAccess'
                  ? t('m_b724411569e0')
                  : check || publication.readOnly || publication.state === 'Unconfirmed'
                    ? t('m_793d9e63467a')
                    : t('m_c4ed88c3c345')
            }
            variant="secondary"
            disabled={busy}
            onPress={() => void retry()}
          />
        )}
        {iosConnection && publication.canCancel && (
          <Button
            label={t('ios_calendar_cancel_publication')}
            variant="secondary"
            disabled={busy}
            onPress={() => void runIOS('CancelPublication')}
          />
        )}
        {iosConnection && publication.canReviewAgain && onReviewAgain && (
          <Button
            label={t('m_d4ea61c79c9b')}
            variant="secondary"
            disabled={busy}
            onPress={onReviewAgain}
          />
        )}
        {publication.state === 'Published' && !!publication.htmlLink && (
          <Button
            label={t('m_8cdec4f3126a')}
            variant="secondary"
            onPress={() => {
              void Linking.openURL(publication.htmlLink).catch(() => setError(t('m_459ac1963e28')));
            }}
          />
        )}
        {!iosReminders && publication.state === 'Published' && !publication.readOnly && (
          <Button
            label={t('m_3790860f3348')}
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/calendar-review',
                params: { ...routeParams, id: publication.occurrenceId },
              } as Href)
            }
          />
        )}
        {manualCandidate.eligible && links.isSuccess && (
          <Button
            label={t(
              !manualLink
                ? 'm_45f738fd2ff1'
                : manualLink.state === 'Detached'
                  ? 'm_1b01ea836cde'
                  : 'm_6a47708f4e14',
            )}
            variant="secondary"
            disabled={busy}
            onPress={() =>
              router.push({
                pathname: '/calendar-review',
                params: {
                  ...routeParams,
                  id: publication.occurrenceId,
                  originReminderId: publication.occurrenceId,
                },
              })
            }
          />
        )}
      </View>
    </ConnectedGroup>
  );
}
