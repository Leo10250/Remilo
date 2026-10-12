import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { CalendarPublication } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { canRetryPublication, calendarError } from '../domain/calendar';
import type { OriginParams } from '../domain/navigation';
import { engine } from './native';
import { ActionFeedback, Button, ConnectedGroup, Copy } from './components';
import { useAppearanceHold } from './theme';
import { router, type Href } from 'expo-router';

export function CalendarPublicationStatus({ publication, routeParams = {} }: { publication: CalendarPublication; routeParams?: OriginParams }) {
  const client = useQueryClient(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useAppearanceHold(busy);
  const retry = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      if (publication.state === 'NeedsAccess') await engine().authorizeCalendar(publication.operationId);
      else await engine().applyCalendarCommand({ kind: 'RetryPublication', operationId: publication.operationId });
      await client.invalidateQueries({ queryKey: ['calendar'] });
    } catch (error) { setError(calendarError(error)); } finally { setBusy(false); }
  };
  return <ConnectedGroup title="Google Calendar"><View key="publication" style={{ padding: 16, gap: 12 }}>
    <Copy heading>{{ Waiting: 'Ready to publish', Publishing: 'Publishing…', Unconfirmed: 'Publication not confirmed', NeedsAccess: 'Google access needed', Failed: 'Publication needs attention', Conflict: 'Calendar conflict', Cancelled: 'Publication cancelled', Published: 'Published' }[publication.state]}</Copy>
    <Copy muted>{publication.calendarName || 'Original Calendar destination'}{publication.email ? ` · ${publication.email}` : ''}</Copy>
    <Copy>{publication.message}</Copy>
    {publication.differs && publication.state === 'Published' && <Copy muted>The published copy differs from this reminder. Later edits are not synchronized.</Copy>}
    {!!error && <ActionFeedback message={error} tone="warning" />}
    {canRetryPublication(publication) && <Button label={publication.state === 'NeedsAccess' ? 'Authorize and retry' : publication.readOnly ? 'Confirm previous publication' : 'Retry same publication'} variant="secondary" disabled={busy} onPress={() => void retry()} />}
    {publication.state === 'Published' && !!publication.htmlLink && <Button label="Open in Google Calendar" variant="secondary" onPress={() => {
      void Linking.openURL(publication.htmlLink).catch(() => setError('The Calendar link could not be opened.'));
    }} />}
    {publication.state === 'Published' && !publication.readOnly && <Button label="Enable linked updates" variant="secondary"
      onPress={() => router.push({ pathname: '/calendar-review', params: { ...routeParams, id: publication.occurrenceId } } as Href)} />}
  </View></ConnectedGroup>;
}
