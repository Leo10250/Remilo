import { router, useLocalSearchParams } from 'expo-router';
import { retainedOriginParams, type OriginParams } from '../domain/navigation';
import { useTranslation } from '../localization/react';
import { ConnectedGroup, Copy, Page, QueryState, SectionStack } from '../ui/components';
import { nativeAvailable, preferences, useSettings } from '../ui/native';
import { PreferenceFeedback } from '../ui/preference-feedback';
import { ClockPreferenceRow } from '../ui/settings-controls';

const slots = [
  ['tomorrowMorning', 'ui_shortcut_morning'],
  ['tomorrowAfternoon', 'ui_shortcut_afternoon'],
  ['tomorrowEvening', 'ui_shortcut_evening'],
] as const;

export default function TomorrowShortcuts() {
  'use no memo';
  const t = useTranslation();
  const params = useLocalSearchParams<OriginParams>();
  const query = useSettings();
  const settings = query.data;
  return (
    <Page
      compact
      title={t('m_9b0f67429df4')}
      onBack={() =>
        router.canGoBack()
          ? router.back()
          : router.replace({ pathname: '/settings', params: retainedOriginParams(params) })
      }
    >
      <SectionStack>
        <Copy muted size={14}>
          {t('m_c03efc02ebc8')}
        </Copy>
        <QueryState
          loading={!settings && query.isLoading && nativeAvailable}
          error={!settings ? query.error : undefined}
          empty={!settings && !query.isLoading}
          emptyMessage={nativeAvailable ? t('m_de367fa1d4a6') : t('m_eb0582ac36eb')}
          onRetry={nativeAvailable ? () => void query.refetch() : undefined}
        />
        {settings && (
          <ConnectedGroup
            title={t('ui_shortcut_times')}
            footer={<PreferenceFeedback fields={query.preferenceFields} />}
          >
            {slots.map(([key, label]) => (
              <ClockPreferenceRow
                key={key}
                label={t(label)}
                minutes={settings[key]}
                onChange={(value) => preferences.change({ [key]: value })}
              />
            ))}
          </ConnectedGroup>
        )}
      </SectionStack>
    </Page>
  );
}
