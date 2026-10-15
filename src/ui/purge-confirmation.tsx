import { useTranslation } from '../localization/react';

import { View } from 'react-native';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Copy, Sheet } from './components';
import { useCalendarAssociation } from './calendar-association';

/** Parents capture the displayed identities/revisions before opening this sheet. */
export function PurgeConfirmation({ items, onCancel, onConfirm }: {
  items: readonly Occurrence[]; onCancel: () => void; onConfirm: () => void;
}) {
  'use no memo';
  const t = useTranslation();
  const associated = useCalendarAssociation(items.map(item => item.id), items.length > 0);
  return <Sheet title={items.length <= 1 ? t('m_c1b15a371248') : t('m_85941fb9c992') + items.length + t('m_a0a562e6ea38')}
    visible={items.length > 0} onClose={onCancel}>
    {items.length === 1 && <Copy heading>{items[0].title}</Copy>}
    <Copy>{t('m_78136cc030b2')}</Copy>
    {associated && <Copy muted>{t('m_3a10249164ca')}</Copy>}
    {items.some(item => !!item.segmentId) && <Copy muted>{t('m_75f706a0f85d')}</Copy>}
    <View style={{ gap: 8 }}>
      <Button label={t('m_280b10c89cc4')} icon="delete_forever" variant="danger" onPress={onConfirm} />
      <Button label={t('m_19766ed6ccb2')} variant="outlined" onPress={onCancel} />
    </View>
  </Sheet>;
}
