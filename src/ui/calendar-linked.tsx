import { router, type Href } from 'expo-router';
import { Linking, View } from 'react-native';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CalendarLink, CalendarLinkedOperation } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { OriginParams } from '../domain/navigation';
import { calendarOperationRetryable } from '../domain/calendar-link';
import { calendarError } from '../domain/calendar';
import { engine } from './native';
import { ActionFeedback, Button, ConnectedGroup, Copy } from './components';
import { useTimeFormatting } from './time-display';

export function CalendarOperationStatus({ operation }: { operation: CalendarLinkedOperation }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const client = useQueryClient();
  const retry = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      if (operation.state === 'NeedsAccess') await engine().authorizeCalendar(operation.operationId);
      else await engine().applyCalendarCommand({ kind: 'RetryCalendarOperation', operationId: operation.operationId });
      await client.invalidateQueries({ queryKey: ['calendar'] });
    } catch (e) { setError(calendarError(e)); } finally { setBusy(false); }
  };
  return <ConnectedGroup title="Calendar operation"><View key="status" style={{ padding: 16, gap: 12 }}>
    {!!operation.title && !operation.readOnly && <Copy heading>{operation.title}</Copy>}
    <Copy heading>{operation.state === 'Confirmed' ? 'Confirmed' : operation.localApplied ? 'Local change saved' : 'Calendar request saved'}</Copy>
    <Copy muted>{operation.calendarName || 'Original Calendar destination'}</Copy>
    {operation.localApplied && !operation.readOnly && <Copy>Local save result: {operation.localStatus === 'Scheduled' ? 'Alert was scheduled' : operation.localStatus === 'Blocked' ? 'Alert was blocked' : operation.localStatus === 'Pending' ? 'Scheduling was pending' : 'Saved'}</Copy>}
    <Copy>{operation.message}</Copy>
    {calendarOperationRetryable(operation) && <Button label={operation.state === 'NeedsAccess' ? 'Authorize and retry' : 'Retry same operation'} variant="secondary" disabled={busy} onPress={() => void retry()} />}
    {busy && <ActionFeedback loading message="Continuing saved operation…" />}
    {!!error && <ActionFeedback message={error} tone="warning" />}
  </View></ConnectedGroup>;
}
export function CalendarLinkStatus({ link, routeParams }: { link: CalendarLink; routeParams: OriginParams }) {
  const { scheduleDateTime } = useTimeFormatting();
  const [error, setError] = useState('');
  const open = () => router.push({ pathname: '/calendar-review', params: { id: link.occurrenceId, ...routeParams } } as Href);
  return <ConnectedGroup title="Google Calendar"><View key="link" style={{ padding: 16, gap: 12 }}>
    <Copy heading>{link.state === 'Detached' ? 'Published/imported copy · unlinked' : 'Manually linked'}</Copy>
    <Copy muted>{link.calendarName || 'Original Calendar destination'}</Copy>
    <Copy>{link.message}</Copy>
    <Copy muted>{link.checkedAtMs ? 'Last checked ' + scheduleDateTime(link.checkedAtMs) : 'Not checked yet'}</Copy>
    {link.differs && <Copy muted>This reminder differs from the last confirmed Calendar values.</Copy>}
    {!link.readOnly && <Button label={link.state === 'Detached' ? 'Enable linked updates' : link.differs ? 'Review changes' : 'Check for changes'} variant="secondary" onPress={open} />}
    {!!link.htmlLink && <Button label="Open in Google Calendar" variant="secondary" onPress={() => void Linking.openURL(link.htmlLink).catch(() => setError('The Calendar link could not be opened.'))} />}
    {link.readOnly && <Copy muted>Calendar context is read-only for this reminder.</Copy>}
    {!!error && <ActionFeedback message={error} tone="warning" />}
  </View></ConnectedGroup>;
}
