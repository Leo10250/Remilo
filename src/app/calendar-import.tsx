import { useLocalizedState, useTranslation } from '../localization/react';

import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';
import type {
  CalendarEventPage,
  OwnedCalendar,
} from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import {
  retainedOriginParams,
  secondaryOriginRoute,
  type OriginParams,
} from '../domain/navigation';
import { calendarError } from '../domain/calendar';
import { unsupportedCalendarReason } from '../domain/calendar-link';
import { deviceZone } from '../domain/time';
import {
  calendarImportRange,
  excludedCalendarImports,
  orderedCalendarImportDates,
  remainingCalendarImports,
} from '../domain/calendar-import';
import {
  ActionFeedback,
  ActionPair,
  Button,
  ConnectedGroup,
  Copy,
  DateField,
  Page,
  ReadOnlyRow,
  SettingRow,
  Sheet,
} from '../ui/components';
import {
  CalendarOwnedChoices,
  calendarConnectionNeedsRefresh,
  calendarReadAccess,
} from '../ui/calendar-local-import';
import { engine, iosReminders, nativeAvailable, useIOSCalendarImport } from '../ui/native';
import { useTimeFormatting } from '../ui/time-display';

export default function CalendarImportBrowser() {
  'use no memo';
  const t = useTranslation();
  const { scheduleDateTime, formatDate } = useTimeFormatting();
  const sourceTrigger = useRef<View>(null);
  const localImport = useIOSCalendarImport();
  const available = nativeAvailable && (!iosReminders || localImport);
  const rawParams = useLocalSearchParams<
      OriginParams & { managedHistory?: string; calendarId?: string }
    >(),
    params = retainedOriginParams(rawParams);
  const managedHistory = !iosReminders && rawParams.managedHistory === 'true';
  const connection = useQuery({
    queryKey: ['calendar', 'connection'],
    queryFn: () => engine().getCalendarConnection(),
    enabled: available,
  });
  const current = iosReminders && connection.error ? undefined : connection.data;
  const ready = available && calendarReadAccess(current);
  const revision = current?.revision;
  const links = useQuery({
    queryKey: ['calendar', 'links'],
    queryFn: () => engine().getCalendarLinks(),
    enabled: available && !iosReminders,
  });
  const operations = useQuery({
    queryKey: iosReminders ? ['calendar', 'operations', revision] : ['calendar', 'operations'],
    queryFn: () =>
      iosReminders ? engine().getCalendarOperations(revision!) : engine().getCalendarOperations(),
    enabled: available && (!iosReminders || ready),
  });
  const managed = useQuery({
    queryKey: ['calendar', 'managed'],
    queryFn: () => engine().getManagedCalendarState(),
    enabled: available && managedHistory,
  });
  const refetchLinks = links.refetch,
    refetchOperations = operations.refetch,
    refetchConnection = connection.refetch;
  useFocusEffect(
    useCallback(() => {
      if (!available) return;
      if (iosReminders) void refetchConnection();
      else void refetchLinks();
      if (!iosReminders || ready) void refetchOperations();
    }, [available, ready, refetchConnection, refetchLinks, refetchOperations]),
  );
  const [savedCalendars, setCalendars] = useState<OwnedCalendar[]>([]),
    [savedCalendarCursor, setCalendarCursor] = useState<string | null>(null);
  const [calendarsRevision, setCalendarsRevision] = useState<number | null>(null),
    [sourceRevision, setSourceRevision] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false),
    [savedCalendar, setCalendar] = useState<OwnedCalendar | null>(null);
  const calendars = ready && calendarsRevision === revision ? savedCalendars : [];
  const calendarCursor = ready && calendarsRevision === revision ? savedCalendarCursor : null;
  const calendar =
    ready && sourceRevision === revision
      ? savedCalendar
      : managedHistory && ready && managed.data && managed.data.calendarId === rawParams.calendarId
        ? {
            id: managed.data.calendarId,
            name: managed.data.calendarName,
            zoneId: managed.data.calendarZone,
          }
        : null;
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (managedHistory) d.setDate(d.getDate() - 30);
    return d.getTime();
  });
  const [end, setEnd] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + (managedHistory ? -1 : 29));
    return d.getTime();
  });
  const [rows, setRows] = useState<CalendarEventPage['items']>([]),
    [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useLocalizedState('');
  const range = calendarImportRange(from, end, deviceZone());
  const filterKey = JSON.stringify([
    calendar?.id,
    range.from,
    range.until,
    revision,
    ...(iosReminders ? [ready] : []),
  ]);
  const [resultKey, setResultKey] = useState('');
  const excluded = excludedCalendarImports(
    calendar?.id || '',
    links.data || [],
    operations.data || [],
  );
  const visibleRows =
      ready && resultKey === filterKey ? remainingCalendarImports(rows, excluded) : [],
    visibleCursor = ready && resultKey === filterKey ? cursor : null;
  const ticket = useRef(0),
    running = useRef(false);
  useEffect(() => {
    ticket.current++;
  }, [filterKey]);
  useEffect(
    () => () => {
      ticket.current++;
    },
    [],
  );
  const loadCalendars = async (next: string | null = null) => {
    if (running.current || !available || !ready || revision === undefined) return;
    running.current = true;
    setBusy(true);
    setError('');
    setSelecting(true);
    const current = ++ticket.current;
    try {
      const page = iosReminders
        ? await engine().listOwnedCalendars(next, revision)
        : await engine().listOwnedCalendars(next);
      if (current !== ticket.current || page.connectionRevision !== revision) return;
      setCalendars((old) =>
        next
          ? [...old, ...page.items.filter((item) => !old.some((row) => row.id === item.id))]
          : page.items,
      );
      setCalendarsRevision(page.connectionRevision);
      setCalendarCursor(page.nextCursor);
    } catch (e) {
      if (current === ticket.current) setError(calendarError(e));
      if (iosReminders && calendarConnectionNeedsRefresh(e)) await refetchConnection();
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const load = async (next: string | null = null) => {
    if (!calendar || running.current || !range.valid || !ready || revision === undefined) return;
    const current = ++ticket.current;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      const page = await engine().listCalendarEvents({
        calendarId: calendar.id,
        from: range.from,
        until: range.until,
        cursor: next,
        ...(iosReminders ? { expectedConnectionRevision: revision } : {}),
      });
      if (current !== ticket.current || page.connectionRevision !== revision) return;
      setRows((old) =>
        next
          ? [
              ...old,
              ...page.items.filter((item) => !old.some((row) => row.eventId === item.eventId)),
            ]
          : page.items,
      );
      setCursor(page.nextCursor);
      setLoaded(true);
      setResultKey(filterKey);
    } catch (e) {
      if (current === ticket.current) setError(calendarError(e));
      if (iosReminders && calendarConnectionNeedsRefresh(e)) await refetchConnection();
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const changeDate = (which: 'start' | 'end', value: number) => {
    const dates = orderedCalendarImportDates(from, end, which, value);
    setFrom(dates.start);
    setEnd(dates.end);
  };
  return (
    <Page
      sectionSpacing
      title={t('m_357bcb0ce661')}
      scrollKey="calendar-import"
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(params))
      }
    >
      <Copy muted>{t(iosReminders ? 'ios_calendar_browse_intro' : 'm_0c6c8e7982cd')}</Copy>
      {managedHistory && <Copy muted>{t('m_e921a8b153e9')}</Copy>}
      {!available && iosReminders && <Copy muted>{t('ios_calendar_unavailable')}</Copy>}
      {iosReminders && connection.error && (
        <ActionFeedback message={calendarError(connection.error)} tone="warning" />
      )}
      {available && !ready && (
        <Button
          label={t('m_3b9b76bc9d82')}
          onPress={() => router.push({ pathname: '/calendar', params })}
        />
      )}
      <ConnectedGroup title={t('m_3a7d9a6a0b83')}>
        <ReadOnlyRow
          key="account"
          label={t('m_7da2bcb6bb6b')}
          value={((!iosReminders || current?.connected) && current?.email) || t('m_0303e1824670')}
        />
        <SettingRow
          intent="picker"
          key="calendar"
          icon="event"
          label={t('m_cd51d907caec')}
          value={calendar?.name || t('m_28d7adf0d759')}
          buttonRef={sourceTrigger}
          disabled={busy || !ready}
          onPress={() => void loadCalendars()}
        />
        <DateField
          key="from"
          label={t('m_8169693101a4')}
          dateOnly
          value={from}
          disabled={busy}
          onChange={(value) => changeDate('start', value)}
          onError={setError}
        />
        <DateField
          key="end"
          label={t('m_14303aa0c4a0')}
          dateOnly
          value={end}
          disabled={busy}
          onChange={(value) => changeDate('end', value)}
          onError={setError}
        />
      </ConnectedGroup>
      <Copy muted>{t('m_84b365775dfd')}</Copy>
      {!range.valid && <ActionFeedback tone="warning" message={t('m_58f5140118ac')} />}
      <ActionPair>
        <Button
          label={t('m_8d71009f1092')}
          disabled={busy || !calendar || !ready || !range.valid}
          onPress={() => void load()}
        />
        {!iosReminders && calendar && loaded && resultKey === filterKey && (
          <Button
            label={t('m_3843add32c04')}
            variant="secondary"
            disabled={busy || !range.valid || !ready}
            onPress={() =>
              router.push({
                pathname: '/calendar-import-all',
                params: {
                  ...params,
                  calendarId: calendar.id,
                  from: range.from,
                  until: range.until,
                  managedHistory: rawParams.managedHistory,
                },
              } as Href)
            }
          />
        )}
      </ActionPair>
      {!!error && <ActionFeedback message={error} tone="warning" />}
      {busy && <ActionFeedback loading message={t('m_5136714ef7f2')} />}
      {ready && loaded && resultKey === filterKey && visibleRows.length === 0 && (
        <Copy>
          {[t('m_7474f431c818'), t(visibleCursor ? 'm_c0da945b464e' : 'm_df0e214cb7cf')]
            .map((part) => part.trim())
            .join(' ')}
        </Copy>
      )}
      {!!visibleRows.length && (
        <ConnectedGroup title={t('m_8d14f6e72de8')}>
          {visibleRows.map((event) => (
            <SettingRow
              intent="navigation"
              key={event.eventId}
              icon="event"
              label={event.title || t('m_a79be2403a6c')}
              description={
                event.unsupportedReason
                  ? unsupportedCalendarReason(event.unsupportedReason)
                  : event.fields
                    ? event.fields.schedule.allDay
                      ? formatDate(
                          event.fields.schedule.eventStartMs,
                          event.fields.schedule.zoneId,
                        ) + t('m_b3d544d5d55c')
                      : scheduleDateTime(
                          event.fields.schedule.eventStartMs,
                          event.fields.schedule.zoneId,
                        )
                    : t('m_0d1b5bcb4091')
              }
              disabled={busy || !!event.unsupportedReason}
              onPress={() =>
                router.push({
                  pathname: '/calendar-review',
                  params: {
                    ...params,
                    calendarId: calendar!.id,
                    eventId: event.eventId,
                    ...(iosReminders
                      ? { expectedConnectionRevision: String(revision) }
                      : { managedHistory: rawParams.managedHistory }),
                  },
                } as Href)
              }
            />
          ))}
        </ConnectedGroup>
      )}
      {visibleCursor && (
        <Button
          label={t('m_ac8991ef0101')}
          variant="secondary"
          disabled={busy}
          onPress={() => void load(visibleCursor)}
        />
      )}
      <Sheet
        title={t('m_f2b326341a44')}
        visible={selecting}
        returnFocusRef={sourceTrigger}
        onClose={() => {
          if (!busy) setSelecting(false);
        }}
      >
        <Copy muted>{t(iosReminders ? 'ios_calendar_owned_sources' : 'm_8c7cc2cc4d98')}</Copy>
        <CalendarOwnedChoices
          items={calendars}
          selectedId={calendar?.id}
          busy={busy}
          onSelect={(row) => {
            setCalendar(row);
            setSourceRevision(revision!);
            setSelecting(false);
          }}
          onMore={calendarCursor ? () => void loadCalendars(calendarCursor) : undefined}
        />
        {!!error && <ActionFeedback message={error} tone="warning" />}
      </Sheet>
    </Page>
  );
}
