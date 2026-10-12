import { router, useLocalSearchParams, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import type { CalendarCommand, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarCaptureRejected, unsupportedCalendarReason } from '../domain/calendar-link';
import { calendarError } from '../domain/calendar';
import { calendarCheckFailure, calendarSummary, currentCalendarOperations } from '../domain/calendar-presentation';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { ActionFeedback, Button, ConnectedGroup, Copy, Disclosure, Page, QueryState } from '../ui/components';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { CalendarOperationStatus } from '../ui/calendar-linked';
import { CalendarPublicationStatus } from '../ui/calendar-publication';
import { engine, nativeAvailable } from '../ui/native';
import { CommandRecovery, notifyTrash, useCapturedCommand } from '../ui/navigation';
import { TrashConfirmation } from '../ui/trash-confirmation';
import { useAppearanceHold } from '../ui/theme';
import { useTimeFormatting } from '../ui/time-display';

export default function CalendarManagement() {
  const params = useLocalSearchParams<OriginParams & { id: string }>(), id = params.id;
  const origin = retainedOriginParams(params), client = useQueryClient(), confirm = useAppearanceConfirmation();
  const { scheduleDateTime, alertPresentation } = useTimeFormatting();
  const reminder = useQuery({ queryKey: ['reminder', id], queryFn: () => engine().getOccurrence(id), enabled: nativeAvailable });
  const links = useQuery({ queryKey: ['calendar', 'links'], queryFn: () => engine().getCalendarLinks(), enabled: nativeAvailable });
  const publications = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(), enabled: nativeAvailable });
  const operations = useQuery({ queryKey: ['calendar', 'operations'], queryFn: () => engine().getCalendarOperations(), enabled: nativeAvailable });
  const item = reminder.data, link = links.data?.find(value => value.occurrenceId === id), publication = publications.data?.find(value => value.occurrenceId === id);
  const jobs = operations.data?.filter(value => value.occurrenceId === id) || [], current = currentCalendarOperations(jobs);
  const history = jobs.filter(job => !current.includes(job));
  const live = useRef(true), ticket = useRef(0), checkRunning = useRef(false), captured = useRef<CalendarCommand | null>(null);
  const [checking, setChecking] = useState(false), [unlinkBusy, setUnlinkBusy] = useState(false), [unlinkUnknown, setUnlinkUnknown] = useState(false), [error, setError] = useState('');
  const [trashItem, setTrashItem] = useState<Occurrence | null>(null);
  useEffect(() => { const reads = ticket; live.current = true; return () => { live.current = false; reads.current++; }; }, [id]);
  const trash = useCapturedCommand((job, result) => {
    if (result.occurrence?.deleted && job.item) {
      notifyTrash(job.item, result);
      router.dismissTo(secondaryOriginRoute({ ...origin, originReminderId: undefined }));
      return false;
    }
  });
  const guarded = trash.guarded || unlinkBusy || unlinkUnknown;
  useAppearanceHold(guarded);
  usePreventRemove(guarded, () => confirm('Calendar action not confirmed', 'Wait for this action or retry the same captured action before leaving.'));
  const review = () => router.push({ pathname: '/calendar-review', params: { id, ...origin, originReminderId: id } } as Href);
  const check = async () => {
    if (!link || guarded || checkRunning.current) return;
    const read = ++ticket.current; checkRunning.current = true; setChecking(true); setError('');
    try {
      const next = await engine().checkCalendarLink(id);
      if (live.current && read === ticket.current) client.setQueryData(['calendar', 'links'], (old: typeof links.data) => old?.map(value => value.occurrenceId === id ? next : value) || [next]);
      await client.invalidateQueries({ queryKey: ['calendar'] });
    } catch (e) { if (live.current && read === ticket.current) setError(calendarError(e)); }
    finally { checkRunning.current = false; if (live.current && read === ticket.current) setChecking(false); }
  };
  const unlink = async () => {
    if (!link || unlinkBusy || trash.isGuarded()) return;
    captured.current ??= { kind: 'UnlinkCalendar', occurrenceId: id, operationId: engine().createOperationId(), expectedLinkRevision: link.revision };
    setUnlinkBusy(true); setError('');
    try {
      await engine().applyCalendarCommand(captured.current); captured.current = null; setUnlinkUnknown(false);
      await client.invalidateQueries({ queryKey: ['calendar'] });
    } catch (e) { if (calendarCaptureRejected(e)) { captured.current = null; setUnlinkUnknown(false); } else setUnlinkUnknown(true); setError(calendarError(e)); }
    finally { setUnlinkBusy(false); }
  };
  const confirmUnlink = () => confirm('Unlink from Google Calendar?',
    'Keep this reminder and the Google event. Stop linked updates between them. Google reminder settings will not be changed.' +
    (current.some(job => job.remoteAttempted) ? '\n\nA previously sent Google update may still finish.' : ''),
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Unlink', onPress: () => void unlink() }]);
  const active = !!item && !item.deleted && !item.completed && !item.skipped;
  const supported = !link || ['Unknown', 'Available'].includes(link.availability);
  return <Page compact title="Google Calendar" scrollKey={'calendar-manage:' + id}
    onBack={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/reminder/[id]', params: { id, ...origin } })}>
    <QueryState loading={reminder.isLoading || links.isLoading || publications.isLoading} error={reminder.error || links.error || publications.error || operations.error}
      empty={!reminder.isLoading && !item} emptyMessage="This reminder is unavailable." onRetry={() => void client.invalidateQueries()} />
    {item && <>
      <Copy heading>{item.title}</Copy><Copy muted>{alertPresentation(item).label}</Copy>
      <Copy>Changes are applied only after you review and confirm.</Copy>
      {link && <ConnectedGroup title="Connection"><View key="source" style={{ padding: 16, gap: 12 }}>
        <Copy heading>{calendarSummary(link, publication, jobs)}</Copy>
        <Copy>{link.accountEmail || 'Original Google account'}</Copy><Copy>{link.calendarName || 'Original source calendar'}</Copy>
        {link.observedAtMs != null ? <Copy muted>Last observed {scheduleDateTime(link.observedAtMs)}</Copy> : <Copy muted>No remote observation recorded. Check for changes when needed.</Copy>}
        {!!link.lastCheckErrorCode && <Copy muted>{calendarCheckFailure(link.lastCheckErrorCode)}{link.lastCheckAttemptAtMs != null ? ' Attempted ' + scheduleDateTime(link.lastCheckAttemptAtMs) : ''}</Copy>}
        {link.availability === 'Deleted' && <Copy>The Google event was deleted. Your Remilo reminder is kept; its local alert settings are unchanged.</Copy>}
        {link.availability === 'Unavailable' && <Copy>The Google event could not be accessed. This does not establish that it was deleted. Your Remilo reminder is unchanged.</Copy>}
        {link.availability === 'Unsupported' && <Copy>{unsupportedCalendarReason(link.availabilityReason)} Your Remilo reminder is unchanged.</Copy>}
        {link.requiresReview && <Copy muted>Linked updates are suspended until a fresh review is confirmed.</Copy>}
        {link.readOnly && <Copy muted>Calendar context is read-only for this reminder. Checking does not reopen it or apply changes.</Copy>}
      </View></ConnectedGroup>}
      {!!error && <ActionFeedback message={error} tone="warning" />}
      {checking && <ActionFeedback loading message="Checking Google Calendar. Your reminder is unchanged." />}
      {link && <Button label="Check for changes" variant="secondary" disabled={checking || guarded} onPress={() => void check()} />}
      {link && (link.state === 'NeedsAccess' || link.source === null) && <Button label="Review Calendar connection" variant="secondary" disabled={guarded}
        onPress={() => router.push({ pathname: '/calendar', params: { ...origin, originReminderId: id } })} />}
      {link && active && supported && !current.length && (link.state === 'Detached' || link.requiresReview || link.differs || link.remoteDiffers) && <Button
        label={link.state === 'Detached' ? 'Relink to Google Calendar' : link.requiresReview ? 'Review linked updates' : 'Review changes'} variant="secondary"
        disabled={checking || guarded} onPress={review} />}
      {!link && publication && <CalendarPublicationStatus publication={publication} routeParams={{ ...origin, originReminderId: id }} />}
      {current.map(job => <CalendarOperationStatus key={job.operationId} operation={job} />)}
      {!!history.length && <Disclosure title="Previous Calendar operations" summary={history.length + ' recorded outcomes'}>
        {history.map(job => <CalendarOperationStatus key={job.operationId} operation={job} />)}
      </Disclosure>}
      {!!link?.htmlLink && <Button label="Open in Google Calendar" variant="secondary" disabled={guarded} onPress={() => void Linking.openURL(link.htmlLink).catch(() => setError('The Calendar link could not be opened.'))} />}
      {link && (link.state !== 'Detached' || unlinkUnknown) && <Button label={unlinkUnknown ? 'Retry same unlink' : 'Unlink from Google Calendar'} variant="secondary" disabled={unlinkBusy || trash.guarded}
        onPress={unlinkUnknown ? () => void unlink() : confirmUnlink} />}
      {active && link?.availability === 'Deleted' && link.state !== 'Detached' && <Button label="Move reminder to Trash" icon="delete" variant="secondary" disabled={guarded} onPress={() => setTrashItem({ ...item })} />}
      <CommandRecovery action={trash} />
    </>}
    <TrashConfirmation item={trashItem} onCancel={() => setTrashItem(null)} onConfirm={() => {
      if (!trashItem || guarded) return; const saved = trashItem; setTrashItem(null);
      void trash.execute({ command: { kind: 'Delete', operationId: engine().createOperationId(), occurrenceId: saved.id, expectedRevision: saved.revision }, item: saved, success: 'Reminder moved to Trash.' });
    }} />
  </Page>;
}
