import { useTranslation } from '../localization/react';

import type { PreferencePatch } from '../domain/preferences';
import { ActionFeedback, Button } from './components';
import { preferences, useSettings } from './native';

export function PreferenceFeedback({ fields }: { fields: (keyof PreferencePatch)[] }) {
  'use no memo';
  const t = useTranslation();
  const settings = useSettings();
  if (!settings.preferenceFields.some((field) => fields.includes(field))) return null;
  return <>
    <ActionFeedback loading={settings.saving} message={settings.saveError ?? (settings.saving ? t('m_395207583eb8') : undefined)} tone={settings.saveError ? 'danger' : 'muted'} />
    {!!settings.saveError && <Button label={t('m_fafe71022b85')} variant="secondary" onPress={preferences.retry} />}
  </>;
}
