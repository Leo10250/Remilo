import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { RecurrenceDraft } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { cleanRepeat, dayNames, repeatErrors, repeatLabel, repeatNames } from '../domain/repeat';
import { civilAt, deviceZone } from '../domain/time';
import { ActionFeedback, Button, Choice, Copy, DateField, Field, SelectRow, SettingRow, Sheet, Toggle } from './components';
import { engine } from './native';
import { useTheme } from './theme';
import { TimeZoneField } from './time-zone';
export { repeatLabel, repeatNames } from '../domain/repeat';

export function RepeatForm({ value, onChange, startMs, zoneId }: {
  value?: RecurrenceDraft; onChange: (value?: RecurrenceDraft, zoneId?: string) => void | Promise<void>; startMs: number; zoneId?: string;
}) {
  const colors = useTheme(), [open, setOpen] = useState(false), [custom, setCustom] = useState(false);
  const zone = zoneId ?? deviceZone();
  const start = new Date(civilAt(startMs, zone) + 'Z'), weekday = (start.getUTCDay() + 6) % 7 + 1;
  const base: RecurrenceDraft = { frequency: 'daily', interval: 1, weekdays: [weekday], day: start.getUTCDate(),
    ordinal: Math.ceil(start.getUTCDate() / 7), weekday, month: start.getUTCMonth() + 1, zoneMode: 'floating' };
  const [rule, setRule] = useState<RecurrenceDraft>(base), [customZone, setCustomZone] = useState(zone);
  const [numbers, setNumbers] = useState({ interval: '1', day: String(base.day), count: '10' });
  const [errors, setErrors] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [loadedEnd, setLoadedEnd] = useState<{ key: string; instantMs: number } | null>(null);
  const endKey = customZone + '|' + rule.until;
  const endEpoch = loadedEnd?.key === endKey ? loadedEnd.instantMs : null;
  useEffect(() => {
    let live = true;
    if (!open || !custom || !rule.until) return;
    const key = customZone + '|' + rule.until;
    void engine().convertTime({ zoneId: customZone, local: rule.until + 'T12:00:00' }).then((resolved) => {
      if (live) setLoadedEnd({ key, instantMs: resolved.instantMs });
    }).catch(() => { if (live) setMessage('Could not resolve the end date. Choose another date or try again.'); });
    return () => { live = false; };
  }, [open, custom, rule.until, customZone]);
  const patch = (change: Partial<RecurrenceDraft>) => setRule((current) => ({ ...current, ...change }));
  const close = () => { if (!busy) { setOpen(false); setCustom(false); setMessage(''); } };
  const apply = async (next?: RecurrenceDraft, nextZone = zone) => {
    setBusy(true); setMessage('');
    try { await onChange(next ? cleanRepeat(next) : undefined, next?.zoneMode === 'floating' ? deviceZone() : nextZone); setOpen(false); setCustom(false); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not apply this repeat rule. Try again.'); }
    finally { setBusy(false); }
  };
  const quick = (frequency: RecurrenceDraft['frequency'], weekdays?: number[]) => void apply({ ...base,
    ...(value ? { zoneMode: value.zoneMode, count: value.count, until: value.until } : {}), frequency, ...(weekdays ? { weekdays } : {}) });
  const preset = (frequency: RecurrenceDraft['frequency'], weekdays?: number[]) => !!value && value.frequency === frequency && value.interval === 1 &&
    value.count == null && !value.until && (frequency !== 'weekly' || value.weekdays?.join() === (weekdays ?? [weekday]).join()) &&
    (!['monthlyDay', 'yearly'].includes(frequency) || value.day === base.day) && (frequency !== 'yearly' || value.month === base.month);
  const openCustom = () => {
    const next = cleanRepeat(value ?? base);
    setRule(next); setCustomZone(next.zoneMode === 'floating' ? deviceZone() : zone);
    setNumbers({ interval: String(next.interval), day: String(next.day ?? base.day), count: String(next.count ?? 10) });
    setErrors({}); setMessage(''); setCustom(true);
  };
  const useRule = () => {
    const next = { ...rule, interval: Number(numbers.interval), day: Number(numbers.day),
      ...(rule.count != null ? { count: Number(numbers.count) } : {}) };
    const validation = repeatErrors(next, civilAt(startMs, zone).slice(0, 10));
    setErrors(validation);
    if (Object.keys(validation).length) return;
    void apply(next, customZone);
  };
  const unit = rule.frequency === 'daily' ? 'days' : rule.frequency === 'weekly' ? 'weeks' : rule.frequency === 'yearly' ? 'years' : 'months';
  return <>
    <SettingRow icon="repeat" label="Repeat" value={repeatLabel(value)} onPress={() => { setCustom(false); setMessage(''); setOpen(true); }} />
    <Sheet title={custom ? 'Custom repeat' : 'Repeat'} visible={open} onClose={close} onBack={() => { if (!busy) { if (custom) setCustom(false); else close(); } }}>
      <View pointerEvents={busy ? 'none' : 'auto'} importantForAccessibility={busy ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={busy} style={{ gap: 12 }}>
      {!custom ? <>
        <Choice label="Does not repeat" selected={!value} onPress={() => void apply(undefined)} />
        <Choice label="Every day" selected={preset('daily')} onPress={() => quick('daily')} />
        <Choice label="Weekdays" selected={preset('weekly', [1, 2, 3, 4, 5])} onPress={() => quick('weekly', [1, 2, 3, 4, 5])} />
        <Choice label={'Every ' + dayNames[weekday - 1]} selected={preset('weekly')} onPress={() => quick('weekly')} />
        <Choice label="Every month" selected={preset('monthlyDay')} onPress={() => quick('monthlyDay')} />
        <Choice label="Every year" selected={preset('yearly')} onPress={() => quick('yearly')} />
        <SettingRow label="Custom repeat" description={value ? repeatLabel(value) : 'Intervals, selected days, and an ending'} onPress={openCustom} />
      </> : <>
        <SelectRow label="Frequency" value={rule.frequency} choices={Object.entries(repeatNames).map(([frequency, label]) => ({ value: frequency as RecurrenceDraft['frequency'], label }))}
          onChange={(frequency) => patch({ frequency })} />
        <Field label={'Repeat every (' + unit + ')'} keyboardType="number-pad" value={numbers.interval} error={errors.interval}
          onChangeText={(interval) => setNumbers((current) => ({ ...current, interval }))} />
        {rule.frequency === 'weekly' && <><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {dayNames.map((name, index) => { const selected = rule.weekdays?.includes(index + 1) ?? false; return <Pressable key={name}
            accessibilityRole="checkbox" accessibilityLabel={name} accessibilityState={{ checked: selected }}
            onPress={() => patch({ weekdays: selected ? rule.weekdays?.filter((day) => day !== index + 1) : [...(rule.weekdays ?? []), index + 1].sort() })}
            style={{ minWidth: 48, minHeight: 48, borderRadius: 24, padding: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.accent : colors.soft }}>
            <Text style={{ color: selected ? colors.accentInk : colors.ink }}>{name.slice(0, 2)}</Text></Pressable>; })}
        </View>{errors.weekdays && <ActionFeedback message={errors.weekdays} tone="danger" />}</>}
        {['monthlyDay', 'yearly'].includes(rule.frequency) && <Field label="Day of month" keyboardType="number-pad" value={numbers.day} error={errors.day}
          onChangeText={(day) => setNumbers((current) => ({ ...current, day }))} />}
        {rule.frequency === 'yearly' && <SelectRow label="Month" value={rule.month ?? base.month!}
          choices={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: new Date(2024, index, 1).toLocaleString([], { month: 'long' }) }))}
          onChange={(month) => patch({ month })} />}
        {rule.frequency === 'monthlyOrdinal' && <>
          <SelectRow label="Which week" value={rule.ordinal ?? 1} choices={[1, 2, 3, 4, 5, -1].map((ordinal, index) => ({ value: ordinal, label: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Last'][index] }))} onChange={(ordinal) => patch({ ordinal })} />
          <SelectRow label="Weekday" value={rule.weekday ?? weekday} choices={dayNames.map((label, index) => ({ value: index + 1, label }))} onChange={(next) => patch({ weekday: next })} />
        </>}
        <SelectRow label="Ends" value={rule.count != null ? 'count' : rule.until ? 'date' : 'never'} choices={[{ value: 'never', label: 'Never' }, { value: 'count', label: 'After a number of occurrences' }, { value: 'date', label: 'On a date' }]}
          onChange={(ending) => patch({ count: ending === 'count' ? Number(numbers.count) : undefined, until: ending === 'date' ? civilAt(startMs + 30 * 86_400_000, zone).slice(0, 10) : undefined })} />
        {rule.count != null && <Field label="Number of occurrences" keyboardType="number-pad" value={numbers.count} error={errors.count}
          onChangeText={(count) => setNumbers((current) => ({ ...current, count }))} />}
        {rule.until && (endEpoch == null ? <Copy muted>Loading end date…</Copy> : <DateField label="End date" value={endEpoch} zoneId={customZone} dateOnly
          onError={setMessage} onChange={(ms) => patch({ until: civilAt(ms, customZone).slice(0, 10) })} />)}
        {errors.until && <ActionFeedback message={errors.until} tone="danger" />}
        <Toggle label="Keep a specific time zone" value={rule.zoneMode === 'pinned'} onChange={(enabled) => {
          patch({ zoneMode: enabled ? 'pinned' : 'floating' }); if (!enabled) setCustomZone(deviceZone());
        }} />
        {rule.zoneMode === 'pinned' ? <TimeZoneField value={customZone} atMs={startMs} onChange={setCustomZone} /> : <Copy muted size={13}>Follows your device time zone when you travel.</Copy>}
        <Copy muted size={13}>Missing dates are skipped. Last weekday means Monday–Friday. Postponed alarms keep their chosen instant.</Copy>
        <Button label="Apply repeat" onPress={useRule} />
        <Button label="Cancel changes" variant="secondary" onPress={() => setCustom(false)} />
      </>}
      </View>{busy && <ActionFeedback loading message="Applying repeat…" />}{!!message && <ActionFeedback message={message} tone="danger" />}
    </Sheet>
  </>;
}
