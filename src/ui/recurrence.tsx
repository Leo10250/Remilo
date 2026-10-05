import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { RecurrenceDraft } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Choice, Copy, DateField, Field, SelectRow, SettingRow, Sheet, Toggle } from './components';
import { useTheme } from './theme';
export const repeatNames: Record<RecurrenceDraft['frequency'], string> = {
  daily: 'Daily', weekly: 'Weekly', monthlyDay: 'Monthly date', monthlyOrdinal: 'Monthly weekday', lastWeekday: 'Last weekday', yearly: 'Yearly',
};
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function repeatLabel(value?: RecurrenceDraft) {
  if (!value) return 'Does not repeat';
  if (value.frequency === 'weekly') return (value.interval > 1 ? 'Every ' + value.interval + ' weeks · ' : '') +
    (value.weekdays ?? []).map((day) => dayNames[day - 1]?.slice(0, 3)).join(', ');
  return repeatNames[value.frequency] + (value.interval > 1 ? ' · every ' + value.interval : '');
}
export function RepeatForm({ value, onChange, startMs, zoneId, setZone }: {
  value?: RecurrenceDraft; onChange: (value?: RecurrenceDraft) => void; startMs: number; zoneId?: string; setZone: (zone: string) => void;
}) {
  const colors = useTheme(), [open, setOpen] = useState(false), [custom, setCustom] = useState(false);
  const start = new Date(startMs), weekday = (start.getDay() + 6) % 7 + 1;
  const base: RecurrenceDraft = { frequency: 'daily', interval: 1, weekdays: [weekday], day: start.getDate(),
    ordinal: Math.ceil(start.getDate() / 7), weekday, month: start.getMonth() + 1, zoneMode: 'floating' };
  const patch = (change: Partial<RecurrenceDraft>) => onChange({ ...(value ?? base), ...change });
  const quick = (frequency: RecurrenceDraft['frequency'], weekdays?: number[]) => {
    onChange({ ...base, frequency, ...(weekdays ? { weekdays } : {}) }); setOpen(false);
  };
  const unit = value?.frequency === 'daily' ? 'days' : value?.frequency === 'weekly' ? 'weeks' : value?.frequency === 'yearly' ? 'years' : 'months';
  return <>
    <SettingRow icon="repeat" label="Repeat" value={repeatLabel(value)} onPress={() => { setCustom(false); setOpen(true); }} />
    <Sheet title={custom ? 'Custom repeat' : 'Repeat'} visible={open} onClose={() => setOpen(false)}>
      {!custom ? <>
        <Choice label="Does not repeat" selected={!value} onPress={() => { onChange(undefined); setOpen(false); }} />
        <Choice label="Every day" selected={value?.frequency === 'daily' && value.interval === 1} onPress={() => quick('daily')} />
        <Choice label="Weekdays" selected={value?.frequency === 'weekly' && value.weekdays?.join() === '1,2,3,4,5'} onPress={() => quick('weekly', [1, 2, 3, 4, 5])} />
        <Choice label={'Every ' + dayNames[weekday - 1]} selected={value?.frequency === 'weekly' && value.weekdays?.join() === String(weekday)} onPress={() => quick('weekly')} />
        <Choice label="Every month" selected={value?.frequency === 'monthlyDay' && value.interval === 1} onPress={() => quick('monthlyDay')} />
        <Choice label="Every year" selected={value?.frequency === 'yearly' && value.interval === 1} onPress={() => quick('yearly')} />
        <SettingRow label="Custom repeat…" onPress={() => { if (!value) onChange(base); setCustom(true); }} />
      </> : <>
        <SelectRow label="Frequency" value={value?.frequency ?? 'daily'} choices={Object.entries(repeatNames).map(([frequency, label]) => ({ value: frequency as RecurrenceDraft['frequency'], label }))}
          onChange={(frequency) => patch({ frequency })} />
        <Field label={'Repeat every (' + unit + ')'} keyboardType="number-pad" value={String(value?.interval ?? 1)} onChangeText={(text) => patch({ interval: Number(text) })} />
        {value?.frequency === 'weekly' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {dayNames.map((name, index) => { const selected = value.weekdays?.includes(index + 1) ?? false; return <Pressable key={name}
            accessibilityRole="checkbox" accessibilityLabel={name} accessibilityState={{ checked: selected }}
            onPress={() => patch({ weekdays: selected ? value.weekdays?.filter((day) => day !== index + 1) : [...(value.weekdays ?? []), index + 1].sort() })}
            style={{ minWidth: 48, minHeight: 48, borderRadius: 24, padding: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.accent : colors.soft }}>
            <Text style={{ color: selected ? colors.accentInk : colors.ink }}>{name.slice(0, 2)}</Text></Pressable>; })}
        </View>}
        {(value?.frequency === 'monthlyDay' || value?.frequency === 'yearly') && <Field label="Day of month" keyboardType="number-pad"
          value={String(value.day ?? start.getDate())} onChangeText={(text) => patch({ day: Number(text) })} />}
        {value?.frequency === 'yearly' && <SelectRow label="Month" value={value.month ?? start.getMonth() + 1}
          choices={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: new Date(2026, index, 1).toLocaleString([], { month: 'long' }) }))}
          onChange={(month) => patch({ month })} />}
        {value?.frequency === 'monthlyOrdinal' && <>
          <SelectRow label="Which week" value={value.ordinal ?? 1} choices={[1, 2, 3, 4, 5, -1].map((ordinal, index) => ({ value: ordinal, label: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Last'][index] }))} onChange={(ordinal) => patch({ ordinal })} />
          <SelectRow label="Weekday" value={value.weekday ?? weekday} choices={dayNames.map((label, index) => ({ value: index + 1, label }))} onChange={(weekday) => patch({ weekday })} />
        </>}
        <SelectRow label="Ends" value={value?.count != null ? 'count' : value?.until ? 'date' : 'never'} choices={[{ value: 'never', label: 'Never' }, { value: 'count', label: 'After a number of occurrences' }, { value: 'date', label: 'On a date' }]}
          onChange={(ending) => patch({ count: ending === 'count' ? 10 : undefined, until: ending === 'date' ? localDate(startMs + 30 * 86_400_000) : undefined })} />
        {value?.count != null && <Field label="Number of occurrences" keyboardType="number-pad" value={String(value.count)} onChangeText={(text) => patch({ count: Number(text) })} />}
        {value?.until && <DateField label="End date" value={new Date(value.until + 'T12:00:00').getTime()} dateOnly onChange={(ms) => patch({ until: localDate(ms) })} />}
        <Toggle label="Keep a specific time zone" value={value?.zoneMode === 'pinned'} onChange={(enabled) => patch({ zoneMode: enabled ? 'pinned' : 'floating' })} />
        {value?.zoneMode === 'pinned' && <Field label="Time zone" value={zoneId ?? Intl.DateTimeFormat().resolvedOptions().timeZone} onChangeText={setZone} placeholder="America/Los_Angeles" autoCapitalize="none" />}
        <Copy muted size={13}>Missing dates are skipped. Last weekday means Monday–Friday. Postponed alarms keep their chosen instant.</Copy>
        <Button label="Use this repeat rule" onPress={() => setOpen(false)} />
      </>}
    </Sheet>
  </>;
}
function localDate(ms: number) { const date = new Date(ms); return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }
