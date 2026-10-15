import { useTranslation } from '../localization/react';

import { useTimeFormatting } from '../ui/time-display';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { retainedOriginParams, type OriginParams } from '../domain/navigation';
import { normalizeAtmosphere } from '../domain/appearance';
import { Choice, ConnectedGroup, Copy, Disclosure, Group, Page, QueryState } from '../ui/components';
import { nativeAvailable, preferences, useSettings } from '../ui/native';
import { PreferenceFeedback } from '../ui/preference-feedback';
import { AtmospherePicker } from '../ui/settings-controls';

export default function Appearance() {
  'use no memo';
  const t = useTranslation();
  const { clockPreferenceLabel } = useTimeFormatting();
  const params = useLocalSearchParams<OriginParams>(), query = useSettings(), settings = query.data;
  const automatic = normalizeAtmosphere(settings?.atmosphere) === 'automatic';
  return <Page title={t('m_3907fa7f8072')} onBack={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/settings', params: retainedOriginParams(params) })}>
    <QueryState loading={!settings && query.isLoading && nativeAvailable} error={!settings ? query.error : undefined} empty={!settings && !query.isLoading}
      emptyMessage={nativeAvailable ? t('m_feb954a18de7') : t('m_34cd510c72ed')} onRetry={nativeAvailable ? () => void query.refetch() : undefined} />
    {settings && <>
      <Group title={t('m_9f1e7d7d98b2')}>{([
        ['system', t('m_5e4aca65d4a4')], ['light', t('m_dbcd5e7bb7a0')], ['dark', t('m_60acc53f13a5')],
      ] as const).map(([value, label]) => <Choice key={value} label={label} selected={settings.theme === value} onPress={() => preferences.change({ theme: value })} />)}</Group>
      <ConnectedGroup><AtmospherePicker key="atmosphere" value={normalizeAtmosphere(settings.atmosphere)} onChange={atmosphere => preferences.change({ atmosphere })} /></ConnectedGroup>
      {automatic && <Group><View style={{ paddingHorizontal: 16 }}><Disclosure title={t('m_8224099ad6af')}>
        <Copy muted size={14}>{t('m_d7a57b14486e')}</Copy>
        {([
          [t('m_9c7c53e80a4e'), 360, 600], [t('m_b72804afefc3'), 600, 1020], [t('m_458c1fed5743'), 1020, 1260], [t('m_4e9f8db8242b'), 1260, 360],
        ] as const).map(([label, start, end]) => <View key={label} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 16, rowGap: 4 }}>
          <Copy>{label}</Copy><Copy muted size={14}>{clockPreferenceLabel(start)}–{clockPreferenceLabel(end)}</Copy>
        </View>)}
      </Disclosure></View></Group>}
      <PreferenceFeedback fields={['theme', 'atmosphere']} />
    </>}
  </Page>;
}
