import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { DateField } from './components';
import { useFontScaleOverride, useTheme } from './theme';
import { space } from './tokens';

/** Independent pickers share a row only while both targets have readable room. */
export function DateTimeFields({ value, zoneId, allDay, onChange, onError, disabled, labelPrefix }: {
  value: number; zoneId: string; allDay: boolean; onChange: (value: number) => void;
  onError: (message: string) => void; disabled: boolean; labelPrefix?: string;
}) {
  const colors = useTheme(), scale = useFontScaleOverride(), { width, fontScale } = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const textScale = Math.max(scale, fontScale);
  const stacked = allDay || textScale >= 1.6 || (availableWidth ?? width - space.gutter * 2) < 320 * textScale;
  const props = { value, zoneId, onChange, onError, disabled, compact: !stacked };
  return <View onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)}
    style={{ flexDirection: stacked ? 'column' : 'row' }}>
    <View style={{ flex: stacked ? undefined : 1, minWidth: 0 }}><DateField {...props} label="Date" accessibilityLabel={labelPrefix ? labelPrefix + ' date' : undefined} dateOnly /></View>
    {!allDay && <>
      {!stacked && <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={{ width: 1, marginVertical: space.md, backgroundColor: colors.border }} />}
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0 }}><DateField {...props} label="Time" accessibilityLabel={labelPrefix ? labelPrefix + ' time' : undefined} timeOnly /></View>
    </>}
  </View>;
}
