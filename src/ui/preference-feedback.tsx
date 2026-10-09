import type { PreferencePatch } from '../domain/preferences';
import { ActionFeedback, Button } from './components';
import { preferences, useSettings } from './native';

export function PreferenceFeedback({ fields }: { fields: (keyof PreferencePatch)[] }) {
  const settings = useSettings();
  if (!settings.preferenceFields.some((field) => fields.includes(field))) return null;
  return <>
    <ActionFeedback loading={settings.saving} message={settings.saveError ?? (settings.saving ? 'Saving changes…' : undefined)} tone={settings.saveError ? 'danger' : 'muted'} />
    {!!settings.saveError && <Button label="Retry saving changes" variant="secondary" onPress={preferences.retry} />}
  </>;
}
