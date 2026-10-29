import { useTranslation } from '../localization/react';

import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { DateField } from './components';
import { useFontScaleOverride, useTheme } from './theme';
import { space } from './tokens';

/** Independent pickers share a row only while both targets have readable room. */
export function DateTimeFields({ value, zoneId, allDay, onChange, onError, disabled, labelPrefix, dateLabel, dateValue, dateZoneId, onDateChange }: {
  value: number; zoneId: string; allDay: boolean; onChange: (value: number) => void;
  onError: (message: string) => void; disabled: boolean; labelPrefix?: string;
  dateLabel?: string; dateValue?: number; dateZoneId?: string; onDateChange?: (value: number) => void;
}) {
  'use no memo';
  const t = useTranslation();
  const colors = useTheme(), scale = useFontScaleOverride(), { width, fontScale } = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const textScale = Math.max(scale, fontScale);
  const stacked = allDay || textScale >= 1.6 || (availableWidth ?? width - space.gutter * 2) < 320 * textScale;
  const props = { value, zoneId, onChange, onError, disabled, compact: !stacked };
  return <View onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)}
    style={{ flexDirection: stacked ? 'column' : 'row' }}>
    <View style={{ flex: stacked ? undefined : 1, minWidth: 0 }}><DateField {...props} zoneId={dateZoneId ?? zoneId} value={dateValue ?? value} onChange={onDateChange ?? onChange} label={dateLabel ?? t('m_99c40ab40592')} accessibilityLabel={dateLabel ?? (labelPrefix ? labelPrefix + t('m_6bcf3616a17d') : undefined)} dateOnly /></View>
    {!allDay && <>
      {!stacked && <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={{ width: 1, marginVertical: space.md, backgroundColor: colors.border }} />}
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0 }}><DateField {...props} label={t('m_33b93476cf59')} accessibilityLabel={labelPrefix ? labelPrefix + t('m_4a8f540240f1') : undefined} timeOnly /></View>
    </>}
  </View>;
}
