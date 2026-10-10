import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { CalendarCommand } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { publicationCommand, calendarError } from '../domain/calendar';
import { ActionFeedback, BottomActionBar, Button, ConnectedGroup, Copy, Page, QueryState } from '../ui/components';
import { scheduleDateTime } from '../domain/presentation';
import { civilAt } from '../domain/time';
import { engine, nativeAvailable } from '../ui/native';
import { CalendarPublicationStatus } from '../ui/calendar-publication';
import { useAppearanceHold } from '../ui/theme';

export default function CalendarPublish() {
  const params = useLocalSearchParams<OriginParams & { id: string }>(), routeParams = retainedOriginParams(params), id = params.id;
  const client = useQueryClient();
  const jobs = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(), enabled: nativeAvailable });
  const publication = jobs.data?.find((value) => value.occurrenceId === id && value.state !== 'Cancelled');
  const preview = useQuery({ queryKey: ['calendar', 'preview', id], queryFn: () => engine().previewCalendarPublication(id), enabled: nativeAvailable && !!jobs.data && !publication });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [uncertain, setUncertain] = useState(false);
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
  return <Page title={publication ? 'Calendar publication' : 'Publish to Google Calendar'} onBack={back}
    footer={!publication && preview.data ? <BottomActionBar><Button label={uncertain ? 'Retry same publication' : 'Publish'} disabled={busy} onPress={() => void publish()} />
      <Button label="Cancel" variant="secondary" disabled={busy || uncertain} onPress={back} /></BottomActionBar> : undefined}>
    <QueryState loading={jobs.isLoading || preview.isLoading && !preview.data} error={jobs.error || (!publication ? preview.error : undefined)} onRetry={() => void client.invalidateQueries({ queryKey: ['calendar'] })} />
    {publication ? <CalendarPublicationStatus publication={publication} /> : preview.data && <>
      <ConnectedGroup title="Calendar copy"><View key="review" style={{ padding: 16, gap: 12 }}>
        <Copy heading>{preview.data.title}</Copy><Copy>{preview.data.notes || 'No notes'}</Copy>
        <Copy>{preview.data.allDay ? `${civilAt(preview.data.eventStartMs, preview.data.zoneId).slice(0, 10)} → ${civilAt(preview.data.eventEndMs, preview.data.zoneId).slice(0, 10)} (exclusive end date)` : `${scheduleDateTime(preview.data.eventStartMs, preview.data.zoneId)} – ${scheduleDateTime(preview.data.eventEndMs, preview.data.zoneId)}`}</Copy>
        <Copy muted>{preview.data.allDay ? 'All day · ' : ''}{preview.data.zoneId}</Copy>
        <Copy>{preview.data.calendarName} · {preview.data.email}</Copy>
      </View></ConnectedGroup>
      <Copy muted>Title, notes and event times will be sent to this calendar. Google Calendar reminders are disabled. Due, completion and alert controls stay in Remilo. Later edits are not synchronized.</Copy>
      {preview.data.pinsZone && <Copy muted>This reminder will keep {preview.data.zoneId} when you travel. Its current event, due and alert instants stay the same.</Copy>}
    </>}
    {!!error && !publication && <ActionFeedback message={error} tone="warning" />}
    {uncertain && !publication && <Copy muted>The request is not confirmed. Retry its captured operation; do not start a replacement publication. Saved jobs remain available after leaving this page.</Copy>}
    {busy && !publication && <ActionFeedback loading message="Capturing publication…" />}
    {!publication && !preview.data && <Button label="Open Calendar settings" variant="secondary" onPress={() => router.push({ pathname: '/calendar', params: { ...routeParams, originReminderId: id } })} />}
  </Page>;
}
