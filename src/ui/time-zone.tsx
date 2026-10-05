import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ActionFeedback, Field, Icon, QueryState, SettingRow, Sheet, Button } from './components';
import { engine, nativeAvailable } from './native';
import { useTheme } from './theme';
import { typography } from './tokens';
function offset(seconds: number) {
  const minutes = Math.abs(Math.trunc(seconds / 60));
  return `UTC${seconds < 0 ? '−' : '+'}${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export function TimeZoneField({ value, atMs, onChange, disabled = false, error }: {
  value: string; atMs: number; onChange: (zone: string) => void; disabled?: boolean; error?: string;
}) {
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
  return <><SettingRow label="Time zone" icon="event" disabled={disabled}
    value={selected?.label ?? value.split('/').at(-1)?.replaceAll('_', ' ')} description={selected ? [selected.region, offset(selected.offsetSeconds)].filter(Boolean).join(' · ') : value}
    onPress={() => { setSearch(''); setLimit(30); setOpen(true); }} />
    {error && <ActionFeedback message={error} tone="danger" />}
    <Sheet title="Time zone" visible={open} onClose={() => setOpen(false)}>
      <Field label="Search cities or regions" placeholder="City, region, or time zone" autoFocus value={search}
        onChangeText={(text) => { setSearch(text); setLimit(30); }} autoCapitalize="none" />
      <QueryState loading={query.isLoading} error={query.error} empty={!!query.data && !choices.length}
        emptyMessage="No matching time zones." onRetry={() => void query.refetch()} />
      {choices.slice(0, limit).map((zone) => <Pressable key={zone.id} accessibilityRole="radio" accessibilityState={{ checked: value === zone.id }}
        accessibilityLabel={[zone.label, zone.region, offset(zone.offsetSeconds)].filter(Boolean).join(', ')}
        onPress={() => { onChange(zone.id); setOpen(false); }}
        style={({ pressed }) => ({ minHeight: 64, paddingVertical: 8, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? colors.soft : 'transparent' })}>
        <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontSize: typography.body }}>{zone.label}</Text>
          <Text style={{ color: colors.muted, fontSize: typography.supporting }}>{[zone.region, offset(zone.offsetSeconds)].filter(Boolean).join(' · ')}</Text>
          <Text style={{ color: colors.muted, fontSize: typography.label }}>{zone.id}</Text></View>
        {value === zone.id && <Icon name="check" color={colors.accent} />}
      </Pressable>)}
      {choices.length > limit && <Button label="Show more cities" variant="secondary" onPress={() => setLimit(limit + 30)} />}
    </Sheet></>;
}
