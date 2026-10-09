import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { retainedOriginParams, type OriginParams } from '../domain/navigation';
import { normalizeAtmosphere } from '../domain/appearance';
import { Choice, Copy, Group, Page, QueryState, SelectRow } from '../ui/components';
import { nativeAvailable, preferences, useSettings } from '../ui/native';
import { PreferenceFeedback } from '../ui/preference-feedback';

export default function Appearance() {
  const params = useLocalSearchParams<OriginParams>(), query = useSettings(), settings = query.data;
  return <Page title="Appearance" onBack={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/settings', params: retainedOriginParams(params) })}>
    <QueryState loading={!settings && query.isLoading && nativeAvailable} error={!settings ? query.error : undefined} empty={!settings && !query.isLoading}
      emptyMessage={nativeAvailable ? 'Appearance settings are unavailable.' : 'Use the Android app to change appearance.'} onRetry={nativeAvailable ? () => void query.refetch() : undefined} />
    {settings && <>
      <Group title="Brightness">{([
        ['system','System','Uses your device’s Light or Dark appearance.'],
        ['light','Light','Always use the light appearance.'],
        ['dark','Dark','Always use the dark appearance.'],
      ] as const).map(([value,label,description])=><Choice key={value} label={label} description={description} selected={settings.theme===value} onPress={()=>preferences.change({theme:value})}/>)}
        <PreferenceFeedback fields={['theme']} /></Group>
      <Group title="Atmosphere"><SelectRow label="Atmosphere" value={normalizeAtmosphere(settings.atmosphere)} icon="palette"
        choices={[{ value: 'automatic', label: 'Automatic' }, { value: 'sunrise', label: 'Sunrise' }, { value: 'sky', label: 'Sky' }, { value: 'evening', label: 'Evening' }, { value: 'night', label: 'Night' }]}
        onChange={(atmosphere) => preferences.change({ atmosphere })} />
        <View style={{paddingHorizontal:16,paddingBottom:12}}><Copy muted size={14}>One atmosphere across Remilo and new full-screen alarm sessions. Brightness is independent.</Copy></View><PreferenceFeedback fields={['atmosphere']} />
      </Group>
      <Group title="Automatic local times"><View style={{padding:16}}><Copy muted size={14}>Sunrise 6–10 AM · Sky 10 AM–5 PM · Evening 5–9 PM · Night 9 PM–6 AM. Automatic uses your device clock and time zone.</Copy></View></Group>
      <Copy muted size={14}>Appearance changes presentation only. Event, Due, alert times and completion stay unchanged. Android owns notification and keyboard styling.</Copy>
    </>}
  </Page>;
}
