import { router, useLocalSearchParams, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import type { CalendarCommand, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarCaptureRejected, unsupportedCalendarReason } from '../domain/calendar-link';
import { calendarError } from '../domain/calendar';
import { calendarCheckFailure, calendarReviewReason, calendarSummary, currentCalendarOperations } from '../domain/calendar-presentation';
import { calendarDispositionLabel } from '../domain/calendar-managed';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { ActionFeedback, Button, ConnectedGroup, Copy, Icon, Page, QueryState } from '../ui/components';
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
  const reminder = useQuery({ queryKey: ['calendar', 'context', id], queryFn: () => engine().getCalendarContext(id), enabled: nativeAvailable });
  const links = useQuery({ queryKey: ['calendar', 'links'], queryFn: () => engine().getCalendarLinks(), enabled: nativeAvailable });
  const publications = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(), enabled: nativeAvailable });
  const operations = useQuery({ queryKey: ['calendar', 'operations'], queryFn: () => engine().getCalendarOperations(), enabled: nativeAvailable });
  const disposition = useQuery({ queryKey: ['calendar', 'disposition', id], queryFn: () => engine().getCalendarReminderDisposition(id), enabled: nativeAvailable });
  const managed = useQuery({ queryKey: ['calendar', 'managed'], queryFn: () => engine().getManagedCalendarState(), enabled: nativeAvailable });
  const item = reminder.data, link = links.data?.find(value => value.occurrenceId === id), publication = publications.data?.find(value => value.occurrenceId === id);
  const jobs = operations.data?.filter(value => value.occurrenceId === id) || [], current = currentCalendarOperations(jobs);
  const live = useRef(true), ticket = useRef(0), checkRunning = useRef(false), captured = useRef<CalendarCommand | null>(null);
  const [checking, setChecking] = useState(false), [unlinkBusy, setUnlinkBusy] = useState(false), [unlinkUnknown, setUnlinkUnknown] = useState(false), [error, setError] = useState('');
  const [preferenceAction, setPreferenceAction] = useState(false);
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
  const sync = async () => {
    if (guarded || checkRunning.current) return;
    checkRunning.current = true; setChecking(true); setError('');
    try {
      const pending = current.find(job => job.state === 'Unconfirmed');
      if (link?.syncMode === 'Manual' && pending) await engine().applyCalendarCommand({ kind: 'RetryCalendarOperation', operationId: pending.operationId });
      else await engine().syncCalendarNow(id);
      await client.invalidateQueries({ queryKey: ['calendar'] });
    }
    catch (e) { if (live.current) setError(calendarError(e)); }
    finally { checkRunning.current = false; if (live.current) setChecking(false); }
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
    'Keep the local ' + (item?.calendarSeriesId || disposition.data?.seriesId ? 'repeating family and its alerts' : 'reminder and its alert') + '. Stop linked updates. Any Google copies and their reminder settings remain unchanged.' +
    (current.some(job => job.remoteAttempted) ? '\n\nA previously sent Google update may still finish.' : ''),
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Unlink', onPress: () => void unlink() }]);
  const makeLocalOnly = async () => {
    if (!disposition.data && !captured.current || unlinkBusy || trash.isGuarded()) return;
    captured.current ??= { kind: 'SetCalendarReminderDisposition', operationId: engine().createOperationId(), occurrenceId: disposition.data!.occurrenceId,
      expectedRevision: disposition.data!.revision, disposition: 'LocalOnly' };
    setPreferenceAction(true); setUnlinkBusy(true); setError('');
    try { await engine().applyCalendarCommand(captured.current); captured.current = null; setUnlinkUnknown(false); await client.invalidateQueries({ queryKey: ['calendar'] }); }
    catch (e) { if (calendarCaptureRejected(e)) { captured.current = null; setUnlinkUnknown(false); } else setUnlinkUnknown(true); setError(calendarError(e)); }
    finally { setUnlinkBusy(false); }
  };
  const active = !!item && !item.deleted && !item.completed && !item.skipped && !link?.readOnly;
  const supported = !link || ['Unknown', 'Available'].includes(link.availability);
  return <Page compact title="Google Calendar" scrollKey={'calendar-manage:' + id}
    onBack={() => router.canGoBack() ? router.back() : item?.calendarSeriesId ? router.replace({ pathname: '/series/[id]', params: { id, seriesId: item.calendarSeriesId, ...origin } }) : router.replace({ pathname: '/reminder/[id]', params: { id, ...origin } })}>
    <QueryState loading={reminder.isLoading || links.isLoading || publications.isLoading} error={reminder.error || links.error || publications.error || operations.error}
      empty={!reminder.isLoading && !item} emptyMessage="This reminder is unavailable." onRetry={() => void client.invalidateQueries()} />
    {item && <>
      <Copy heading>{item.title}</Copy><Copy muted>{alertPresentation(item).label}</Copy>
      <Copy muted>{link?.syncMode === 'Automatic' ? 'Titles, notes and event times stay in sync. Changes that need your choice appear here.' : link && link.state !== 'Detached' ? 'Updates are manual. Review both copies to turn on automatic sync.' : 'Your reminder and alerts work independently of Google.'}</Copy>
      {(!link || link.state === 'Detached') && disposition.data && <ConnectedGroup title="Calendar preference"><View key="preference" style={{ padding: 16, gap: 12 }}>
        <Copy heading>{calendarDispositionLabel(disposition.data)}</Copy><Copy muted>{disposition.data.message}</Copy>
        {disposition.data.calendarName && <Copy>{disposition.data.calendarName}</Copy>}
        {active && disposition.data.state === 'LocalOnly' && managed.data?.calendarId && <Button label="Review Calendar sync" variant="secondary" disabled={guarded}
          onPress={() => router.push({ pathname: '/calendar-managed', params: { mode: 'setup', adoptOccurrenceId: disposition.data!.occurrenceId, ...origin } } as Href)} />}
        {active && disposition.data.state !== 'LocalOnly' && <Button label={unlinkUnknown ? 'Retry same Calendar preference' : 'Keep Local only'} variant="outlined" icon="link_off" disabled={unlinkBusy || trash.guarded}
          onPress={unlinkUnknown ? () => void makeLocalOnly() : () => confirm('Keep Local only?', 'Keep this ' + (item.calendarSeriesId || disposition.data?.seriesId ? 'whole repeating family' : 'reminder') + ' and its local alerts. Stop its queued automatic publication. Any request already sent may still finish.',
            [{ text: 'Cancel', style: 'cancel' }, { text: 'Local only', onPress: () => void makeLocalOnly() }])} />}
      </View></ConnectedGroup>}
      {link && <ConnectedGroup title="Connection"><View key="source" style={{ padding: 16, gap: 12 }}>
        <Copy heading>{calendarSummary(link, publication, jobs)}</Copy>
        <Copy>{link.accountEmail || 'Original Google account'}</Copy><Copy>{link.calendarName || 'Original source calendar'}</Copy>
        {link.successfulAtMs != null && <Copy muted>Last successful sync {scheduleDateTime(link.successfulAtMs)}</Copy>}
        {!!link.googleUpdated && Number.isFinite(Date.parse(link.googleUpdated)) && <Copy muted>Google event updated {scheduleDateTime(Date.parse(link.googleUpdated))}</Copy>}
        {link.observedAtMs != null ? <Copy muted>Last observed {scheduleDateTime(link.observedAtMs)}</Copy> : <Copy muted>No remote observation recorded. Check for changes when needed.</Copy>}
        {!!link.lastCheckErrorCode && <Copy muted>{calendarCheckFailure(link.lastCheckErrorCode)}{link.lastCheckAttemptAtMs != null ? ' Attempted ' + scheduleDateTime(link.lastCheckAttemptAtMs) : ''}</Copy>}
        {link.availability === 'Deleted' && <Copy>The Google event was deleted. Your Remilo reminder is kept; its local alert settings are unchanged.</Copy>}
        {link.availability === 'Unavailable' && <Copy>The Google event could not be accessed. This does not establish that it was deleted. Your Remilo reminder is unchanged.</Copy>}
        {link.availability === 'Unsupported' && <Copy>{unsupportedCalendarReason(link.availabilityReason)} Your Remilo reminder is unchanged.</Copy>}
        {link.requiresReview && <Copy muted>Linked updates are suspended until a fresh review is confirmed.</Copy>}
        {!!link.pauseReason && <Copy muted>{calendarReviewReason(link.pauseReason)}</Copy>}
        {link.readOnly && <Copy muted>Calendar context is read-only for this reminder. Checking does not reopen it or apply changes.</Copy>}
        {!!link.htmlLink && <Pressable accessibilityRole="button" accessibilityLabel="Open in Google Calendar" disabled={guarded}
          style={{ minHeight: 48, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          onPress={() => void Linking.openURL(link.htmlLink).catch(() => setError('The Calendar link could not be opened.'))}>
          <Icon name="open_in_new" /><View style={{ flex: 1 }}><Copy muted>Open in Google Calendar</Copy></View>
        </Pressable>}
      </View></ConnectedGroup>}
      {!!error && <ActionFeedback message={error} tone="warning" />}
      {unlinkUnknown && preferenceAction && <Button label="Retry same Calendar preference" variant="secondary" disabled={unlinkBusy} onPress={() => void makeLocalOnly()} />}
      {checking && <ActionFeedback loading message={link?.syncMode === 'Automatic' && !link.readOnly ? 'Syncing compatible Calendar changes…' : 'Checking Google Calendar…'} />}
      {link && <Button label={link.syncStatus === 'Unconfirmed' ? 'Check update result' : link.syncMode === 'Automatic' && active && !link.requiresReview && link.syncStatus !== 'Paused' && link.syncStatus !== 'Review' ? 'Sync now' : 'Check for changes'} variant="secondary" disabled={checking || guarded}
        onPress={() => void (link.syncStatus === 'Unconfirmed' || link.syncMode === 'Automatic' && active && !link.requiresReview && link.syncStatus !== 'Paused' && link.syncStatus !== 'Review' ? sync() : check())} />}
      {link && active && link.syncMode !== 'Automatic' && link.state !== 'Detached' && !current.length && <Button label="Turn on sync for this reminder" variant="secondary" disabled={checking || guarded}
        onPress={() => router.push({ pathname: '/calendar-review', params: { id, automatic: 'true', ...origin, originReminderId: id } } as Href)} />}
      {link && (link.state === 'NeedsAccess' || link.source === null) && <Button label="Review Calendar connection" variant="secondary" disabled={guarded}
        onPress={() => router.push({ pathname: '/calendar', params: { ...origin, originReminderId: id } })} />}
      {link && active && supported && (!current.length || current.every(job => job.state === 'Unconfirmed' || job.recoveryMode === 'ConfirmOutcome')) && (link.state === 'Detached' || link.requiresReview || link.differs || link.remoteDiffers || link.syncStatus === 'Review' || link.syncStatus === 'Paused' || link.syncStatus === 'Unconfirmed') && <Button
        label={link.state === 'Detached' ? 'Relink to Google Calendar' : 'Review changes'}
        disabled={checking || guarded} onPress={review} />}
      {!link && publication && <CalendarPublicationStatus publication={publication} routeParams={{ ...origin, originReminderId: id }} />}
      {current.map(job => <CalendarOperationStatus key={job.operationId} operation={job} />)}
      <Button label="Activity" variant="secondary" disabled={guarded} onPress={() => router.push({ pathname: '/activity', params: { id, ...origin } })} />
      {link && (link.state !== 'Detached' || unlinkUnknown) && <ConnectedGroup title="Linked relationship"><View key="unlink" style={{ padding: 16 }}>
        <Button label={unlinkUnknown ? 'Retry same unlink' : 'Unlink from Google Calendar'} icon="link_off" variant="outlined" disabled={unlinkBusy || trash.guarded}
          onPress={unlinkUnknown ? () => void unlink() : confirmUnlink} />
      </View></ConnectedGroup>}
      {active && !item.calendarSeriesId && link?.availability === 'Deleted' && link.state !== 'Detached' && <Button label="Move reminder to Trash" icon="delete" variant="secondary" disabled={guarded} onPress={() => setTrashItem({ ...item })} />}
      {!!item.calendarSeriesId && <Button label="Open repeat" variant="secondary" onPress={() => router.push({ pathname: '/series/[id]', params: { id, seriesId: item.calendarSeriesId, ...origin } })} />}
      <CommandRecovery action={trash} />
    </>}
    <TrashConfirmation item={trashItem} onCancel={() => setTrashItem(null)} onConfirm={() => {
      if (!trashItem || guarded) return; const saved = trashItem; setTrashItem(null);
      void trash.execute({ command: { kind: 'Delete', operationId: engine().createOperationId(), occurrenceId: saved.id, expectedRevision: saved.revision }, item: saved, success: 'Reminder moved to Trash.' });
    }} />
  </Page>;
}
