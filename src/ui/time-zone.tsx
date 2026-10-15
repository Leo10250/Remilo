import { useTranslation } from '../localization/react';
import { t } from '../localization';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ActionFeedback, Field, Icon, QueryState, RowSupport, SettingRow, Sheet, Button } from './components';
import { engine, nativeAvailable } from './native';
import { useTheme } from './theme';
import { typography } from './tokens';
function offset(seconds: number) {
  const minutes = Math.abs(Math.trunc(seconds / 60));
  return t('m_a222609354f5', { arg0: String(seconds < 0 ? '−' : '+'), arg1: String(String(Math.floor(minutes / 60)).padStart(2, '0')), arg2: String(String(minutes % 60).padStart(2, '0')) });
}
export function TimeZoneField({ value, atMs, onChange, disabled = false, error }: {
  value: string; atMs: number; onChange: (zone: string) => void; disabled?: boolean; error?: string;
}) {
  'use no memo';
  const t = useTranslation();
  const colors = useTheme(), [open, setOpen] = useState(false), [search, setSearch] = useState(''), [limit, setLimit] = useState(30);
  const query = useQuery({ queryKey: ['time-zones', atMs], enabled: nativeAvailable, queryFn: () => engine().getTimeZones(atMs) });
  const selected = query.data?.find((zone) => zone.id === value);
  const matching = query.data?.filter((zone) => [zone.label, zone.region, zone.id].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [];
  // Catalog aliases stay supported, but identical city choices do not fill the picker.
  const cities = new Map<string, typeof matching[number]>();
  matching.forEach((zone) => {
    const key = [zone.label, zone.region, zone.offsetSeconds].join('|');
    if (!cities.has(key) || zone.id === value) cities.set(key, zone);
  });
  const choices = [...cities.values()].sort((a, b) => Number(b.id === value) - Number(a.id === value) || a.label.localeCompare(b.label));
  return <><SettingRow label={t('m_b9fe1464783e')} icon="event" disabled={disabled}
    value={selected?.label ?? value.split('/').at(-1)?.replaceAll('_', ' ')} description={selected ? [selected.region, offset(selected.offsetSeconds)].filter(Boolean).join(' · ') : value}
    onPress={() => { setSearch(''); setLimit(30); setOpen(true); }} />
    {error && <RowSupport><ActionFeedback message={error} tone="danger" /></RowSupport>}
    <Sheet title={t('m_b9fe1464783e')} visible={open} onClose={() => setOpen(false)}>
      <Field label={t('m_44f3ead26a0c')} placeholder={t('m_801381b59762')} autoFocus value={search}
        onChangeText={(text) => { setSearch(text); setLimit(30); }} autoCapitalize="none" />
      <QueryState loading={query.isLoading} error={query.error} empty={!!query.data && !choices.length}
        emptyMessage={t('m_903a0a0cdb66')} onRetry={() => void query.refetch()} />
      {choices.slice(0, limit).map((zone) => <Pressable key={zone.id} accessibilityRole="radio" accessibilityState={{ checked: value === zone.id }}
        accessibilityLabel={[zone.label, zone.region, offset(zone.offsetSeconds)].filter(Boolean).join(', ')}
        onPress={() => { onChange(zone.id); setOpen(false); }}
        style={({ pressed }) => ({ minHeight: 64, paddingVertical: 8, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? colors.soft : 'transparent' })}>
        <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontSize: typography.body }}>{zone.label}</Text>
          <Text style={{ color: colors.muted, fontSize: typography.supporting }}>{[zone.region, offset(zone.offsetSeconds)].filter(Boolean).join(' · ')}</Text>
          <Text style={{ color: colors.muted, fontSize: typography.label }}>{zone.id}</Text></View>
        {value === zone.id && <Icon name="check" color={colors.accent} />}
      </Pressable>)}
      {choices.length > limit && <Button label={t('m_f53a93bd763f')} variant="secondary" onPress={() => setLimit(limit + 30)} />}
    </Sheet></>;
}
