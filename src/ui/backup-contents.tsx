import { useTranslation } from '../localization/react';
import { Copy, Disclosure } from './components';

export function BackupContentsDisclosure() {
  'use no memo';
  const t = useTranslation();
  return (
    <Disclosure title={t('m_95365d0f81ab')} prominent>
      <Copy muted size={14}>
        {t('m_a7b215af0d49')}
      </Copy>
      <Copy muted size={14}>
        {t('m_743811479f87')}
      </Copy>
      <Copy muted size={14}>
        {t('m_a9a1a38b9395')}
      </Copy>
      <Copy muted size={14}>
        {t('m_6d3b4ca3720b')}
      </Copy>
    </Disclosure>
  );
}
