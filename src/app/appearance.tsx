import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { retainedOriginParams, type OriginParams } from '../domain/navigation';
import { normalizeAtmosphere } from '../domain/appearance';
import { clockPreferenceLabel } from '../domain/clock-preferences';
import { Choice, ConnectedGroup, Copy, Disclosure, Group, Page, QueryState } from '../ui/components';
import { nativeAvailable, preferences, useSettings } from '../ui/native';
import { PreferenceFeedback } from '../ui/preference-feedback';
import { AtmospherePicker } from '../ui/settings-controls';

export default function Appearance() {
  const params = useLocalSearchParams<OriginParams>(), query = useSettings(), settings = query.data;
  const automatic = normalizeAtmosphere(settings?.atmosphere) === 'automatic';
  return <Page title="Appearance" onBack={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/settings', params: retainedOriginParams(params) })}>
    <QueryState loading={!settings && query.isLoading && nativeAvailable} error={!settings ? query.error : undefined} empty={!settings && !query.isLoading}
      emptyMessage={nativeAvailable ? 'Appearance settings are unavailable.' : 'Use the Android app to change appearance.'} onRetry={nativeAvailable ? () => void query.refetch() : undefined} />
    {settings && <>
      <Group title="Color mode">{([
        ['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark'],
      ] as const).map(([value, label]) => <Choice key={value} label={label} selected={settings.theme === value} onPress={() => preferences.change({ theme: value })} />)}</Group>
      <ConnectedGroup><AtmospherePicker key="atmosphere" value={normalizeAtmosphere(settings.atmosphere)} onChange={atmosphere => preferences.change({ atmosphere })} /></ConnectedGroup>
      {automatic && <Group><View style={{ paddingHorizontal: 16 }}><Disclosure title="Daily schedule">
        <Copy muted size={14}>Uses your device’s local time.</Copy>
        {([
          ['Sunrise', 360, 600], ['Sky', 600, 1020], ['Evening', 1020, 1260], ['Night', 1260, 360],
        ] as const).map(([label, start, end]) => <View key={label} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 16, rowGap: 4 }}>
          <Copy>{label}</Copy><Copy muted size={14}>{clockPreferenceLabel(start)}–{clockPreferenceLabel(end)}</Copy>
        </View>)}
      </Disclosure></View></Group>}
      <PreferenceFeedback fields={['theme', 'atmosphere']} />
    </>}
  </Page>;
}
