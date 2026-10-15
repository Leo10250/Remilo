import { useState } from 'react';
import { Linking, View } from 'react-native';
import type { CalendarPublication } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { canRetryPublication } from '../domain/calendar';
import type { OriginParams } from '../domain/navigation';
import { useCalendarAction, useCalendarAuthorization } from './calendar-sync';
import { ActionFeedback, Button, ConnectedGroup, Copy, Status } from './components';
import { useAppearanceHold } from './theme';
import { router, type Href } from 'expo-router';

export function CalendarPublicationStatus({ publication, routeParams = {} }: { publication: CalendarPublication; routeParams?: OriginParams }) {
  const action = useCalendarAction(), auth = useCalendarAuthorization(), [error, setError] = useState('');
  const busy = action.busy || auth.waiting;
  useAppearanceHold(busy);
  const retry = async () => {
    if (busy) return; setError('');
    if (publication.state === 'NeedsAccess') await auth.start(publication.operationId);
    else await action.run({ kind: 'RetryPublication', operationId: publication.operationId });
  };
  return <ConnectedGroup title="Google Calendar"><View key="publication" style={{ padding: 16, gap: 12 }}>
    <Status tone={['Failed', 'NeedsAccess'].includes(publication.state) ? 'danger' : ['Conflict', 'Unconfirmed'].includes(publication.state) ? 'warning' : publication.state === 'Published' ? 'success' : 'muted'} label={{ Waiting: 'Waiting to publish', Publishing: 'Publishing…', Unconfirmed: 'Publication not confirmed', NeedsAccess: 'Google access needed', Failed: 'Publication needs attention', Conflict: 'Calendar conflict', Cancelled: 'Publication cancelled', Published: 'Published once' }[publication.state]} />
    <Copy muted>{publication.calendarName || 'Original Calendar destination'}{publication.email ? ` · ${publication.email}` : ''}</Copy>
    {publication.state !== 'Published' && <Copy muted size={14}>{publication.state === 'Unconfirmed' ? 'The event may already exist in Google. Check the saved request before publishing another copy.' : publication.state === 'NeedsAccess' ? 'Reconnect the original Google account to continue publishing.' : publication.state === 'Cancelled' ? 'This publication is no longer active.' : 'Your local reminder and alert are kept while this publication is checked.'}</Copy>}
    {publication.differs && publication.state === 'Published' && <Copy muted>The published copy differs from this reminder. Later edits are not synchronized.</Copy>}
    {!!(error || action.error) && <ActionFeedback message={error || action.error} tone="warning" />}
    {!!auth.message && <ActionFeedback message={auth.message} tone={auth.tone} loading={auth.waiting} />}
    {canRetryPublication(publication) && <Button label={action.unknown ? 'Retry same request' : publication.state === 'NeedsAccess' ? 'Reconnect Google' : publication.readOnly || publication.state === 'Unconfirmed' ? 'Check publication result' : 'Try publishing again'} variant="secondary" disabled={busy} onPress={() => void retry()} />}
    {publication.state === 'Published' && !!publication.htmlLink && <Button label="Open in Google Calendar" variant="secondary" onPress={() => {
      void Linking.openURL(publication.htmlLink).catch(() => setError('The Calendar link could not be opened.'));
    }} />}
    {publication.state === 'Published' && !publication.readOnly && <Button label="Enable linked updates" variant="secondary"
      onPress={() => router.push({ pathname: '/calendar-review', params: { ...routeParams, id: publication.occurrenceId } } as Href)} />}
  </View></ConnectedGroup>;
}
