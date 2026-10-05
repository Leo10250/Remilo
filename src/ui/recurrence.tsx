import type { RecurrenceDraft } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Card, Copy, DateField, Field, Heading, Toggle } from './components';

export const repeatNames: Record<RecurrenceDraft['frequency'], string> = {
  daily: 'Daily', weekly: 'Selected weekdays', monthlyDay: 'Day of the month',
  monthlyOrdinal: 'Ordinal weekday', lastWeekday: 'Last weekday of the month', yearly: 'Annual',
};
export function RepeatForm({ value, onChange, startMs, zoneId, setZone }: {
  value?: RecurrenceDraft; onChange: (value?: RecurrenceDraft) => void; startMs: number;
  zoneId?: string; setZone: (zone: string) => void;
}) {
  const patch = (change: Partial<RecurrenceDraft>) => value && onChange({ ...value, ...change });
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const start = new Date(startMs);
  const weekday = (start.getDay() + 6) % 7 + 1;
  return <Card><Heading>Repeat</Heading>
    <Toggle label="Repeat this reminder" value={!!value} onChange={(enabled) => onChange(enabled ? {
      frequency: 'daily', interval: 1, weekdays: [weekday], day: start.getDate(), ordinal: Math.ceil(start.getDate() / 7),
      weekday, month: start.getMonth() + 1, zoneMode: 'floating',
    } : undefined)} />
    {value && <>
      {Object.entries(repeatNames).map(([frequency, label]) => <Button key={frequency}
        label={`${value.frequency === frequency ? '✓ ' : ''}${label}`} variant={value.frequency === frequency ? 'primary' : 'secondary'}
        onPress={() => patch({ frequency: frequency as RecurrenceDraft['frequency'] })} />)}
      <Field label={`Every how many ${value.frequency === 'daily' ? 'days' : value.frequency === 'weekly' ? 'weeks' : value.frequency === 'yearly' ? 'years' : 'months'}? (1–999)`}
        keyboardType="number-pad" value={String(value.interval)} onChangeText={(text) => patch({ interval: Number(text) })} />
      {value.frequency === 'weekly' && names.map((name, index) => <Toggle key={name} label={name}
        value={value.weekdays?.includes(index + 1) ?? false} onChange={(enabled) => patch({ weekdays: enabled
          ? [...(value.weekdays ?? []), index + 1].sort() : value.weekdays?.filter((day) => day !== index + 1) })} />)}
      {(value.frequency === 'monthlyDay' || value.frequency === 'yearly') && <Field label="Day (1–31)" keyboardType="number-pad"
        value={String(value.day ?? start.getDate())} onChangeText={(text) => patch({ day: Number(text) })} />}
      {value.frequency === 'yearly' && <Field label="Month (1–12)" keyboardType="number-pad"
        value={String(value.month ?? start.getMonth() + 1)} onChangeText={(text) => patch({ month: Number(text) })} />}
      {value.frequency === 'monthlyOrdinal' && <>
        <Field label="Which occurrence? 1–5, or -1 for last" keyboardType="numbers-and-punctuation"
          value={String(value.ordinal ?? 1)} onChangeText={(text) => patch({ ordinal: Number(text) })} />
        {names.map((name, index) => <Button key={name} label={`${value.weekday === index + 1 ? '✓ ' : ''}${name}`}
          variant="secondary" onPress={() => patch({ weekday: index + 1 })} />)}
      </>}
      <Copy muted>Invalid dates and missing fifth weekdays are skipped without consuming the count. “Last weekday” means Monday–Friday.</Copy>
      <Heading>Ending</Heading>
      <Toggle label="End after a number of occurrences" value={value.count != null}
        onChange={(enabled) => patch({ count: enabled ? 10 : undefined, until: undefined })} />
      {value.count != null && <Field label="Occurrences (1–100,000)" keyboardType="number-pad" value={String(value.count)}
        onChangeText={(text) => patch({ count: Number(text) })} />}
      <Toggle label="End on a date (inclusive)" value={!!value.until} onChange={(enabled) => patch({
        until: enabled ? localDate(startMs + 30 * 86_400_000) : undefined, count: undefined })} />
      {value.until && <DateField label="Last nominal date" value={new Date(`${value.until}T12:00:00`).getTime()}
        dateOnly onChange={(ms) => patch({ until: localDate(ms) })} />}
      {!value.until && value.count == null && <Copy muted>No ending.</Copy>}
      <Heading>Time zone</Heading>
      <Toggle label="Keep a named time zone when travelling" value={value.zoneMode === 'pinned'}
        onChange={(enabled) => patch({ zoneMode: enabled ? 'pinned' : 'floating' })} />
      {value.zoneMode === 'pinned' && <Field label="Named time zone" value={zoneId ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
        onChangeText={setZone} placeholder="America/Los_Angeles" autoCapitalize="none" />}
      <Copy muted>{value.zoneMode === 'pinned' ? 'Future times stay in this named zone.' : 'Future local times follow the device time zone.'} Postponed alerts keep their chosen instant. Clock gaps shift forward; repeated clock times use the earlier offset.</Copy>
    </>}
  </Card>;
}
function localDate(ms: number) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
