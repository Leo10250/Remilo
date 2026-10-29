import { useLocalizedState, useTranslation } from '../localization/react';

import { Linking, View } from 'react-native';
import { useState } from 'react';
import type { CalendarPublication } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { canRetryPublication, publicationCheckFeedback } from '../domain/calendar';
import type { OriginParams } from '../domain/navigation';
import { useCalendarAction, useCalendarAuthorization } from './calendar-sync';
import { ActionFeedback, Button, ConnectedGroup, Copy, Status } from './components';
import { useAppearanceHold } from './theme';
import { router, type Href } from 'expo-router';

export function CalendarPublicationStatus({ publication, routeParams = {} }: { publication: CalendarPublication; routeParams?: OriginParams }) {
  'use no memo';
  const t = useTranslation();
  const action = useCalendarAction(), auth = useCalendarAuthorization(), [error, setError] = useLocalizedState('');
  const [checked, setChecked] = useState(false);
  const busy = action.busy || auth.waiting || publication.state === 'Publishing';
  const result = publicationCheckFeedback(publication);
  useAppearanceHold(busy);
  const retry = async () => {
    if (busy) return; setError(''); setChecked(false);
    if (publication.state === 'NeedsAccess') await auth.start(publication.operationId);
    else setChecked(await action.run({ kind: 'RetryPublication', operationId: publication.operationId }));
  };
  return <ConnectedGroup title={t('m_b074310e911f')}><View key="publication" style={{ padding: 16, gap: 12 }}>
    <Status tone={['Failed', 'NeedsAccess'].includes(publication.state) ? 'danger' : ['Conflict', 'Unconfirmed'].includes(publication.state) ? 'warning' : publication.state === 'Published' ? 'success' : 'muted'} label={{ Waiting: t('m_6e54c2b65b4e'), Publishing: t('m_582e0f1abad4'), Unconfirmed: t('m_aefa0a239997'), NeedsAccess: t('m_2bac957cacfe'), Failed: t('m_ef4953108c87'), Conflict: t('m_b196ff9b8f1f'), Cancelled: t('m_67f02b0ad769'), Published: t('m_f24802b28eb5') }[publication.state]} />
    <Copy muted>{publication.calendarName || t('m_42dc73b15d7e')}{publication.email ? ` · ${publication.email}` : ''}</Copy>
    {publication.state !== 'Published' && <Copy muted size={14}>{publication.readOnly ? t('publication_inactive_context') : publication.state === 'Unconfirmed' ? t('m_b8bc02aeb328') : publication.state === 'NeedsAccess' ? t('m_33112f933562') : publication.state === 'Cancelled' ? t('m_4c84897d5791') : t('m_9476f8cd6b94')}</Copy>}
    {action.busy && <ActionFeedback loading message={t('publication_checking')} />}
    {checked && !busy && <ActionFeedback {...result} />}
    {publication.differs && publication.state === 'Published' && <Copy muted>{t('m_45b7352f8d39')}</Copy>}
    {!!(error || action.error) && <ActionFeedback message={error || action.error} tone="warning" />}
    {!!auth.message && <ActionFeedback message={auth.message} tone={auth.tone} loading={auth.waiting} />}
    {canRetryPublication(publication) && <Button label={action.unknown ? t('m_16003a1a9190') : publication.state === 'NeedsAccess' ? t('m_b724411569e0') : publication.readOnly || publication.state === 'Unconfirmed' ? t('m_793d9e63467a') : t('m_c4ed88c3c345')} variant="secondary" disabled={busy} onPress={() => void retry()} />}
    {publication.state === 'Published' && !!publication.htmlLink && <Button label={t('m_8cdec4f3126a')} variant="secondary" onPress={() => {
      void Linking.openURL(publication.htmlLink).catch(() => setError(t('m_459ac1963e28')));
    }} />}
    {publication.state === 'Published' && !publication.readOnly && <Button label={t('m_3790860f3348')} variant="secondary"
      onPress={() => router.push({ pathname: '/calendar-review', params: { ...routeParams, id: publication.occurrenceId } } as Href)} />}
  </View></ConnectedGroup>;
}
