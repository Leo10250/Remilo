import { useLocalizedState, useTranslation } from '../localization/react';
import { t as currentText } from '../localization';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type {
  CalendarCommand,
  CalendarFields,
  CalendarImportChoices,
  CalendarLinkPreview,
  CalendarLinkedOperation,
  CalendarSelections,
} from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarError } from '../domain/calendar';
import { calendarCaptureRejected, resolvedCalendarFields } from '../domain/calendar-link';
import {
  retainedOriginParams,
  secondaryOriginRoute,
  type OriginParams,
} from '../domain/navigation';
import {
  ActionPair,
  ActionFeedback,
  BottomActionBar,
  Button,
  Choice,
  ConnectedGroup,
  Copy,
  Field,
  Page,
  ReadOnlyRow,
  RowSupport,
  SelectRow,
  SettingRow,
  Toggle,
} from '../ui/components';
import { useCalendarAction } from '../ui/calendar-sync';
import { CalendarOperationStatus } from '../ui/calendar-linked';
import {
  calendarAuthorizationError,
  calendarConnectionNeedsRefresh,
  calendarErrorHasCode,
  calendarReadAccess,
  LocalCalendarOperation,
  rememberCalendarConnection,
} from '../ui/calendar-local-import';
import { calendarImportIndependence } from '../domain/calendar-presentation';
import { modeLabel } from '../domain/presentation';
import { DateTimeFields } from '../ui/date-time-fields';
import { engine, iosReminders, nativeAvailable, useIOSCalendarImport } from '../ui/native';
import { useTimeFormatting } from '../ui/time-display';
import { useAppearanceHold } from '../ui/theme';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { notify } from '../ui/feedback';

type CalendarReviewParams = OriginParams & {
  id?: string;
  calendarId?: string;
  eventId?: string;
  expectedConnectionRevision?: string;
  automatic?: string;
  candidateId?: string;
  candidateRevision?: string;
  managedHistory?: string;
};

export default function CalendarReviewRoute() {
  const params = useLocalSearchParams<CalendarReviewParams>();
  const sourceKey = iosReminders
    ? JSON.stringify([params.expectedConnectionRevision, params.calendarId, params.eventId])
    : 'calendar-review';
  return <CalendarReview key={sourceKey} params={params} />;
}

