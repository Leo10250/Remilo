import { router } from 'expo-router';
import { useState } from 'react';
import type { AppSettings } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Card, Copy, DateField, Field, Heading, Page, Toggle } from '../ui/components';
import { engine, useCommand, useSettings } from '../ui/native';

function timeValue(minutes: number) { const date = new Date(); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); return date.getTime(); }
export default function Settings() {
  const query = useSettings();
  if (!query.data) return <Page title="Settings"><Copy>{query.isLoading ? 'Loading…' : 'Could not load settings. Return and retry.'}</Copy></Page>;
  return <SettingsForm key={query.data.revision} initial={query.data} />;
}
function SettingsForm({ initial }: { initial: AppSettings }) {
  const command = useCommand();
  const [draft, setDraft] = useState<AppSettings>(initial);
  const [snooze, setSnooze] = useState(String(initial.snoozeMinutes));
  const [message, setMessage] = useState('');
  const patch = (value: Partial<AppSettings>) => setDraft((current) => ({ ...current, ...value }));
  const save = async () => {
    if (!draft) return;
    setMessage('');
    try {
      await command.mutateAsync({ ...draft, kind: 'Settings', expectedRevision: draft.revision,
        snoozeMinutes: Number(snooze), operationId: engine().createOperationId() });
      setMessage('Settings saved. Sound and vibration defaults apply to new reminders.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save settings.'); }
  };
  return <Page title="Settings" subtitle="Reminders stay on this device. No account required.">
    <Card><Heading>Delivery</Heading><Button label="Alarm readiness & test alarm" onPress={() => router.push('/readiness')} /></Card>
    {draft && <>
      <Card><Heading>Snooze</Heading><Field label="Minutes" keyboardType="number-pad" value={snooze} onChangeText={setSnooze} />
        <Copy muted>Quick Snooze uses this duration, including before first unlock.</Copy>
      </Card>
      <Card><Heading>Tomorrow presets</Heading>{(['tomorrowMorning', 'tomorrowAfternoon', 'tomorrowEvening'] as const).map((key, index) =>
        <DateField key={key} label={['Morning', 'Afternoon', 'Evening'][index]} timeOnly value={timeValue(draft[key])}
          onChange={(value) => { const date = new Date(value); patch({ [key]: date.getHours() * 60 + date.getMinutes() }); }} />)}
      </Card>
      <Card><Heading>New reminder defaults</Heading>{(['remilo', 'system'] as const).map((sound) =>
        <Button key={sound} label={`${draft.sound === sound ? '✓ ' : ''}${sound === 'remilo' ? 'Remilo tone' : 'System alarm tone'}`}
          variant={draft.sound === sound ? 'primary' : 'secondary'} onPress={() => patch({ sound })} />)}
        <Button label="Preview sound for 5 seconds" variant="secondary" onPress={() => {
          void engine().previewSound(draft.sound).then((result) => { if (result.status === 'Rejected') setMessage(result.errorMessage ?? 'Sound preview unavailable.'); })
            .catch(() => setMessage('Could not start sound preview. Check alarm volume.'));
        }} />
        <Copy muted>The system tone falls back to Remilo if its file is unavailable, including before first unlock.</Copy>
        <Toggle label="Vibrate while ringing" value={draft.vibration} onChange={(vibration) => patch({ vibration })} />
      </Card>
      <Card><Heading>Appearance</Heading>{(['system', 'light', 'dark'] as const).map((theme) =>
        <Button key={theme} label={`${draft.theme === theme ? '✓ ' : ''}${theme === 'system' ? 'Follow device' : theme === 'light' ? 'Light' : 'Dark'}`}
          variant={draft.theme === theme ? 'primary' : 'secondary'} onPress={() => patch({ theme })} />)}
      </Card>
      <Button label={command.isPending ? 'Saving…' : 'Save settings'} disabled={command.isPending} onPress={() => void save()} />
    </>}
    {!!message && <Copy>{message}</Copy>}
    <Card><Heading>Your data</Heading><Button label="Backup & restore" variant="secondary" onPress={() => router.push('/backup')} />
      <Button label="Local diagnostics" variant="secondary" onPress={() => router.push('/diagnostics')} /></Card>
  </Page>;
}
