import { useLocalizedState, useLocale, useTranslation } from '../localization/react';

import { useTimeDisplay, useTimeFormatting } from './time-display';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import type { Atmosphere, AtmosphereSelection, Brightness } from '../domain/appearance';
import { clockPreferenceDate, clockPreferenceFromPicker } from '../domain/clock-preferences';
import { atmosphereNames } from '../domain/settings-presentation';
import { ActionFeedback, Copy, Icon, SettingRow, Sheet } from './components';
import { atmosphereColors } from './colors';
import { useAppearanceHold, useAtmosphere, useTheme } from './theme';

export function ClockPreferenceRow({ minutes, onChange, disabled = false }: { minutes: number; onChange: (minutes: number) => void; disabled?: boolean }) {
  'use no memo';
  const t = useTranslation();
  const { clockPreferenceLabel } = useTimeFormatting();
  const timeDisplay = useTimeDisplay();
  const [picking, setPicking] = useState(false), [error, setError] = useLocalizedState('');
  const mounted = useRef(true), request = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useAppearanceHold(picking);
  const pick = () => {
    if (disabled || picking || Platform.OS !== 'android') return;
    const current = ++request.current;
    const active = () => mounted.current && request.current === current;
    const fail = () => { if (active()) { setPicking(false); setError(t('m_67a437769493')); } };
    setError(''); setPicking(true);
    try {
      DateTimePickerAndroid.open({ value: clockPreferenceDate(minutes), timeZoneName: 'UTC', mode: 'time',
        ...(timeDisplay.uses24HourClock == null ? {} : { is24Hour: timeDisplay.uses24HourClock }),
        onDismiss: () => { if (active()) setPicking(false); }, onError: fail,
        onValueChange: event => {
          if (!active()) return;
          try { const next = clockPreferenceFromPicker(event.nativeEvent.timestamp, event.nativeEvent.utcOffset); setPicking(false); onChange(next); }
          catch { fail(); }
        },
      });
    } catch { fail(); }
  };
  return <View><SettingRow icon="schedule" label={clockPreferenceLabel(minutes)} disabled={disabled || picking} onPress={pick} />
    {!!error && <ActionFeedback message={error} tone="danger" />}</View>;
}

function AtmosphereSwatch({ scene, brightness }: { scene: Atmosphere; brightness: Brightness }) {
  'use no memo';
  useLocale();
  const colors = atmosphereColors(scene, brightness);
  return <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: 32, height: 24, flexShrink: 0, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: colors.border }}>
    <View style={{ flex: 1, backgroundColor: colors.surface }} /><View style={{ flex: 1, backgroundColor: colors.accent }} />
  </View>;
}
function AtmosphereChoice({ value, selected, onPress }: { value: AtmosphereSelection; selected: boolean; onPress: () => void }) {
  'use no memo';
  const t = useTranslation();
  const colors = useTheme(), { scene, brightness } = useAtmosphere(), [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected}
    accessibilityLabel={atmosphereNames[value] + (value === 'automatic' && selected ? t('m_11b1199e1cb3', { arg0: String(atmosphereNames[scene]) }) : '')}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 56, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
      borderRadius: 12, borderWidth: 2, borderColor: focused ? colors.accent : 'transparent', backgroundColor: pressed ? colors.soft : 'transparent' })}>
    {value === 'automatic' ? <View style={{ width: 32, alignItems: 'center' }}><Icon name="schedule" /></View> : <AtmosphereSwatch scene={value} brightness={brightness} />}
    <View style={{ flex: 1 }}><Copy>{atmosphereNames[value]}</Copy>{value === 'automatic' && selected && <Copy muted size={14}>{t('m_09af5350700d')}{atmosphereNames[scene]}</Copy>}</View>
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 24, height: 24, borderRadius: 12,
      borderWidth: 2, borderColor: selected ? colors.accent : colors.muted, alignItems: 'center', justifyContent: 'center' }}>
      {selected && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent }} />}
    </View>
  </Pressable>;
}
export function AtmospherePicker({ value, onChange }: { value: AtmosphereSelection; onChange: (value: AtmosphereSelection) => void }) {
  'use no memo';
  const t = useTranslation();
  const [open, setOpen] = useState(false), { scene, brightness } = useAtmosphere();
  return <><SettingRow icon="palette" label={t('m_402b3d52f2b5')} value={atmosphereNames[value]}
    description={value === 'automatic' ? t('m_6819898282aa', { arg0: String(atmosphereNames[scene]) }) : undefined} onPress={() => setOpen(true)}>
    {value !== 'automatic' && <AtmosphereSwatch scene={value} brightness={brightness} />}
  </SettingRow>
    <Sheet title={t('m_402b3d52f2b5')} visible={open} onClose={() => setOpen(false)}>
      {(['automatic', 'sunrise', 'sky', 'evening', 'night'] as const).map(choice => <AtmosphereChoice key={choice} value={choice} selected={value === choice}
        onPress={() => { onChange(choice); setOpen(false); }} />)}
    </Sheet></>;
}