function CalendarReview({ params }: { params: CalendarReviewParams }) {
  'use no memo';
  const t = useTranslation();
  const calendarAction = useCalendarAction();
  const localImport = useIOSCalendarImport();
  const available = nativeAvailable && (!iosReminders || localImport);
  const origin = retainedOriginParams(params);
  const imported = iosReminders || !params.id,
    client = useQueryClient(),
    confirm = useAppearanceConfirmation();
  const { scheduleDateTime, formatDate } = useTimeFormatting();
  const [savedPreview, setPreview] = useState<CalendarLinkPreview | null>(null),
    [choices, setChoices] = useState<CalendarImportChoices>(
      !iosReminders && params.managedHistory === 'true' ? { mode: 'None' } : {},
    );
  const connection = useQuery({
    queryKey: ['calendar', 'connection'],
    queryFn: () => engine().getCalendarConnection(),
    enabled: available && iosReminders,
  });
  const current = !connection.error ? connection.data : undefined;
  const ready = iosReminders && available && calendarReadAccess(current);
  const revision = current?.revision;
  const sameSource =
    ready &&
    revision !== undefined &&
    params.expectedConnectionRevision === String(revision) &&
    !!params.calendarId &&
    !!params.eventId &&
    !params.id &&
    !params.candidateId &&
    !params.automatic &&
    !params.managedHistory;
  const preview =
    !iosReminders || (sameSource && savedPreview?.connectionRevision === revision)
      ? savedPreview
      : null;
  const adopting = !iosReminders && imported && !!params.candidateId && !!preview?.local;
  const [selections, setSelections] = useState<CalendarSelections>({
    title: null,
    notes: null,
    schedule: null,
  });
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [uncertainCapture, setUncertain] = useState(false),
    [error, setError] = useLocalizedState('');
  const [capturing, setCapturing] = useState(false),
    [candidateRevision, setCandidateRevision] = useState<number | null>(() =>
      params.candidateRevision ? Number(params.candidateRevision) : null,
    );
  const [sourceUnavailable, setSourceUnavailable] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [localResult, setLocalResult] = useState<{
    revision: number;
    operation: CalendarLinkedOperation;
  } | null>(null);
  const [ignored, setIgnored] = useState(false);
  const captured = useRef<CalendarCommand | null>(null),
    localCapture = useRef<{ operationId: string; previewId: string; revision: number } | null>(
      null,
    ),
    running = useRef(false),
    live = useRef(true);
  const [now, setNow] = useState(Date.now);
  const readTicket = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const operations = useQuery({
    queryKey: iosReminders ? ['calendar', 'operations', revision] : ['calendar', 'operations'],
    queryFn: () =>
      iosReminders ? engine().getCalendarOperations(revision!) : engine().getCalendarOperations(),
    enabled: available && (!iosReminders || (ready && !!operationId)),
  });
  useFocusEffect(
    useCallback(() => {
      if (available && iosReminders)
        void client.invalidateQueries({ queryKey: ['calendar', 'connection'] });
    }, [available, client]),
  );
  const links = useQuery({
    queryKey: ['calendar', 'links'],
    queryFn: () => engine().getCalendarLinks(),
    enabled: available && !iosReminders,
  });
  const lists = useQuery({
    queryKey: ['lists'],
    queryFn: () => engine().getLists(),
    enabled: available && imported,
  });
  const link = links.data?.find((item) => item.occurrenceId === params.id);
  const job = iosReminders
    ? ready
      ? (!operations.error &&
          operations.data?.find((item) => item.operationId.toLowerCase() === operationId)) ||
        (localResult?.revision === revision ? localResult?.operation : undefined)
      : undefined
    : operations.data?.find((item) => item.operationId === operationId);
  const finalLocalJob =
    iosReminders && job && ['Confirmed', 'Conflict', 'Failed'].includes(job.state);
  const uncertain = uncertainCapture && !finalLocalJob;
  const enable = !link || link.state === 'Detached';
  const activating = !iosReminders && params.automatic === 'true';
  useAppearanceHold(busy || uncertain);
  usePreventRemove(capturing || (!iosReminders && uncertain), () =>
    confirm(t('m_12dd26f54ada'), t('m_b6cae41bec3a')),
  );
  const load = useCallback(async () => {
    if (
      running.current ||
      captured.current ||
      localCapture.current ||
      (iosReminders && !sameSource)
    )
      return;
    running.current = true;
    setBusy(true);
    setError('');
    const ticket = ++readTicket.current;
    try {
      const activation = activating ? await engine().previewCalendarActivation([params.id!]) : null;
      const next = activation
        ? activation.items[0]?.preview
        : params.candidateId
          ? await engine().previewManagedCalendarCandidate(params.candidateId, choices)
          : imported
            ? await engine().previewCalendarImport(
                {
                  calendarId: params.calendarId!,
                  eventId: params.eventId!,
                  ...(iosReminders ? { expectedConnectionRevision: revision } : {}),
                },
                iosReminders
                  ? { ...choices, automaticSync: false, disableReminders: false }
                  : choices,
              )
            : enable
              ? await engine().previewCalendarLink(params.id!)
              : await engine().previewCalendarUpdate(params.id!);
      if (!next)
        throw new Error(activation?.items[0]?.excludedReason || currentText('m_2f283f72b9c9'));
      if (!live.current || ticket !== readTicket.current) return;
      if (iosReminders && next.connectionRevision !== revision) return;
      setPreview(next);
      setSelections(next.selections || { title: null, notes: null, schedule: null });
      setDirty(false);
      if (iosReminders) setSourceUnavailable(false);
      if ('candidateRevision' in next && typeof next.candidateRevision === 'number')
        setCandidateRevision(next.candidateRevision);
    } catch (e) {
      if (live.current && (!iosReminders || ticket === readTicket.current)) {
        setError(calendarError(e));
        setSourceUnavailable(
          !!e &&
            typeof e === 'object' &&
            'code' in e &&
            ['NOT_FOUND', 'ALREADY_IMPORTED'].some((code) => String(e.code).includes(code)),
        );
      }
      if (iosReminders && calendarConnectionNeedsRefresh(e))
        await client.invalidateQueries({ queryKey: ['calendar', 'connection'] });
    } finally {
      running.current = false;
      if (live.current) setBusy(false);
    }
  }, [
    choices,
    client,
    imported,
    enable,
    activating,
    revision,
    sameSource,
    params.calendarId,
    params.eventId,
    params.id,
    params.candidateId,
    setError,
  ]);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    const tickets = readTicket;
    live.current = true;
    void Promise.resolve().then(() => {
      if (live.current) return loadRef.current();
    });
    return () => {
      live.current = false;
      tickets.current++;
    };
  }, [params.id, params.eventId, params.calendarId, params.candidateId, sameSource, revision]);
  const change = (next: CalendarImportChoices) => {
    if (busy || captured.current || localCapture.current || operationId) return;
    setChoices((old) => ({ ...old, ...next }));
    setDirty(true);
  };
  const applyLocal = async () => {
    if (running.current || !ready || revision === undefined || (!preview && !localCapture.current))
      return;
    if (dirty && !localCapture.current) {
      await load();
      return;
    }
    const recovering = localCapture.current !== null;
    const request = (localCapture.current ??= {
      operationId: engine().createOperationId(),
      previewId: preview!.previewId,
      revision,
    });
    const submit = () =>
      engine().applyCalendarCommand({
        kind: 'ImportCalendarEvent',
        operationId: request.operationId,
        previewId: request.previewId,
        expectedConnectionRevision: request.revision,
        automaticSync: false,
      });
    running.current = true;
    setBusy(true);
    setCapturing(true);
    setError('');
    setOperationId(request.operationId.toLowerCase());
    try {
      let result;
      if (recovering) {
        try {
          result = await engine().applyCalendarCommand({
            kind: 'RetryCalendarOperation',
            operationId: request.operationId,
            expectedConnectionRevision: revision,
          });
        } catch (error) {
          // A native miss may mean the first attempt never reached the journal.
          // Only the originally reviewed connection may submit that preview.
          if (
            !calendarErrorHasCode(error, 'NOT_FOUND') ||
            request.revision !== revision ||
            !preview
          )
            throw error;
          result = await submit();
        }
      } else result = await submit();
      if (
        !('localApplied' in result) ||
        result.operationId.toLowerCase() !== request.operationId.toLowerCase()
      )
        throw new Error('Unexpected Calendar operation receipt');
      setLocalResult({ revision, operation: result });
      localCapture.current = null;
      setUncertain(false);
    } catch (error) {
      if (
        calendarCaptureRejected(error) &&
        !calendarErrorHasCode(error, 'STALE_CONNECTION', 'OPERATION_PENDING')
      ) {
        localCapture.current = null;
        setUncertain(false);
        setOperationId(null);
        setPreview(null);
      } else setUncertain(true);
      setError(calendarError(error));
    } finally {
      await client.invalidateQueries();
      running.current = false;
      setBusy(false);
      setCapturing(false);
    }
  };
  const reauthorize = async () => {
    if (!current?.connected || running.current || !engine().authorizeCalendarFromUserAction) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      const next = await engine().authorizeCalendarFromUserAction!(
        current.revision,
        'reauthorizeCurrentAccount',
      );
      await rememberCalendarConnection(client, next);
    } catch (error) {
      setError(calendarAuthorizationError(error));
    } finally {
      await client.invalidateQueries({ queryKey: ['calendar'] });
      running.current = false;
      setBusy(false);
    }
  };
  const apply = async () => {
    if (iosReminders) return applyLocal();
    if (running.current || (!preview && !captured.current)) return;
    if (dirty && !captured.current) {
      await load();
      return;
    }
    captured.current ??= params.candidateId
      ? {
          kind: 'ImportManagedCalendarCandidate',
          operationId: engine().createOperationId(),
          previewId: preview!.previewId,
          automaticSync: true,
          ...(adopting ? { selections: { ...selections } } : {}),
        }
      : {
          kind: imported
            ? 'ImportCalendarEvent'
            : activating
              ? 'EnableAutomaticCalendarSync'
              : enable
                ? 'EnableCalendarLink'
                : 'ApplyCalendarResolution',
          operationId: engine().createOperationId(),
          previewId: preview!.previewId,
          automaticSync:
            choices.automaticSync ??
            preview!.choices.automaticSync ??
            (imported || enable || activating),
          ...(imported ? {} : { selections: { ...selections } }),
        };
    running.current = true;
    setBusy(true);
    setCapturing(true);
    setError('');
    try {
      const ignoring = captured.current.kind === 'IgnoreManagedCalendarCandidate';
      const result = await calendarAction.submit(captured.current);
      if ('operationId' in result && typeof result.operationId === 'string')
        setOperationId(result.operationId);
      if (ignoring) {
        notify({ message: t('m_f7ea0cace525') });
        setIgnored(true);
      }
      captured.current = null;
      setUncertain(false);
      await client.invalidateQueries();
    } catch (e) {
      if (calendarCaptureRejected(e)) {
        captured.current = null;
        setUncertain(false);
      } else setUncertain(true);
      setError(calendarError(e));
    } finally {
      running.current = false;
      setBusy(false);
      setCapturing(false);
    }
  };
  const ignore = () => {
    if (!params.candidateId || candidateRevision === null || running.current || captured.current)
      return;
    confirm(t('m_d1cf051bb145'), t('m_610f37ddbd88'), [
      { text: t('m_19766ed6ccb2'), style: 'cancel' },
      {
        text: t('m_fce77c34d3fe'),
        onPress: () => {
          captured.current = {
            kind: 'IgnoreManagedCalendarCandidate',
            operationId: engine().createOperationId(),
            candidateId: params.candidateId!,
            expectedRevision: candidateRevision,
          };
          void apply();
        },
      },
    ]);
  };
  const mode = choices.mode || preview?.choices.mode || 'Alarm';
  const alarm = choices.alarmAtMs ?? preview?.choices.alarmAtMs;
  const title = choices.title ?? preview?.choices.title ?? preview?.remote.title ?? '';
  const resolved = preview?.local
    ? resolvedCalendarFields(preview.local, preview.remote, selections)
    : null;
  const timing = selections.schedule ? preview?.timings?.[selections.schedule] : null;
  const elapsedChange =
    !preview?.recurrence &&
    !!timing &&
    timing.mode !== 'None' &&
    timing.alarmAtMs <= now &&
    timing.alarmAtMs !== preview?.timings?.remilo.alarmAtMs;
  const fieldText = (field: keyof CalendarFields, fields: Partial<CalendarFields>) => {
    if (fields[field] === undefined) return t('m_31893018064e');
    if (field !== 'schedule')
      return fields[field] || (field === 'notes' ? t('m_efe1cde67784') : t('m_4850b174b713'));
    const schedule = fields.schedule!;
    return (
      (schedule.allDay
        ? formatDate(schedule.eventStartMs, schedule.zoneId) + t('m_b3d544d5d55c')
        : scheduleDateTime(schedule.eventStartMs, schedule.zoneId) +
          ' – ' +
          scheduleDateTime(schedule.eventEndMs, schedule.zoneId)) +
      ' · ' +
      schedule.zoneId +
      (schedule.recurrence ? t('m_9e79a8b1aee5') : '')
    );
  };
  const recurring = !!preview?.recurrence;
  const syncSelected =
    !iosReminders &&
    (activating ||
      !!params.candidateId ||
      (choices.automaticSync ?? preview?.choices.automaticSync ?? (imported || enable)));
  const invalid =
    imported && !adopting
      ? !title.trim() ||
        (recurring ? !preview?.upcoming?.length : mode !== 'None' && (!alarm || alarm <= now))
      : !resolved || elapsedChange;
  const back = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin))),
    [origin],
  );
  useEffect(() => {
    if (ignored && !busy && !uncertain) back();
  }, [ignored, busy, uncertain, back]);
  return (
    <Page
      compact
      sectionSpacing
      title={
        adopting
          ? t('m_a30fc352c641')
          : imported
            ? t('m_585d4bab7d3a')
            : activating
              ? t('m_020858872d16')
              : enable
                ? t('m_45f738fd2ff1')
                : t('m_9e636d2d17ec')
      }
      onBack={back}
      footer={
        !operationId && preview ? (
          <BottomActionBar>
            <ActionPair>
              <Button
                label={
                  uncertain
                    ? t('m_16003a1a9190')
                    : dirty
                      ? t('m_ceda88a9a0fd')
                      : imported && !adopting
                        ? t('m_91178678e720')
                        : activating
                          ? t('m_e62e9fadeb09')
                          : t('m_71e50031d9c2')
                }
                disabled={busy || (!uncertain && !dirty && invalid)}
                onPress={() => void apply()}
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
      <View style={{ gap: 8 }}>
        <Copy muted>
          {adopting ? t('m_62b005b2d47b') : imported ? t('m_b0fb1f750602') : t('m_c672ed8175e2')}
        </Copy>
        {imported && !adopting && <Copy muted>{calendarImportIndependence()}</Copy>}
      </View>
      {params.candidateId && !adopting && <Copy heading>{t('m_b89457145742')}</Copy>}
      {!!error && !finalLocalJob && <ActionFeedback message={error} tone="warning" />}
      {iosReminders && !available && <ActionFeedback message={t('ios_calendar_unavailable')} />}
      {iosReminders && available && !sameSource && !busy && !job && (
        <>
          <ActionFeedback
            loading={connection.isLoading}
            message={
              connection.isLoading
                ? t('m_9673886fee4f')
                : connection.error
                  ? calendarError(connection.error)
                  : ready
                    ? t('ios_calendar_review_outdated')
                    : t('m_326e71c82f32')
            }
          />
          {!connection.isLoading && !ready && current?.connected && (
            <Button
              label={t('m_b724411569e0')}
              variant="secondary"
              onPress={() => void reauthorize()}
            />
          )}
          {connection.error && (
            <Button label={t('m_16003a1a9190')} onPress={() => void connection.refetch()} />
          )}
        </>
      )}
      {busy && (
        <ActionFeedback loading message={capturing ? t('m_57571c98a715') : t('m_9673886fee4f')} />
      )}
      {!preview &&
        !busy &&
        !sourceUnavailable &&
        (!iosReminders || (sameSource && !operationId)) && (
          <Button
            label={t('m_ba805b089799')}
            variant="secondary"
            disabled={!available}
            onPress={() => void load()}
          />
        )}
      {sourceUnavailable && (
        <Button
          label={t(iosReminders ? 'm_76900f1bfd16' : 'm_80c4a2d9d196')}
          variant="secondary"
          onPress={
            iosReminders
              ? back
              : () => router.replace({ pathname: '/calendar-reviews', params: origin })
          }
        />
      )}
      {!iosReminders && !preview && uncertain && (
        <Button label={t('m_16003a1a9190')} disabled={busy} onPress={() => void apply()} />
      )}
      {!iosReminders &&
        params.candidateId &&
        candidateRevision !== null &&
        !operationId &&
        !sourceUnavailable && (
          <Button
            label={t('m_b839153e19bb')}
            variant="secondary"
            disabled={busy || uncertain}
            onPress={ignore}
          />
        )}
      {preview && !operationId && (
        <>
          <ConnectedGroup title={t('m_0e570ca6fabe')}>
            <ReadOnlyRow key="calendar" label={t('m_d5d0a30b517e')} value={preview.calendarName} />
            <ReadOnlyRow key="account" label={t('m_7da2bcb6bb6b')} value={preview.email} />
            <ReadOnlyRow
              key="checked"
              label={t('m_0efd92a33590')}
              value={scheduleDateTime(preview.checkedAtMs)}
            />
          </ConnectedGroup>
          {iosReminders ? (
            <Copy muted>{t('ui_calendar_import_local_only')}</Copy>
          ) : (
            <ConnectedGroup title={t('m_b97900d1be7c')}>
              <View key="sync">
                {activating || params.candidateId ? (
                  <SettingRow
                    icon="event"
                    label={t('m_41a8bf8da139')}
                    description={t('m_bf02ddb833cf')}
                  />
                ) : (
                  <Toggle
                    label={t('m_23a71272299e')}
                    value={syncSelected}
                    disabled={busy || uncertain}
                    onChange={(value) => {
                      setChoices((old) => ({ ...old, automaticSync: value }));
                      if (imported) setDirty(true);
                    }}
                  />
                )}
                <RowSupport>
                  <Copy muted size={14}>
                    {imported && !adopting
                      ? t(
                          syncSelected
                            ? 'ui_calendar_import_linked'
                            : 'ui_calendar_import_local_only',
                        )
                      : t('m_1e631f4fb0c8')}
                  </Copy>
                </RowSupport>
              </View>
            </ConnectedGroup>
          )}
          {imported && !adopting ? (
            <>
              <ConnectedGroup title={t('m_f74c0be05e82')}>
                <View key="event" style={{ padding: 16, gap: 12 }}>
                  <Copy heading>{preview.remote.title || t('m_a79be2403a6c')}</Copy>
                  <Copy>{preview.remote.notes || t('m_efe1cde67784')}</Copy>
                  <Copy>{fieldText('schedule', preview.remote)}</Copy>
                </View>
              </ConnectedGroup>
              <Field
                label={t('m_7e8cd2056da7')}
                required
                multiline
                compactMultiline
                value={title}
                editable={!busy && !uncertain}
                maxLength={200}
                onChangeText={(value) => change({ title: value })}
              />
              <ConnectedGroup title={t('m_34ddba84ee3c')}>
                <View key="mode" style={{ padding: 16 }}>
                  {(['Alarm', 'Notification', 'None'] as const).map((value) => (
                    <Choice
                      key={value}
                      label={modeLabel(value)}
                      selected={mode === value}
                      disabled={busy || uncertain}
                      onPress={() => change({ mode: value })}
                    />
                  ))}
                </View>
                {mode !== 'None' && alarm !== undefined && !recurring && (
                  <DateTimeFields
                    key="time"
                    value={alarm}
                    zoneId={preview.remote.schedule.zoneId}
                    allDay={false}
                    disabled={busy || uncertain}
                    onError={setError}
                    onChange={(value) => change({ alarmAtMs: value })}
                    labelPrefix={t('m_33cc28980e08')}
                  />
                )}
              </ConnectedGroup>
              {recurring && (
                <View key="repeat" style={{ padding: 16, gap: 8 }}>
                  <Copy heading>{t('m_235d9592dab2')}</Copy>
                  {preview.upcoming?.map((slot) => (
                    <Copy key={slot.eventStartMs}>
                      {scheduleDateTime(
                        mode === 'None' ? slot.eventStartMs : slot.alarmAtMs,
                        preview.remote.schedule.zoneId,
                      )}
                    </Copy>
                  ))}
                  <Copy muted>{t('m_9b75e12ec2d4')}</Copy>
                </View>
              )}
              {!recurring && mode !== 'None' && alarm !== undefined && alarm <= now && (
                <ActionFeedback tone="warning" message={t('m_eb809c6cb1c2')} />
              )}
              {choices.alarmAtMs !== undefined && (
                <Button
                  label={t('m_32bf22f0aec3')}
                  variant="secondary"
                  disabled={busy || uncertain}
                  onPress={() => change({ alarmAtMs: undefined })}
                />
              )}
              {!busy && !uncertain && (
                <SelectRow
                  label={t('m_6f202f54a7b2')}
                  value={choices.listId || ''}
                  choices={[
                    { value: '', label: t('m_eacd31d849f9') },
                    ...(lists.data || []).map((row) => ({ value: row.id, label: row.name })),
                  ]}
                  onChange={(value) => change({ listId: value || null })}
                />
              )}
              {!iosReminders && (
                <>
                  <ConnectedGroup title={t('m_381bba430663')}>
                    <Toggle
                      key="suppress"
                      label={t('m_99ee4355f56a')}
                      value={choices.disableReminders || false}
                      disabled={busy || uncertain}
                      onChange={(value) => change({ disableReminders: value })}
                    />
                  </ConnectedGroup>
                  <Copy muted>
                    {preview.googleReminders
                      ? mode === 'None'
                        ? t('m_1cfe6b952cb6')
                        : t('m_08c3cea793a9')
                      : t('m_f798f7a243db')}
                  </Copy>
                  <Copy muted>{t('m_e65ddfec7900')}</Copy>
                </>
              )}
              {dirty && <ActionFeedback message={t('m_eba734df0aa9')} tone="warning" />}
            </>
          ) : (
            preview.local && (
              <>
                {(['title', 'notes', 'schedule'] as const).map((field) => (
                  <ConnectedGroup
                    key={field}
                    title={
                      field === 'title'
                        ? t('m_7e8cd2056da7')
                        : field === 'notes'
                          ? t('m_8a7525b1492f')
                          : t('m_f4830a1dae29')
                    }
                  >
                    <View key="choices" style={{ padding: 16, gap: 8 }}>
                      {preview.baseline && (
                        <View style={{ gap: 4 }}>
                          <Copy muted size={14}>
                            {t('ui_calendar_last_confirmed')}
                          </Copy>
                          <Copy>{fieldText(field, preview.baseline)}</Copy>
                        </View>
                      )}
                      <Choice
                        label={t('m_ab4821c44cdf')}
                        description={fieldText(field, preview.local!)}
                        selected={selections[field] === 'remilo'}
                        disabled={busy || uncertain}
                        onPress={() => setSelections((old) => ({ ...old, [field]: 'remilo' }))}
                      />
                      <Choice
                        label={t('m_c017c30b1471')}
                        description={fieldText(field, preview.remote)}
                        selected={selections[field] === 'google'}
                        disabled={busy || uncertain}
                        onPress={() => setSelections((old) => ({ ...old, [field]: 'google' }))}
                      />
                      {!selections[field] && <Copy muted>{t('m_52f9493747f8')}</Copy>}
                    </View>
                  </ConnectedGroup>
                ))}
                {resolved && (
                  <ConnectedGroup title={t('m_3b8981de73a5')}>
                    <View key="resolution" style={{ padding: 16, gap: 12 }}>
                      <Copy heading>{resolved.title}</Copy>
                      <Copy>{resolved.notes || t('m_efe1cde67784')}</Copy>
                      <Copy>{fieldText('schedule', resolved)}</Copy>
                      {timing && (
                        <>
                          <ReadOnlyRow
                            label={t('m_9071738f1459')}
                            value={scheduleDateTime(timing.dueAtMs, resolved.schedule.zoneId)}
                          />
                          {timing.mode === 'None' ? (
                            <Copy>{modeLabel('None')}</Copy>
                          ) : (
                            <ReadOnlyRow
                              label={modeLabel(
                                timing.mode === 'Notification' ? 'Notification' : 'Alarm',
                              )}
                              value={scheduleDateTime(timing.alarmAtMs, resolved.schedule.zoneId)}
                            />
                          )}
                        </>
                      )}
                    </View>
                  </ConnectedGroup>
                )}
                <Copy muted>{t('m_32af1909c259')}</Copy>
                {elapsedChange && <ActionFeedback tone="warning" message={t('m_8d7bb691765b')} />}
                {preview.nextAlertMs !== null && (
                  <Copy>
                    {t('ui_calendar_retained_alert_time', {
                      time: scheduleDateTime(preview.nextAlertMs),
                    })}
                  </Copy>
                )}
                <Copy muted>{t('m_b2ab1c6e45a0')}</Copy>
              </>
            )
          )}
          {!busy && !uncertain && (
            <Button label={t('m_962d33506a8f')} variant="secondary" onPress={() => void load()} />
          )}
        </>
      )}
      {iosReminders && job && (
        <LocalCalendarOperation
          operation={job}
          busy={busy}
          onOpen={() =>
            router.push({ pathname: '/reminder/[id]', params: { id: job.occurrenceId, ...origin } })
          }
          onRetry={() => void applyLocal()}
          onReviewAgain={() => {
            if (!sameSource) {
              back();
              return;
            }
            localCapture.current = null;
            setUncertain(false);
            setOperationId(null);
            setLocalResult(null);
            setPreview(null);
            void load();
          }}
        />
      )}
      {!iosReminders && job && (
        <>
          <CalendarOperationStatus operation={job} />
          {job.localApplied && (
            <Button
              label={t('m_40ed00ddaacf')}
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/reminder/[id]',
                  params: { id: job.occurrenceId, ...origin },
                })
              }
            />
          )}
          {['Conflict', 'Failed'].includes(job.state) && (
            <Button
              label={t('m_d4ea61c79c9b')}
              variant="secondary"
              onPress={() => {
                if (job.localApplied)
                  router.replace({
                    pathname: '/calendar-review',
                    params: { id: job.occurrenceId, ...origin },
                  } as Href);
                else {
                  setOperationId(null);
                  setPreview(null);
                  void load();
                }
              }}
            />
          )}
        </>
      )}
      {operationId && !job && (!iosReminders || uncertain) && (
        <>
          <ActionFeedback
            loading={!iosReminders || busy}
            message={t(
              iosReminders && uncertain ? 'ios_calendar_import_unconfirmed' : 'm_83743f87492a',
            )}
          />
          {iosReminders && ready && uncertain && (
            <Button label={t('m_16003a1a9190')} disabled={busy} onPress={() => void applyLocal()} />
          )}
        </>
      )}
    </Page>
  );
}
