import { useLocalizedState, useTranslation } from '../localization/react';
import { t as currentText } from '../localization';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type {
  CalendarCommand,
  CalendarImportChoices,
  CalendarImportBatchResult,
  CalendarLinkPreview,
} from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { collectCalendarImports, excludedCalendarImports } from '../domain/calendar-import';
import { calendarCaptureRejected } from '../domain/calendar-link';
import { calendarError } from '../domain/calendar';
import { calendarImportIndependence } from '../domain/calendar-presentation';
import { modeLabel } from '../domain/presentation';
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
  SelectRow,
  SettingRow,
  Sheet,
  Status,
  Toggle,
} from '../ui/components';
import { CalendarOperationStatus } from '../ui/calendar-linked';
import { DateTimeFields } from '../ui/date-time-fields';
import { engine, nativeAvailable } from '../ui/native';
import { useTimeFormatting } from '../ui/time-display';
import { useAppearanceHold } from '../ui/theme';
import { useAppearanceConfirmation } from '../ui/confirmation';

type Entry = { eventId: string; preview: CalendarLinkPreview };
export default function CalendarImportAll() {
  'use no memo';
  const t = useTranslation();
  const eventButtons = useRef(new Map<string, View>());
  const eventTrigger = useRef<View>(null);
  const params = useLocalSearchParams<
      OriginParams & { calendarId: string; from: string; until: string; managedHistory?: string }
    >(),
    origin = retainedOriginParams(params);
  const client = useQueryClient(),
    confirm = useAppearanceConfirmation(),
    { scheduleDateTime, formatDate } = useTimeFormatting();
  const [entries, setEntries] = useState<Entry[]>([]),
    [overrides, setOverrides] = useState<Record<string, CalendarImportChoices>>({});
  const [mode, setMode] = useState<'Alarm' | 'Notification' | 'None'>(
      params.managedHistory === 'true' ? 'None' : 'Alarm',
    ),
    [listId, setListId] = useState<string | null>(null),
    [suppress, setSuppress] = useState(false);
  const [automaticSync, setAutomaticSync] = useState(true);
  const [reading, setReading] = useState(false),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [ready, setReady] = useState(false);
  const [message, setMessage] = useLocalizedState(''),
    [error, setError] = useLocalizedState(''),
    [selected, setSelected] = useState<string | null>(null);
  const [operationIds, setOperationIds] = useState<string[]>([]),
    [account, setAccount] = useState(''),
    [now, setNow] = useState(Date.now);
  const captured = useRef<Extract<CalendarCommand, { kind: 'ImportCalendarEvents' }> | null>(null),
    running = useRef(false),
    live = useRef(true),
    ticket = useRef(0);
  const operations = useQuery({
    queryKey: ['calendar', 'operations'],
    queryFn: () => engine().getCalendarOperations(),
    enabled: nativeAvailable,
  });
  const lists = useQuery({
    queryKey: ['lists'],
    queryFn: () => engine().getLists(),
    enabled: nativeAvailable,
  });
  const ids = new Set(operationIds),
    jobs = (operations.data || []).filter((job) => ids.has(job.operationId));
  const back = () =>
    router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin));
  useAppearanceHold(busy || uncertain);
  usePreventRemove(busy || uncertain, () => confirm(t('m_34364836709b'), t('m_1322375fbf1c')));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const load = useCallback(async () => {
    if (running.current || captured.current) return;
    running.current = true;
    setReading(true);
    setReady(false);
    setError('');
    setOperationIds([]);
    const current = ++ticket.current,
      active = () => live.current && ticket.current === current;
    try {
      const connection = await engine().getCalendarConnection();
      if (!connection.connected)
        throw Object.assign(new Error(currentText('m_f3e3d554f662')), { code: 'NEEDS_ACCESS' });
      const [links, saved] = await Promise.all([
        engine().getCalendarLinks(),
        engine().getCalendarOperations(),
      ]);
      const events = await collectCalendarImports(
        { calendarId: params.calendarId, from: params.from, until: params.until, cursor: null },
        connection.revision,
        (query) => engine().listCalendarEvents(query),
        excludedCalendarImports(params.calendarId, links, saved),
        active,
        (count) =>
          setMessage(currentText('m_37e878947c20') + count + currentText('m_2840523b4caf')),
      );
      const reviewed: Entry[] = [];
      for (const event of events) {
        if (!active()) return;
        setMessage(
          currentText('m_ffe7d4cb4b52') +
            (reviewed.length + 1) +
            currentText('m_a4282e4b2298') +
            events.length +
            '…',
        );
        try {
          const preview = await engine().previewCalendarImport(
            { calendarId: params.calendarId, eventId: event.eventId },
            {},
          );
          if (active()) reviewed.push({ eventId: event.eventId, preview });
        } catch (e) {
          if (!(
            e &&
            typeof e === 'object' &&
            'code' in e &&
            String(e.code).includes('ALREADY_IMPORTED')
          ))
            throw e;
        }
      }
      if ((await engine().getCalendarConnection()).revision !== connection.revision)
        throw Object.assign(new Error(currentText('m_ee6c6ad65095')), { code: 'STALE_CONNECTION' });
      if (!active()) return;
      setEntries(reviewed);
      setOverrides((old) =>
        Object.fromEntries(
          reviewed
            .filter((entry) => old[entry.eventId])
            .map((entry) => [entry.eventId, old[entry.eventId]]),
        ),
      );
      setAccount(connection.email);
      setReady(true);
    } catch (e) {
      if (active()) setError(calendarError(e));
    } finally {
      running.current = false;
      if (active()) setReading(false);
    }
  }, [params.calendarId, params.from, params.until, setError, setMessage]);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    const tickets = ticket;
    live.current = true;
    void Promise.resolve().then(() => {
      if (live.current) return loadRef.current();
    });
    return () => {
      live.current = false;
      tickets.current++;
    };
  }, [params.calendarId, params.from, params.until]);
  const choices = (entry: Entry): CalendarImportChoices => ({
    mode,
    listId,
    disableReminders: suppress,
    automaticSync,
    ...overrides[entry.eventId],
  });
  const title = (entry: Entry) =>
    choices(entry).title ?? entry.preview.choices.title ?? entry.preview.remote.title;
  const alert = (entry: Entry) =>
    choices(entry).alarmAtMs ??
    (entry.preview.recurrence ? (entry.preview.nextAlertMs ?? 0) : entry.preview.choices.alarmAtMs);
  const invalid = entries.filter(
    (entry) =>
      !title(entry)?.trim() ||
      (entry.preview.recurrence && !entry.preview.upcoming?.length) ||
      (choices(entry).mode !== 'None' && alert(entry) <= now),
  );
  const edited = entries.find((entry) => entry.eventId === selected);
  const locked = busy || uncertain || operationIds.length > 0;
  const change = (eventId: string, next: CalendarImportChoices) => {
    if (!locked) setOverrides((old) => ({ ...old, [eventId]: { ...old[eventId], ...next } }));
  };
  const apply = async () => {
    if (running.current || !ready || !entries.length) return;
    captured.current ??= {
      kind: 'ImportCalendarEvents',
      operationId: engine().createOperationId(),
      items: entries.map((entry) => ({
        previewId: entry.preview.previewId,
        choices: choices(entry),
      })),
    };
    running.current = true;
    setBusy(true);
    setError('');
    try {
      const result = (await engine().applyCalendarCommand(
        captured.current,
      )) as CalendarImportBatchResult;
      setOperationIds(result.operations.map((job) => job.operationId));
      captured.current = null;
      setUncertain(false);
      setSelected(null);
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
    }
  };
  return (
    <Page
      compact
      sectionSpacing
      title={t('m_ecb8f0a7dc25')}
      onBack={back}
      footer={
        !operationIds.length && ready && entries.length ? (
          <BottomActionBar>
            <ActionPair>
              <Button
                label={
                  uncertain
                    ? t('m_1936752a4785')
                    : t('calendar_import_all_count', { count: entries.length })
                }
                disabled={busy || (!uncertain && invalid.length > 0)}
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
        <Copy muted>{t('m_6c2e4493af7d')}</Copy>
        <Copy muted>{calendarImportIndependence()}</Copy>
      </View>
      {!!error && <ActionFeedback message={error} tone="warning" />}
      {reading && <ActionFeedback message={message || t('m_e65119545c4b')} loading />}
      {!reading && !ready && (
        <Button label={t('m_ba805b089799')} variant="secondary" onPress={() => void load()} />
      )}
      {ready && !operationIds.length && (
        <>
          {(!!account || !!entries[0]) && (
            <ConnectedGroup title={t('m_0e570ca6fabe')}>
              {!!entries[0] && (
                <ReadOnlyRow label={t('m_d5d0a30b517e')} value={entries[0].preview.calendarName} />
              )}
              {!!account && <ReadOnlyRow label={t('m_7da2bcb6bb6b')} value={account} />}
            </ConnectedGroup>
          )}
          <Copy heading>
            {entries.length
              ? t('ui_calendar_import_review_count', { count: entries.length })
              : t('m_7364e461ad6c')}
          </Copy>
          {!!entries.length && (
            <>
              <ConnectedGroup
                title={t('m_b97900d1be7c')}
                footer={
                  <View style={{ gap: 8 }}>
                    <Copy muted size={14}>
                      {t(
                        automaticSync
                          ? 'ui_calendar_import_bulk_linked'
                          : 'ui_calendar_import_bulk_local',
                      )}
                    </Copy>
                    <Copy muted size={14}>
                      {t('m_bb57a0ef8ae0')}
                    </Copy>
                  </View>
                }
              >
                <Toggle
                  key="automatic"
                  label={t('m_23a71272299e')}
                  value={automaticSync}
                  disabled={locked}
                  onChange={setAutomaticSync}
                />
              </ConnectedGroup>
              <ConnectedGroup title={t('m_a2b3a106795d')}>
                <View key="modes" style={{ padding: 16 }}>
                  {(['Alarm', 'Notification', 'None'] as const).map((value) => (
                    <Choice
                      key={value}
                      label={modeLabel(value)}
                      selected={mode === value}
                      disabled={locked}
                      onPress={() => {
                        setMode(value);
                        setOverrides((old) =>
                          Object.fromEntries(
                            Object.entries(old).map(([id, values]) => {
                              const { mode: _mode, ...rest } = values;
                              return [id, rest];
                            }),
                          ),
                        );
                      }}
                    />
                  ))}
                </View>
              </ConnectedGroup>
              {!locked && (
                <SelectRow
                  label={t('m_5d55de2a9035')}
                  value={listId || ''}
                  choices={[
                    { value: '', label: t('m_eacd31d849f9') },
                    ...(lists.data || []).map((list) => ({ value: list.id, label: list.name })),
                  ]}
                  onChange={(value) => setListId(value || null)}
                />
              )}
              <ConnectedGroup title={t('m_381bba430663')}>
                <Toggle
                  key="suppress"
                  label={t('m_da47e050c1f1')}
                  value={suppress}
                  disabled={locked}
                  onChange={(value) => {
                    setSuppress(value);
                    setOverrides((old) =>
                      Object.fromEntries(
                        Object.entries(old).map(([id, values]) => {
                          const { disableReminders: _disable, ...rest } = values;
                          return [id, rest];
                        }),
                      ),
                    );
                  }}
                />
              </ConnectedGroup>
              <Copy muted>
                {[
                  t('m_514c71c7cda7'),
                  t(
                    entries.some((entry) => choices(entry).mode !== 'None')
                      ? 'm_0e928a7cd037'
                      : 'm_59a98c6d525c',
                  ),
                  t('m_566d757c1ea8'),
                ].join(' ')}
              </Copy>
              {!!invalid.length && (
                <ActionFeedback
                  tone="warning"
                  message={t('ui_calendar_import_invalid_count', { count: invalid.length })}
                />
              )}
              <ConnectedGroup title={t('m_cde20fd4af8a')}>
                {entries.map((entry) => (
                  <SettingRow
                    intent="action"
                    icon="edit"
                    key={entry.eventId}
                    label={title(entry) || t('m_c9a0236cbef6')}
                    disabled={locked}
                    buttonRef={(node) => {
                      if (node) eventButtons.current.set(entry.eventId, node);
                      else eventButtons.current.delete(entry.eventId);
                    }}
                    description={[
                      entry.preview.remote.schedule.allDay
                        ? formatDate(
                            entry.preview.remote.schedule.eventStartMs,
                            entry.preview.remote.schedule.zoneId,
                          ) + t('m_b3d544d5d55c')
                        : scheduleDateTime(
                            entry.preview.remote.schedule.eventStartMs,
                            entry.preview.remote.schedule.zoneId,
                          ),
                      modeLabel(choices(entry).mode),
                      choices(entry).mode === 'None'
                        ? ''
                        : scheduleDateTime(alert(entry), entry.preview.remote.schedule.zoneId),
                      entry.preview.remote.schedule.zoneId,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    statusLabel={
                      invalid.includes(entry) ? t('ui_calendar_needs_review') : undefined
                    }
                    supporting={
                      invalid.includes(entry) ? (
                        <Status label={t('ui_calendar_needs_review')} tone="warning" />
                      ) : undefined
                    }
                    onPress={() => {
                      eventTrigger.current = eventButtons.current.get(entry.eventId) ?? null;
                      setSelected(entry.eventId);
                    }}
                  />
                ))}
              </ConnectedGroup>
              <Button
                label={t('m_ae156a0a79f4')}
                variant="secondary"
                disabled={locked}
                onPress={() => void load()}
              />
            </>
          )}
        </>
      )}
      {!!operationIds.length && (
        <>
          <Copy heading>
            {t('ui_calendar_import_requests_count', { count: operationIds.length })}
          </Copy>
          <Copy>
            {t('ui_calendar_import_saved_count', {
              count: jobs.filter((job) => job.localApplied).length,
            })}
          </Copy>
          {jobs.map((job) => (
            <CalendarOperationStatus key={job.operationId} operation={job} />
          ))}
          <Button label={t('m_6f92c8203bdb')} variant="secondary" onPress={back} />
        </>
      )}
      <Sheet
        title={t('m_926bb62635ac')}
        visible={!!edited}
        onClose={() => setSelected(null)}
        returnFocusRef={eventTrigger}
      >
        {edited && (
          <>
            <Copy>{edited.preview.remote.title || t('m_a79be2403a6c')}</Copy>
            <Copy>{edited.preview.remote.notes || t('m_efe1cde67784')}</Copy>
            <Copy>
              {scheduleDateTime(
                edited.preview.remote.schedule.eventStartMs,
                edited.preview.remote.schedule.zoneId,
              )}{' '}
              –{' '}
              {scheduleDateTime(
                edited.preview.remote.schedule.eventEndMs,
                edited.preview.remote.schedule.zoneId,
              )}{' '}
              · {edited.preview.remote.schedule.zoneId}
            </Copy>
            <ReadOnlyRow
              compact
              label={t('m_0efd92a33590')}
              value={scheduleDateTime(edited.preview.checkedAtMs)}
            />
            <Field
              label={t('m_7e8cd2056da7')}
              required
              multiline
              compactMultiline
              value={title(edited)}
              maxLength={200}
              editable={!locked}
              onChangeText={(value) => change(edited.eventId, { title: value })}
            />
            {(['Alarm', 'Notification', 'None'] as const).map((value) => (
              <Choice
                key={value}
                label={modeLabel(value)}
                selected={choices(edited).mode === value}
                disabled={locked}
                onPress={() => change(edited.eventId, { mode: value })}
              />
            ))}
            {choices(edited).mode !== 'None' && !edited.preview.recurrence && (
              <DateTimeFields
                labelPrefix={t('m_33cc28980e08')}
                value={alert(edited)}
                zoneId={edited.preview.remote.schedule.zoneId}
                allDay={false}
                disabled={locked}
                onError={setError}
                onChange={(value) => change(edited.eventId, { alarmAtMs: value })}
              />
            )}
            {edited.preview.recurrence && <Copy muted>{t('m_990698f02502')}</Copy>}
            <Toggle
              label={t('m_99ee4355f56a')}
              value={choices(edited).disableReminders || false}
              disabled={locked}
              onChange={(value) => change(edited.eventId, { disableReminders: value })}
            />
            <Toggle
              label={t('m_7b0dcd0ed6e9')}
              value={choices(edited).automaticSync ?? true}
              disabled={locked}
              onChange={(value) => change(edited.eventId, { automaticSync: value })}
            />
            <Copy muted>
              {t(
                (choices(edited).automaticSync ?? true)
                  ? 'ui_calendar_import_linked'
                  : 'ui_calendar_import_local_only',
              )}
            </Copy>
            <Copy muted>
              {edited.preview.googleReminders ? t('m_655959e9775d') : t('m_bd37e9edaee2')}
            </Copy>
            <Button label={t('m_1654cde35f9c')} onPress={() => setSelected(null)} />
          </>
        )}
      </Sheet>
    </Page>
  );
}
