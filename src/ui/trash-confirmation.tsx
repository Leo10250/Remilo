import { useTranslation } from '../localization/react';

import { View } from 'react-native';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Copy, Sheet } from './components';
import { useCalendarAssociation } from './calendar-association';

/** The parent holds the displayed occurrence and revision until confirmation. */
export function TrashConfirmation({ item, onCancel, onConfirm }: {
  item: Occurrence | null; onCancel: () => void; onConfirm: () => void;
}) {
  'use no memo';
  const t = useTranslation();
  const associated = useCalendarAssociation(item ? [item.id] : [], !!item);
  return <Sheet title={item?.segmentId ? t('m_47bf6cee7617') : t('m_b9348a0ffde3')}
    visible={!!item} onClose={onCancel}>
    {item && <Copy heading>{item.title}</Copy>}
    <Copy>{t('m_13a483f418fc')}</Copy>
    {associated && <Copy muted>{t('m_3a10249164ca')}</Copy>}
    {!!item?.segmentId && <Copy muted>{t('m_d24f58583752')}</Copy>}
    <View style={{ gap: 8 }}>
      <Button label={t('m_9adcdf33dce1')} icon="delete" variant="danger" onPress={onConfirm} />
      <Button label={t('m_4c8d1b0c497f')} variant="outlined" onPress={onCancel} />
    </View>
  </Sheet>;
}
