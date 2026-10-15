import { router, useLocalSearchParams, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import type { CalendarCommand, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarCaptureRejected, unsupportedCalendarReason } from '../domain/calendar-link';
import { calendarError } from '../domain/calendar';
import { calendarCheckFailure, currentCalendarOperations } from '../domain/calendar-presentation';
import { calendarDispositionLabel } from '../domain/calendar-managed';
import { calendarLinkStatus } from '../domain/calendar-ux';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { ActionFeedback, Button, ConnectedGroup, Copy, Disclosure, Icon, Page, QueryState, SettingRow, Status } from '../ui/components';
import { CalendarOperationProgress, CalendarStatusCard, useCalendarSync, useCalendarAction } from '../ui/calendar-sync';
import { typography } from '../ui/tokens';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { CalendarOperationStatus } from '../ui/calendar-linked';
import { CalendarPublicationStatus } from '../ui/calendar-publication';
import { engine, nativeAvailable } from '../ui/native';
import { CommandRecovery, notifyTrash, useCapturedCommand } from '../ui/navigation';
import { TrashConfirmation } from '../ui/trash-confirmation';
import { useAppearanceHold } from '../ui/theme';
import { useTimeFormatting } from '../ui/time-display';

export default function CalendarManagement() {
  const calendarAction = useCalendarAction();
  const params = useLocalSearchParams<OriginParams & { id: string }>(), id = params.id;
  const origin = retainedOriginParams(params), client = useQueryClient(), confirm = useAppearanceConfirmation();
  const { scheduleDateTime, detailSchedulePresentation } = useTimeFormatting();
  const reminder = useQuery({ queryKey: ['calendar', 'context', id], queryFn: () => engine().getCalendarContext(id), enabled: nativeAvailable });
  const links = useQuery({ queryKey: ['calendar', 'links'], queryFn: () => engine().getCalendarLinks(), enabled: nativeAvailable });
  const publications = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(), enabled: nativeAvailable });
  const operations = useQuery({ queryKey: ['calendar', 'operations'], queryFn: () => engine().getCalendarOperations(), enabled: nativeAvailable });
  const disposition = useQuery({ queryKey: ['calendar', 'disposition', id], queryFn: () => engine().getCalendarReminderDisposition(id), enabled: nativeAvailable });
  const managed = useQuery({ queryKey: ['calendar', 'managed'], queryFn: () => engine().getManagedCalendarState(), enabled: nativeAvailable });
  const item = reminder.data, link = links.data?.find(value => value.occurrenceId === id), publication = publications.data?.find(value => value.occurrenceId === id);
  const jobs = operations.data?.filter(value => value.occurrenceId === id) || [], current = currentCalendarOperations(jobs);
  const syncRequest = useCalendarSync({ kind: 'Association', occurrenceId: id }, link?.syncRequestId);
  const live = useRef(true), ticket = useRef(0), checkRunning = useRef(false), captured = useRef<CalendarCommand | null>(null);
  const [checking, setChecking] = useState(false), [unlinkBusy, setUnlinkBusy] = useState(false), [unlinkUnknown, setUnlinkUnknown] = useState(false), [error, setError] = useState('');
  const [preferenceAction, setPreferenceAction] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [trashItem, setTrashItem] = useState<Occurrence | null>(null);
  useEffect(() => { const reads = ticket; live.current = true; return () => { live.current = false; reads.current++; }; }, [id]);
  const trash = useCapturedCommand((job, result) => {
    if (result.occurrence?.deleted && job.item) {
      notifyTrash(job.item, result);
      router.dismissTo(secondaryOriginRoute({ ...origin, originReminderId: undefined }));
      return false;
    }
  });
  const guarded = trash.guarded || unlinkBusy || unlinkUnknown || syncRequest.busy || syncRequest.unknown;
  useAppearanceHold(guarded);
  usePreventRemove(guarded, () => confirm('Calendar action not confirmed', 'Wait for this action or retry the same request before leaving.'));
  const review = () => router.push({ pathname: '/calendar-review', params: { id, ...origin, originReminderId: id } } as Href);
  const check = async () => {
    if (!link || guarded || checkRunning.current) return;
    const read = ++ticket.current; checkRunning.current = true; setChecking(true); setError('');
    try {
      const next = await engine().checkCalendarLink(id);
      if (live.current && read === ticket.current) {
        client.setQueryData(['calendar', 'links'], (old: typeof links.data) => old?.map(value => value.occurrenceId === id ? next : value) || [next]);
        setFeedback(next.lastCheckErrorCode ? calendarCheckFailure(next.lastCheckErrorCode) : next.remoteDiffers || next.differs ? 'Changes found. Review both copies before applying them.' : next.availability === 'Available' ? 'Check finished. No Calendar changes found.' : 'Check finished. Review the Calendar status.');
      }
      await client.invalidateQueries({ queryKey: ['calendar'] });
    } catch (e) { if (live.current && read === ticket.current) setError(calendarError(e)); }
    finally { checkRunning.current = false; if (live.current && read === ticket.current) setChecking(false); }
  };
  const inspect = async () => {
    if (guarded || checkRunning.current) return;
    checkRunning.current = true; setChecking(true); setError('');
    try {
      const pending = current.find(job => job.state === 'Unconfirmed');
      if (link?.syncMode === 'Manual' && pending) await calendarAction.submit({ kind: 'RetryCalendarOperation', operationId: pending.operationId });
      else await syncRequest.start();
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
      await calendarAction.submit(captured.current); captured.current = null; setUnlinkUnknown(false);
      setFeedback('Unlinked. Both copies and your local alerts are kept.');
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
    try { await calendarAction.submit(captured.current); captured.current = null; setUnlinkUnknown(false); setFeedback('Kept Local only. Local alerts continue.'); await client.invalidateQueries({ queryKey: ['calendar'] }); }
    catch (e) { if (calendarCaptureRejected(e)) { captured.current = null; setUnlinkUnknown(false); } else setUnlinkUnknown(true); setError(calendarError(e)); }
    finally { setUnlinkBusy(false); }
  };
  const active = !!item && !item.deleted && !item.completed && !item.skipped && !link?.readOnly;
  const supported = !link || ['Unknown', 'Available'].includes(link.availability);
  const status = link ? calendarLinkStatus(link, jobs, managed.data) : null;
  const timing = item ? detailSchedulePresentation(item) : null;
  return <Page compact title="Calendar sync" scrollKey={'calendar-manage:' + id}
    onBack={() => router.canGoBack() ? router.back() : item?.calendarSeriesId ? router.replace({ pathname: '/series/[id]', params: { id, seriesId: item.calendarSeriesId, ...origin } }) : router.replace({ pathname: '/reminder/[id]', params: { id, ...origin } })}>
    <QueryState loading={reminder.isLoading || links.isLoading || publications.isLoading} error={reminder.error || links.error || publications.error || operations.error}
      empty={!reminder.isLoading && !item} emptyMessage="This reminder is unavailable." onRetry={() => void client.invalidateQueries()} />
    {item && <>
      <Copy heading size={typography.title}>{item.title}</Copy>
      {timing && <View style={{ gap: 4 }}><View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}><Icon name={item.mode === 'None' ? 'event' : 'alarm'} /><View style={{ flex: 1, gap: 4 }}><Copy muted size={14}>{timing.label}</Copy><Copy heading size={18}>{timing.value}</Copy></View></View>
        {!!timing.supporting && <Status label={timing.supporting} tone={item.deliveryState === 'Blocked' ? 'danger' : 'muted'} />}</View>}
      {status && <CalendarStatusCard {...status} label={status.action === 'Connect' ? 'Reconnect Google' : status.action === 'Setup' ? 'Review setup' : status.action === 'Inspect' ? 'Check update result' : status.action === 'Review' ? 'Review changes' : status.action === 'Activate' && active ? 'Turn on automatic sync' : undefined}
        action={status.action === 'Connect' || status.action === 'Setup' ? () => router.push({ pathname: '/calendar', params: { ...origin, originReminderId: id } }) : status.action === 'Inspect' ? () => void inspect() : status.action === 'Review' ? review : status.action === 'Activate' && active ? () => router.push({ pathname: '/calendar-review', params: { id, automatic: 'true', ...origin, originReminderId: id } } as Href) : undefined}
        busy={checking || guarded}>
        {status.title === 'Automatic sync on' && link?.successfulAtMs != null && <Copy muted size={14}>Last synced {scheduleDateTime(link.successfulAtMs)}</Copy>}
      </CalendarStatusCard>}
      {(!link || link.state === 'Detached') && disposition.data && <ConnectedGroup title="Calendar preference"><View key="preference" style={{ padding: 16, gap: 12 }}>
        <Copy heading>{calendarDispositionLabel(disposition.data)}</Copy><Copy muted>{disposition.data.message}</Copy>
        {disposition.data.calendarName && <Copy>{disposition.data.calendarName}</Copy>}
        {active && disposition.data.state === 'LocalOnly' && managed.data?.calendarId && <Button label="Review Calendar sync" variant="secondary" disabled={guarded}
          onPress={() => router.push({ pathname: '/calendar-managed', params: { mode: 'setup', adoptOccurrenceId: disposition.data!.occurrenceId, ...origin } } as Href)} />}
        {active && disposition.data.state !== 'LocalOnly' && <Button label={unlinkUnknown ? 'Retry same Calendar preference' : 'Keep Local only'} variant="outlined" icon="link_off" disabled={unlinkBusy || trash.guarded}
          onPress={unlinkUnknown ? () => void makeLocalOnly() : () => confirm('Keep Local only?', 'Keep this ' + (item.calendarSeriesId || disposition.data?.seriesId ? 'whole repeating family' : 'reminder') + ' and its local alerts. Stop its queued automatic publication. Any request already sent may still finish.',
            [{ text: 'Cancel', style: 'cancel' }, { text: 'Local only', onPress: () => void makeLocalOnly() }])} />}
      </View></ConnectedGroup>}
      {link && <ConnectedGroup><View key="source" style={{ padding: 16, gap: 4 }}>
        <Copy>{link.calendarName || 'Original source calendar'}</Copy><Copy muted size={14}>{link.accountEmail || 'Original Google account'}</Copy>
        {!!link.htmlLink && <Pressable accessibilityRole="button" accessibilityLabel="Open in Google Calendar" disabled={guarded}
          style={{ minHeight: 48, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          onPress={() => void Linking.openURL(link.htmlLink).catch(() => setError('The Calendar link could not be opened.'))}>
          <Icon name="open_in_new" /><View style={{ flex: 1 }}><Copy muted>Open in Google Calendar</Copy></View>
        </Pressable>}
      </View></ConnectedGroup>}
      {!!error && <ActionFeedback message={error} tone="warning" />}
      {!!feedback && <ActionFeedback message={feedback} />}
      {!!syncRequest.error && <ActionFeedback message={syncRequest.error} tone="warning" />}
      {syncRequest.unknown && <Button label="Retry same request" variant="secondary" onPress={() => void syncRequest.start()} />}
      {unlinkUnknown && preferenceAction && <Button label="Retry same Calendar preference" variant="secondary" disabled={unlinkBusy} onPress={() => void makeLocalOnly()} />}
      {checking && <ActionFeedback loading message={link?.syncMode === 'Automatic' && !link.readOnly ? 'Syncing compatible Calendar changes…' : 'Checking Google Calendar…'} />}
      {syncRequest.showResult && syncRequest.requestId && status?.tone === 'muted' && status.action === 'None' && <CalendarOperationProgress operationId={syncRequest.requestId} onAction={value => router.push({ pathname: value.action === 'Connect' ? '/calendar' : '/calendar-reviews', params: origin })} />}
      {link && <ConnectedGroup><Disclosure title="Sync details" icon="info" forceOpen={checking || syncRequest.working || syncRequest.unknown}>
        <Copy muted size={14}>{link.calendarName} · {link.accountEmail}</Copy><Copy muted size={14}>{item.zoneId || 'Device time zone'}</Copy>
        {link.successfulAtMs != null && <Copy muted size={14}>Last successful agreement {scheduleDateTime(link.successfulAtMs)}</Copy>}
        {link.observedAtMs != null && <Copy muted size={14}>Last Google observation {scheduleDateTime(link.observedAtMs)}</Copy>}
        {!!link.googleUpdated && Number.isFinite(Date.parse(link.googleUpdated)) && <Copy muted size={14}>Google event updated {scheduleDateTime(Date.parse(link.googleUpdated))}</Copy>}
        {link.lastCheckAttemptAtMs != null && <Copy muted size={14}>Latest check {scheduleDateTime(link.lastCheckAttemptAtMs)}</Copy>}
        {!!link.lastCheckErrorCode && <Copy muted size={14}>{calendarCheckFailure(link.lastCheckErrorCode)}</Copy>}
        <Copy muted size={14}>Linked titles, notes and event times stay in sync. Local alerts, Done, Skip and Snooze remain in Remilo.</Copy>
        {link.readOnly && <Copy muted size={14}>Read-only context. Checking doesn’t reopen or change this reminder.</Copy>}
        {link.availability === 'Unsupported' && <Copy muted size={14}>{unsupportedCalendarReason(link.availabilityReason)}</Copy>}
        <Button label={link.syncMode === 'Automatic' && active && supported ? 'Sync now' : 'Check for changes'} variant="secondary" disabled={checking || guarded || syncRequest.working}
          onPress={() => void (link.syncMode === 'Automatic' && active && supported ? syncRequest.start() : check())} />
        <SettingRow icon="history" label="Recent Calendar changes" onPress={() => router.push({ pathname: '/activity', params: { id, filter: 'calendar', ...origin } })} />
      </Disclosure></ConnectedGroup>}
      {link?.state === 'Detached' && active && <Button label="Relink to Google Calendar" variant="secondary" disabled={guarded} onPress={review} />}
      {!link && publication && <CalendarPublicationStatus publication={publication} routeParams={{ ...origin, originReminderId: id }} />}
      {current.filter(() => status?.action === 'None' || !link).map(job => <CalendarOperationStatus key={job.operationId} operation={job} />)}
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
