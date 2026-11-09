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
import { calendarCheckFailure, currentCalendarOperations } from '../domain/calendar-presentation';
import { calendarLinkStatus } from '../domain/calendar-ux';
import { secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { useLocalizedState, useTranslation } from '../localization/react';
import {
  CalendarOperationStatus,
  isAutomaticCalendarOperation,
  isUnconfirmedManualCalendarSend,
} from './calendar-linked';
import { useCalendarLinks, useIOSCalendarLinkCandidate } from './calendar-links';
import {
  calendarAuthorizationError,
  calendarReadAccess,
  rememberCalendarConnection,
} from './calendar-local-import';
import { CalendarResolutionFields } from './calendar-resolution-fields';
import { CalendarOperationProgress, useCalendarAction, useCalendarSync } from './calendar-sync';
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
import { engine, useIOSCalendarAutomaticLink } from './native';
import { useAppearanceHold } from './theme';
import { useTimeFormatting } from './time-display';

type LinkReviewCommand = Extract<
  CalendarCommand,
  {
    kind:
      | 'ImportCalendarEvent'
      | 'EnableCalendarLink'
      | 'ApplyCalendarResolution'
      | 'EnableAutomaticCalendarSync';
  }
> & { expectedConnectionRevision: number };

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
  const automatic = useIOSCalendarAutomaticLink();
  const candidate = useIOSCalendarLinkCandidate(id, current);
  const revision = current?.revision;
  const ready = calendarReadAccess(current);
  const link = links.data?.find((entry) => entry.occurrenceId === id);
  const linked = !!link && link.state !== 'Detached';
  const automaticConsent =
    automatic && linked && (link.syncMode === 'Automatic' || link.syncMode === 'Pending');
  const activationSource =
    automatic &&
    linked &&
    !link.readOnly &&
    !!link.source &&
    link.syncMode !== 'Pending' &&
    (link.availability === 'Available' || link.availability === 'Unknown');
  const canCheck = !review && ready && links.isSuccess && linked && !!link.source && !link.readOnly;
  const jobs = useQuery({
    queryKey: ['calendar', 'operations', revision],
    queryFn: () => engine().getCalendarOperations(revision!),
    enabled: manual && !!current?.connected,
  });
  const linkJobs = !jobs.error
    ? (jobs.data ?? []).filter(
        (job) =>
          job.occurrenceId === id &&
          (isManualCalendarOperation(job) || (automatic && isAutomaticCalendarOperation(job))),
      )
    : [];
  const pending = currentCalendarOperations(linkJobs);
  const { activateLink, reviewSentId, reviewSentRevision } = useLocalSearchParams<{
    activateLink?: string;
    reviewSentId?: string;
    reviewSentRevision?: string;
  }>();
  const activating = review && activateLink === 'true';
  const [freshReview, setFreshReview] = useState<{ id: string; revision: number } | undefined>(
    () =>
      review &&
      !activating &&
      typeof reviewSentId === 'string' &&
      typeof reviewSentRevision === 'string'
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
  const [captured, setCaptured] = useState<LinkReviewCommand>();
  const [choices, setChoices] = useState<{ previewId: string; selections: CalendarSelections }>();
  const [busy, setBusy] = useState<'change' | 'authorize' | 'check'>();
  const [error, setError] = useLocalizedState('');
  const [checkResult, setCheckResult] = useState<{
    connectionRevision: number;
    linkRevision: number;
    attemptedAtMs: number | null;
  }>();
  const running = useRef(false);
  const unlink = useCalendarAction();
  const disableAutomatic = useCalendarAction('disable-automatic');
  const syncScope =
    automatic && !review && link && revision !== undefined
      ? {
          connectionRevision: revision,
          linkRevision: link.revision,
          activationRevision: link.activationRevision ?? 0,
        }
      : undefined;
  const syncRequest = useCalendarSync(
    { kind: 'Association', occurrenceId: id },
    syncScope ? link?.syncRequestId : undefined,
    syncScope,
  );
  const shown = review
    ? (linkJobs.find((job) => job.operationId.toLowerCase() === operationId) ??
      (lastResult?.revision === revision ? lastResult?.job : undefined) ??
      linkJobs.find((job) => job.operationId.toLowerCase() === fresh?.id) ??
      pending[0])
    : undefined;
  const canReview = ready && candidate.eligible && links.isSuccess && jobs.isSuccess;
  const canLoadReview = canReview && (activating ? activationSource : !automaticConsent);
  const canReadFresh =
    !activating &&
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
      activating ? 'activation-review' : 'manual-review',
      id,
      revision,
      fresh ? ['sent', fresh.id] : link?.revision,
      previewVersion,
    ],
    queryFn: async () => {
      if (activating) {
        const activation = await engine().previewCalendarActivation(
          [id],
          revision!,
          link!.revision,
        );
        const next = activation.items.find((item) => item.occurrenceId === id)?.preview;
        if (!next?.activation || next.occurrenceId !== id || next.connectionRevision !== revision)
          throw Object.assign(new Error(), { code: 'STALE_PREVIEW' });
        return next;
      }
      return linked
        ? engine().previewCalendarUpdate(id, revision!, fresh?.id)
        : engine().previewCalendarLink(id, revision!, fresh?.id);
    },
    enabled: review && canLoadReview && !shown && !fresh && !captured,
    retry: activating || fresh ? false : undefined,
    // A preview stays fixed while the user chooses values. Refresh explicitly or on a new scope.
    staleTime: 'static',
    gcTime: 0,
  });
  const refetchPreview = preview.refetch;
  useEffect(() => {
    if (!canLoadReview || !canReadFresh || !fresh || requestedPreview.current === fresh) return;
    requestedPreview.current = fresh;
    void refetchPreview();
  }, [canLoadReview, canReadFresh, fresh, refetchPreview]);
  const reviewed =
    (canLoadReview || (activating && captured)) &&
    !preview.error &&
    preview.data?.connectionRevision === revision
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
    current?.canWriteOwnedEvents !== true &&
    (activating || (!!resolved && manualCalendarNeedsWrite(resolved, reviewed.remote)));
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
  const openReview = (activate = false, sent?: CalendarLinkedOperation) =>
    router.push({
      pathname: '/calendar-review',
      params: {
        ...origin,
        id,
        originReminderId: id,
        ...(activate ? { activateLink: 'true' } : {}),
        ...(!activate && sent && revision !== undefined
          ? { reviewSentId: sent.operationId, reviewSentRevision: String(revision) }
          : {}),
      },
    });
  const relationshipBusy = unlink.busy || disableAutomatic.busy;
  const relationshipUnknown = unlink.unknown || disableAutomatic.unknown;
  const actionUnknown = relationshipUnknown || syncRequest.unknown;
  const working = !!busy || relationshipBusy || syncRequest.busy;
  const guarded =
    busy === 'change' ||
    busy === 'authorize' ||
    relationshipBusy ||
    syncRequest.busy ||
    actionUnknown;
  useAppearanceHold(guarded);
  usePreventRemove(guarded, () => confirm(t('m_0c849c393ca3'), t('m_e71fd74c140f')));

  const run = async (action: () => Promise<void>, kind: typeof busy = 'change') => {
    if (running.current || relationshipBusy || syncRequest.busy || actionUnknown) return;
    running.current = true;
    setBusy(kind);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(kind === 'authorize' ? calendarAuthorizationError(e) : iosManualCalendarError(e));
    } finally {
      if (kind === 'check') {
        await Promise.all([
          client.invalidateQueries({ queryKey: ['calendar', 'connection'], exact: true }),
          client.invalidateQueries({ queryKey: ['calendar', 'links', revision], exact: true }),
          client.invalidateQueries({ queryKey: ['calendar', 'operations', revision], exact: true }),
        ]);
      } else await client.invalidateQueries();
      running.current = false;
      setBusy(undefined);
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
    }, 'authorize');
  };
  const check = () => {
    if (!canCheck || revision === undefined) return;
    void run(async () => {
      setCheckResult(undefined);
      const next = await engine().checkCalendarLink(id, revision, link.revision);
      setCheckResult({
        connectionRevision: revision,
        linkRevision: next.revision,
        attemptedAtMs: next.lastCheckAttemptAtMs,
      });
    }, 'check');
  };
  const apply = () => {
    const request: LinkReviewCommand | undefined =
      captured ??
      (canLoadReview &&
      reviewed &&
      revision !== undefined &&
      !needsWrite &&
      resolved?.title.trim() &&
      !blockedMessage
        ? {
            kind: activating
              ? 'EnableAutomaticCalendarSync'
              : linked
                ? 'ApplyCalendarResolution'
                : 'EnableCalendarLink',
            previewId: reviewed.previewId,
            operationId: engine().createOperationId(),
            expectedConnectionRevision: revision,
            selections,
            automaticSync: activating,
          }
        : undefined);
    if (!request) return;
    void run(async () => {
      setCaptured(request);
      setOperationId(request.operationId.toLowerCase());
      try {
        const result = await engine().applyCalendarCommand(request);
        if (
          !('localApplied' in result) ||
          result.operationId.toLowerCase() !== request.operationId.toLowerCase()
        )
          throw new Error('Unexpected Calendar link receipt');
        setLastResult({ revision: request.expectedConnectionRevision, job: result });
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
    if (!canLoadReview || working || preview.isFetching || captured || actionUnknown) return;
    setLastResult(undefined);
    setOperationId(null);
    setError('');
    setFreshReview(
      !activating && revision !== undefined && job && isUnconfirmedManualCalendarSend(job)
        ? { id: job.operationId.toLowerCase(), revision }
        : undefined,
    );
    setPreviewVersion((version) => version + 1);
  };
  const usesActivationReview = (job: CalendarLinkedOperation) =>
    automaticConsent || (automatic && isAutomaticCalendarOperation(job));
  const reviewJob = (job: CalendarLinkedOperation) => {
    const activate = usesActivationReview(job);
    if (review && activating === activate) reviewAgain(job);
    else openReview(activate, isUnconfirmedManualCalendarSend(job) ? job : undefined);
  };
  const confirmDisable = () => {
    if (!automaticConsent || revision === undefined || working || actionUnknown) return;
    confirm(t('ios_calendar_automatic_disable_title'), t('ios_calendar_automatic_disable_detail'), [
      { text: t('m_19766ed6ccb2'), style: 'cancel' },
      {
        text: t('ios_calendar_automatic_disable_action'),
        onPress: () =>
          void disableAutomatic.run({
            kind: 'DisableAutomaticCalendarSync',
            operationId: engine().createOperationId(),
            occurrenceId: id,
            expectedLinkRevision: link.revision,
            expectedConnectionRevision: revision,
          }),
      },
    ]);
  };
  const confirmUnlink = () => {
    if (!linked || revision === undefined || working || actionUnknown) return;
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
  const title = activating
    ? t('m_020858872d16')
    : review
      ? t(linked ? 'm_9e636d2d17ec' : 'm_45f738fd2ff1')
      : t('m_b074310e911f');
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
  const linkStatus = link ? calendarLinkStatus(link, pending) : null;
  const canTurnOn =
    activationSource && canReview && !pending.length && linkStatus?.action === 'Activate';
  const canStartSync =
    !!syncScope &&
    syncScope.activationRevision > 0 &&
    links.isSuccess &&
    jobs.isSuccess &&
    ready &&
    current?.canWriteOwnedEvents === true &&
    link?.syncMode === 'Automatic' &&
    link.state === 'Linked' &&
    activationSource &&
    !link.requiresReview &&
    (link.syncStatus === 'Confirmed' || link.syncStatus === 'UpdatePending') &&
    !pending.length &&
    !syncRequest.statusLoading &&
    !syncRequest.statusError &&
    !syncRequest.status?.pending;
  const showSyncResult =
    !!syncScope &&
    !!syncRequest.requestId &&
    (syncRequest.showResult || syncRequest.statusLoading || !!syncRequest.statusError);
  const syncJob = linkJobs.find(
    (job) => job.operationId.toLowerCase() === syncRequest.requestId?.toLowerCase(),
  );
  const syncAction = syncRequest.status?.action;
  const canUseSyncAction =
    !working &&
    !actionUnknown &&
    (syncAction === 'Retry' ||
      syncAction === 'Connect' ||
      syncAction === 'Authorize' ||
      (syncAction === 'ReviewItems' && activationSource));
  const observedAtMs = link?.observedAtMs ?? link?.checkedAtMs;
  const checkFeedback =
    !working &&
    links.isSuccess &&
    link &&
    !link.lastCheckErrorCode &&
    checkResult?.connectionRevision === revision &&
    checkResult?.linkRevision === link.revision &&
    checkResult?.attemptedAtMs === link.lastCheckAttemptAtMs
      ? t(
          link.availability !== 'Available' || link.requiresReview
            ? 'm_85913f35260d'
            : link.remoteDiffers || link.differs
              ? 'm_593d897121c1'
              : 'm_22064353be47',
        )
      : null;
  const statusJobs = review
    ? shown && !reviewForm
      ? [shown]
      : []
    : pending.length
      ? pending
      : linkJobs.slice(0, 1);

  return (
    <Page
      compact={review}
      sectionSpacing
      title={title}
      onBack={back}
      footer={
        (reviewForm || (activating && retryUnknown)) && (
          <BottomActionBar>
            <ActionPair>
              <Button
                label={t(
                  retryUnknown
                    ? 'm_16003a1a9190'
                    : needsWrite
                      ? 'ios_calendar_manual_allow_write'
                      : activating
                        ? 'm_e62e9fadeb09'
                        : 'm_71e50031d9c2',
                )}
                disabled={
                  working ||
                  (!ready && !(activating && retryUnknown)) ||
                  (!retryUnknown &&
                    !(activating && needsWrite) &&
                    (!resolved?.title.trim() || !!blockedMessage))
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
      {busy && (
        <ActionFeedback
          loading
          message={t(busy === 'check' ? 'm_965b072ffff9' : 'm_5474eef8d0f1')}
        />
      )}
      {!manual && <Copy muted>{t('ios_calendar_unavailable')}</Copy>}
      {manual && !loading && !current?.connected && !connection.error && (
        <Button label={t('m_3b9b76bc9d82')} variant="secondary" onPress={openSettings} />
      )}
      {manual &&
        (!activating || automatic) &&
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
      {!!(error || unlink.error || disableAutomatic.error || syncRequest.error || problem) && (
        <ActionFeedback
          tone="warning"
          message={
            error ||
            unlink.error ||
            disableAutomatic.error ||
            syncRequest.error ||
            iosManualCalendarError(problem)
          }
        />
      )}
      {manual &&
        !activating &&
        !loading &&
        ready &&
        !candidate.eligible &&
        (review || !link) &&
        !problem &&
        !shown && <Copy muted>{t('ios_calendar_manual_unavailable')}</Copy>}
      {activating &&
        manual &&
        !loading &&
        !shown &&
        !captured &&
        (!automatic || (ready && !activationSource)) && <Copy muted>{t('m_2f283f72b9c9')}</Copy>}
      {!review && link && (
        <ConnectedGroup
          title={t('m_0e570ca6fabe')}
          footer={
            <>
              {!!linkStatus?.description && <Copy muted>{linkStatus.description}</Copy>}
              {!!link.lastCheckErrorCode && (
                <ActionFeedback
                  message={calendarCheckFailure(link.lastCheckErrorCode)}
                  tone="warning"
                />
              )}
              {checkFeedback && <ActionFeedback message={checkFeedback} />}
              {canCheck && (
                <Button
                  label={t('m_5da755d1690f')}
                  variant="secondary"
                  disabled={working || actionUnknown || syncRequest.working}
                  onPress={check}
                />
              )}
              {canStartSync && (
                <Button
                  label={t('m_885e8f48bd70')}
                  variant="secondary"
                  disabled={working || actionUnknown || syncRequest.working}
                  onPress={() => void syncRequest.start()}
                />
              )}
            </>
          }
        >
          <ReadOnlyRow key="status" label={t('m_b074310e911f')} value={linkStatus?.title} />
          <ReadOnlyRow key="calendar" label={t('m_d5d0a30b517e')} value={link.calendarName} />
          <ReadOnlyRow key="account" label={t('m_7da2bcb6bb6b')} value={link.accountEmail} />
          {automaticConsent && link.successfulAtMs != null && (
            <ReadOnlyRow
              key="successful-sync"
              label={t('m_07330d3b86d7')}
              value={scheduleDateTime(link.successfulAtMs)}
            />
          )}
          {observedAtMs != null && (
            <ReadOnlyRow
              key="observed"
              label={t('m_3ca2b1323cd4')}
              value={scheduleDateTime(observedAtMs)}
            />
          )}
          {link.lastCheckAttemptAtMs != null && (
            <ReadOnlyRow
              key="check-attempt"
              label={t('m_57bbbcf15421')}
              value={scheduleDateTime(link.lastCheckAttemptAtMs)}
            />
          )}
        </ConnectedGroup>
      )}
      {showSyncResult && syncRequest.requestId && (
        <CalendarOperationProgress
          operationId={syncRequest.requestId}
          expectedConnectionRevision={revision}
          onAction={
            canUseSyncAction
              ? (status) => {
                  if (status.action === 'Retry') void syncRequest.retryRequest();
                  else if (status.action === 'ReviewItems') openReview(true);
                  else if (status.action === 'Authorize' || status.action === 'Connect')
                    authorize(!syncJob?.remoteAttempted);
                }
              : undefined
          }
        />
      )}
      {syncRequest.unknown && (
        <Button
          label={t('m_16003a1a9190')}
          variant="secondary"
          disabled={working || relationshipUnknown}
          onPress={() => void syncRequest.retryRequest()}
        />
      )}
      {(!review || reviewForm) && manual && (
        <Copy muted>
          {t(
            activating || automaticConsent
              ? 'ios_calendar_automatic_scope'
              : 'ios_calendar_manual_link_detail',
          )}
        </Copy>
      )}
      {!review && canTurnOn && (
        <Button
          label={t('m_bde67edae89d')}
          variant="secondary"
          disabled={working || actionUnknown}
          onPress={() => openReview(true)}
        />
      )}
      {(!review || (!activating && automaticConsent && !shown && !captured)) &&
        candidate.eligible &&
        !link?.readOnly &&
        !pending.length &&
        (!automaticConsent || activationSource) && (
          <Button
            label={t(linked ? 'm_9e636d2d17ec' : link ? 'm_1b01ea836cde' : 'm_45f738fd2ff1')}
            variant="secondary"
            disabled={working || actionUnknown}
            onPress={() => openReview(automaticConsent)}
          />
        )}
      {!review && ((automaticConsent && links.isSuccess) || disableAutomatic.unknown) && (
        <Button
          label={t(disableAutomatic.unknown ? 'm_16003a1a9190' : 'calendar_turn_off_automatic')}
          variant="outlined"
          disabled={working || unlink.unknown || syncRequest.unknown}
          onPress={disableAutomatic.unknown ? () => void disableAutomatic.retry() : confirmDisable}
        />
      )}
      {!review && (linked || unlink.unknown) && (
        <Button
          label={t(unlink.unknown ? 'm_3a8c6f6adf3a' : 'm_d9203b69027f')}
          variant="outlined"
          icon="link_off"
          disabled={working || disableAutomatic.unknown || syncRequest.unknown}
          onPress={unlink.unknown ? () => void unlink.retry() : confirmUnlink}
        />
      )}
      {current &&
        statusJobs
          .filter((job) => !showSyncResult || !syncRequest.status || job !== syncJob)
          .map((job) => (
            <CalendarOperationStatus
              key={job.operationId}
              operation={job}
              iosConnection={current}
              onReviewAgain={
                canReview &&
                (!usesActivationReview(job) || activationSource) &&
                !working &&
                !preview.isFetching &&
                !captured &&
                !actionUnknown
                  ? () => reviewJob(job)
                  : undefined
              }
            />
          ))}
      {reviewForm && reviewed && (
        <>
          <Copy muted>{t(activating ? 'm_1e631f4fb0c8' : 'm_c672ed8175e2')}</Copy>
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
            <Copy muted>
              {t(
                activating
                  ? 'ios_calendar_automatic_allow_write_detail'
                  : 'ios_calendar_manual_allow_write_detail',
              )}
            </Copy>
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
      {review && !reviewForm && !shown && !loading && canLoadReview && !retryUnknown && (
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
