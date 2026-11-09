import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import type {
  CalendarCommand,
  CalendarLinkedOperation,
  CalendarSelections,
} from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { iosManualCalendarError } from '../domain/calendar';
import {
  calendarCaptureRejected,
  isManualCalendarOperation,
  manualCalendarNeedsWrite,
  resolvedCalendarFields,
} from '../domain/calendar-link';
import { calendarSummary, currentCalendarOperations } from '../domain/calendar-presentation';
import { secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { useLocalizedState, useTranslation } from '../localization/react';
import { CalendarOperationStatus, isUnconfirmedManualCalendarSend } from './calendar-linked';
import { useCalendarLinks, useIOSCalendarLinkCandidate } from './calendar-links';
import {
  calendarAuthorizationError,
  calendarReadAccess,
  rememberCalendarConnection,
} from './calendar-local-import';
import { CalendarResolutionFields } from './calendar-resolution-fields';
import { useCalendarAction } from './calendar-sync';
import {
  ActionFeedback,
  ActionPair,
  BottomActionBar,
  Button,
  ConnectedGroup,
  Copy,
  Page,
  QueryState,
  ReadOnlyRow,
} from './components';
import { useAppearanceConfirmation } from './confirmation';
import { engine } from './native';
import { useAppearanceHold } from './theme';
import { useTimeFormatting } from './time-display';

export function IOSCalendarManualLink({
  id,
  origin,
  review = false,
}: {
  id: string;
  origin: OriginParams;
  review?: boolean;
}) {
  'use no memo';
  const t = useTranslation();
  const client = useQueryClient();
  const confirm = useAppearanceConfirmation();
  const { scheduleDateTime } = useTimeFormatting();
  const { manual, current, connection, links } = useCalendarLinks();
  const candidate = useIOSCalendarLinkCandidate(id, current);
  const revision = current?.revision;
  const ready = calendarReadAccess(current);
  const link = links.data?.find((entry) => entry.occurrenceId === id);
  const linked = !!link && link.state !== 'Detached';
  const jobs = useQuery({
    queryKey: ['calendar', 'operations', revision],
    queryFn: () => engine().getCalendarOperations(revision!),
    enabled: manual && !!current?.connected,
  });
  const manualJobs = !jobs.error
    ? (jobs.data ?? []).filter((job) => job.occurrenceId === id && isManualCalendarOperation(job))
    : [];
  const pending = currentCalendarOperations(manualJobs);
  const { reviewSentId, reviewSentRevision } = useLocalSearchParams<{
    reviewSentId?: string;
    reviewSentRevision?: string;
  }>();
  const [freshReview, setFreshReview] = useState<{ id: string; revision: number } | undefined>(
    () =>
      review && typeof reviewSentId === 'string' && typeof reviewSentRevision === 'string'
        ? { id: reviewSentId.toLowerCase(), revision: Number(reviewSentRevision) }
        : undefined,
  );
  const fresh = freshReview?.revision === revision ? freshReview : undefined;
  const requestedPreview = useRef<typeof fresh>(undefined);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    revision: number;
    job: CalendarLinkedOperation;
  }>();
  const [captured, setCaptured] = useState<CalendarCommand>();
  const [choices, setChoices] = useState<{ previewId: string; selections: CalendarSelections }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useLocalizedState('');
  const running = useRef(false);
  const unlink = useCalendarAction();
  const shown = review
    ? (manualJobs.find((job) => job.operationId.toLowerCase() === operationId) ??
      (lastResult?.revision === revision ? lastResult?.job : undefined) ??
      manualJobs.find((job) => job.operationId.toLowerCase() === fresh?.id) ??
      pending[0])
    : undefined;
  const canReview = ready && candidate.eligible && links.isSuccess && jobs.isSuccess;
  const canReadFresh =
    !!shown &&
    shown.operationId.toLowerCase() === fresh?.id &&
    isUnconfirmedManualCalendarSend(shown);
  const retryFreshCapture =
    !!fresh &&
    !!captured &&
    shown?.operationId.toLowerCase() !== captured.operationId.toLowerCase();
  const preview = useQuery({
    queryKey: [
      'calendar',
      'manual-review',
      id,
      revision,
      fresh ? ['sent', fresh.id] : link?.revision,
      previewVersion,
    ],
    queryFn: () =>
      linked
        ? engine().previewCalendarUpdate(id, revision!, fresh?.id)
        : engine().previewCalendarLink(id, revision!, fresh?.id),
    enabled: review && canReview && !shown && !fresh,
    retry: fresh ? false : undefined,
    // A preview stays fixed while the user chooses values. Refresh explicitly or on a new scope.
    staleTime: 'static',
    gcTime: 0,
  });
  const refetchPreview = preview.refetch;
  useEffect(() => {
    if (!canReview || !canReadFresh || !fresh || requestedPreview.current === fresh) return;
    requestedPreview.current = fresh;
    void refetchPreview();
  }, [canReview, canReadFresh, fresh, refetchPreview]);
  const reviewed =
    canReview && !preview.error && preview.data?.connectionRevision === revision
      ? preview.data
      : undefined;
  const selections =
    choices?.previewId === reviewed?.previewId && choices
      ? choices.selections
      : (reviewed?.selections ?? { title: null, notes: null, schedule: null });
  const resolved = reviewed?.local
    ? resolvedCalendarFields(reviewed.local, reviewed.remote, selections)
    : null;
  const needsWrite =
    !!reviewed &&
    !!resolved &&
    manualCalendarNeedsWrite(resolved, reviewed.remote) &&
    current?.canWriteOwnedEvents !== true;
  const block = selections.schedule === 'google' ? reviewed?.manualScheduleBlocked : null;
  const blockedMessage =
    block === 'ELAPSED_ALERT'
      ? t('m_8d7bb691765b')
      : block
        ? iosManualCalendarError({ code: block })
        : undefined;
  const back = () =>
    router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin));
  const openSettings = () =>
    router.push({ pathname: '/calendar', params: { ...origin, originReminderId: id } });
  const openReview = (sent?: CalendarLinkedOperation) =>
    router.push({
      pathname: '/calendar-review',
      params: {
        ...origin,
        id,
        originReminderId: id,
        ...(sent && revision !== undefined
          ? { reviewSentId: sent.operationId, reviewSentRevision: String(revision) }
          : {}),
      },
    });
  const working = busy || unlink.busy;
  useAppearanceHold(working || unlink.unknown);
  usePreventRemove(working || unlink.unknown, () =>
    confirm(t('m_0c849c393ca3'), t('m_e71fd74c140f')),
  );

  const run = async (action: () => Promise<void>, authorization = false) => {
    if (running.current || unlink.busy) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(authorization ? calendarAuthorizationError(e) : iosManualCalendarError(e));
    } finally {
      await client.invalidateQueries();
      running.current = false;
      setBusy(false);
    }
  };
  const authorize = (write: boolean) => {
    if (revision === undefined || (write && captured)) return;
    void run(async () => {
      const next = await engine().authorizeCalendarFromUserAction!(
        revision,
        write ? 'authorizeOwnedCalendarWrites' : 'reauthorizeCurrentAccount',
      );
      await rememberCalendarConnection(client, next);
    }, true);
  };
  const apply = () => {
    if (!ready || revision === undefined || !reviewed || reviewed.connectionRevision !== revision)
      return;
    void run(async () => {
      const request: CalendarCommand = captured ?? {
        kind: linked ? 'ApplyCalendarResolution' : 'EnableCalendarLink',
        previewId: reviewed.previewId,
        operationId: engine().createOperationId(),
        expectedConnectionRevision: revision,
        selections,
        automaticSync: false,
      };
      setCaptured(request);
      setOperationId(request.operationId.toLowerCase());
      try {
        const result = await engine().applyCalendarCommand(request);
        if (
          !('localApplied' in result) ||
          result.operationId.toLowerCase() !== request.operationId.toLowerCase()
        )
          throw new Error('Unexpected Calendar link receipt');
        setLastResult({ revision, job: result });
        setCaptured(undefined);
      } catch (e) {
        if (calendarCaptureRejected(e)) {
          setCaptured(undefined);
          setOperationId(fresh?.id ?? null);
          setFreshReview(undefined);
        }
        throw e;
      }
    });
  };
  const reviewAgain = (job?: CalendarLinkedOperation) => {
    if (!canReview || working || preview.isFetching || captured || unlink.unknown) return;
    setLastResult(undefined);
    setOperationId(null);
    setError('');
    setFreshReview(
      revision !== undefined && job && isUnconfirmedManualCalendarSend(job)
        ? { id: job.operationId.toLowerCase(), revision }
        : undefined,
    );
    setPreviewVersion((version) => version + 1);
  };
  const confirmUnlink = () => {
    if (!linked || revision === undefined || working || unlink.unknown) return;
    confirm(
      t('m_b89208529acc'),
      t(
        pending.some((job) => job.remoteAttempted)
          ? 'unlink_reminder_confirmation_pending'
          : 'unlink_reminder_confirmation',
      ),
      [
        { text: t('m_19766ed6ccb2'), style: 'cancel' },
        {
          text: t('m_b90108da0bd2'),
          onPress: () =>
            void unlink.run({
              kind: 'UnlinkCalendar',
              operationId: engine().createOperationId(),
              occurrenceId: id,
              expectedLinkRevision: link.revision,
              expectedConnectionRevision: revision,
            }),
        },
      ],
    );
  };
  const title = review ? t(linked ? 'm_9e636d2d17ec' : 'm_45f738fd2ff1') : t('m_b074310e911f');
  const previewError = !fresh || canReadFresh ? preview.error : null;
  const problem = connection.error || links.error || jobs.error || candidate.error || previewError;
  const loading =
    connection.isLoading ||
    links.isLoading ||
    jobs.isLoading ||
    candidate.loading ||
    preview.isLoading;
  const reviewForm = review && (!shown || canReadFresh || retryFreshCapture) && reviewed?.local;
  const retryUnknown = !!captured && (!shown || retryFreshCapture);
  const statusJobs = review
    ? shown && !reviewForm
      ? [shown]
      : []
    : pending.length
      ? pending
      : manualJobs.slice(0, 1);

  return (
    <Page
      compact={review}
      sectionSpacing
      title={title}
      onBack={back}
      footer={
        reviewForm && (
          <BottomActionBar>
            <ActionPair>
              <Button
                label={t(
                  retryUnknown
                    ? 'm_16003a1a9190'
                    : needsWrite
                      ? 'ios_calendar_manual_allow_write'
                      : 'm_71e50031d9c2',
                )}
                disabled={
                  working ||
                  !ready ||
                  (!retryUnknown && (!resolved?.title.trim() || !!blockedMessage))
                }
                onPress={needsWrite && !retryUnknown ? () => authorize(true) : apply}
              />
              {!retryUnknown && (
                <Button
                  label={t('m_19766ed6ccb2')}
                  variant="secondary"
                  disabled={working}
                  onPress={back}
                />
              )}
            </ActionPair>
          </BottomActionBar>
        )
      }
    >
      <QueryState loading={loading} />
      {busy && <ActionFeedback loading message={t('m_5474eef8d0f1')} />}
      {!manual && <Copy muted>{t('ios_calendar_unavailable')}</Copy>}
      {manual && !loading && !current?.connected && !connection.error && (
        <Button label={t('m_3b9b76bc9d82')} variant="secondary" onPress={openSettings} />
      )}
      {manual &&
        current?.connected &&
        !ready &&
        (!shown || shown.recoveryMode === 'ReviewAgain') &&
        !pending.length && (
          <Button
            label={t('m_b724411569e0')}
            variant="secondary"
            disabled={working}
            onPress={() => authorize(false)}
          />
        )}
      {!!(error || unlink.error || problem) && (
        <ActionFeedback
          tone="warning"
          message={error || unlink.error || iosManualCalendarError(problem)}
        />
      )}
      {manual &&
        !loading &&
        ready &&
        !candidate.eligible &&
        (review || !link) &&
        !problem &&
        !shown && <Copy muted>{t('ios_calendar_manual_unavailable')}</Copy>}
      {!review && link && (
        <ConnectedGroup title={t('m_0e570ca6fabe')}>
          <ReadOnlyRow
            key="status"
            label={t('m_b074310e911f')}
            value={calendarSummary(link, undefined, pending)}
          />
          <ReadOnlyRow key="calendar" label={t('m_d5d0a30b517e')} value={link.calendarName} />
          <ReadOnlyRow key="account" label={t('m_7da2bcb6bb6b')} value={link.accountEmail} />
          {link.checkedAtMs !== null && (
            <ReadOnlyRow
              key="checked"
              label={t('m_0efd92a33590')}
              value={scheduleDateTime(link.checkedAtMs)}
            />
          )}
        </ConnectedGroup>
      )}
      {(!review || reviewForm) && manual && (
        <Copy muted>{t('ios_calendar_manual_link_detail')}</Copy>
      )}
      {!review && candidate.eligible && !pending.length && (
        <Button
          label={t(linked ? 'm_6a47708f4e14' : link ? 'm_1b01ea836cde' : 'm_45f738fd2ff1')}
          variant="secondary"
          disabled={working || unlink.unknown}
          onPress={() => openReview()}
        />
      )}
      {!review && (linked || unlink.unknown) && (
        <Button
          label={t(unlink.unknown ? 'm_3a8c6f6adf3a' : 'm_d9203b69027f')}
          variant="outlined"
          icon="link_off"
          disabled={working}
          onPress={unlink.unknown ? () => void unlink.retry() : confirmUnlink}
        />
      )}
      {current &&
        statusJobs.map((job) => (
          <CalendarOperationStatus
            key={job.operationId}
            operation={job}
            iosConnection={current}
            onReviewAgain={
              canReview && !working && !preview.isFetching && !captured && !unlink.unknown
                ? () =>
                    review
                      ? reviewAgain(job)
                      : openReview(isUnconfirmedManualCalendarSend(job) ? job : undefined)
                : undefined
            }
          />
        ))}
      {reviewForm && reviewed && (
        <>
          <Copy muted>{t('m_c672ed8175e2')}</Copy>
          <ConnectedGroup title={t('m_0e570ca6fabe')}>
            <ReadOnlyRow key="calendar" label={t('m_d5d0a30b517e')} value={reviewed.calendarName} />
            <ReadOnlyRow key="account" label={t('m_7da2bcb6bb6b')} value={reviewed.email} />
            <ReadOnlyRow
              key="checked"
              label={t('m_0efd92a33590')}
              value={scheduleDateTime(reviewed.checkedAtMs)}
            />
          </ConnectedGroup>
          <CalendarResolutionFields
            preview={reviewed}
            selections={selections}
            disabled={working || retryUnknown}
            blockedMessage={blockedMessage}
            onSelect={(field, side) =>
              setChoices((old) => ({
                previewId: reviewed.previewId,
                selections: {
                  ...(old?.previewId === reviewed.previewId ? old.selections : selections),
                  [field]: side,
                },
              }))
            }
          />
          {needsWrite && !retryUnknown && (
            <Copy muted>{t('ios_calendar_manual_allow_write_detail')}</Copy>
          )}
          {!retryUnknown && (
            <Button
              label={t('m_962d33506a8f')}
              variant="secondary"
              disabled={working}
              onPress={() => reviewAgain(shown)}
            />
          )}
        </>
      )}
      {review && !reviewForm && !shown && !loading && canReview && (
        <Button
          label={t('m_962d33506a8f')}
          variant="secondary"
          disabled={working}
          onPress={() => reviewAgain()}
        />
      )}
      {problem && !previewError && (
        <Button
          label={t('m_942087cc2d41')}
          variant="secondary"
          onPress={() => void client.invalidateQueries({ queryKey: ['calendar'] })}
        />
      )}
    </Page>
  );
}
