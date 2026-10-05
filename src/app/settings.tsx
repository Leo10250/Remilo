import { router } from 'expo-router';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { PermissionsAndroid, View } from 'react-native';
import type { AppSettings } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Choice, Copy, DateField, Field, Group, IconButton, Page, SettingRow, Sheet, Status, Toggle } from '../ui/components';
import { engine, preferences, useCapabilities, useSettings } from '../ui/native';
type Picker = 'sound' | 'snooze' | 'theme' | null;
function timeValue(minutes: number) { const date = new Date(); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); return date.getTime(); }
export default function Settings() {
  const query = useSettings(), caps = useCapabilities();
  const [picker, setPicker] = useState<Picker>(null), [minutes, setMinutes] = useState('10'), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const settings = query.data;
  const run = async (task: () => Promise<void>) => { setBusy(true); setMessage(''); try { await task(); }
    catch { setMessage('Could not complete that action. Please try again.'); } finally { setBusy(false); } };
  const access = (kind: 'exact' | 'notifications' | 'fullScreen') => void run(async () => {
    if (kind === 'notifications' && !caps.data?.notifications) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) await engine().openSettings(kind);
    } else await engine().openSettings(kind);
  });
  const save = (patch: Partial<AppSettings>) => preferences.change(patch);
  const permissionLabel = (enabled?: boolean, limited = false) => enabled === undefined ? 'Checking' : enabled ? 'Allowed' : limited ? 'Limited' : 'Blocked';
  const permission = (enabled?: boolean, limited = false) => <Status label={enabled === undefined ? 'Checking' : enabled ? 'Allowed' : limited ? 'Limited' : 'Blocked'}
    tone={enabled === undefined ? 'muted' : enabled ? 'success' : limited ? 'warning' : 'danger'} />;
  const exportFile = () => void run(async () => {
    const data = await engine().exportBackup(), directory = new Directory(Paths.cache, 'remilo-exports');
    directory.create({ idempotent: true, intermediates: true });
    const file = new File(directory, 'remilo-' + Date.now() + '.json'); file.create(); file.write(data);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Remilo backup' });
    setMessage('Backup prepared. Save it using the share menu.');
  });
  return <Page title="Settings">
    {!settings ? <Copy>{query.isLoading ? 'Loading…' : 'Could not load settings.'}</Copy> : <>
      <Group title="Alarms">
        <SettingRow icon="volume_up" label="Sound" value={settings.sound === 'system' ? 'System alarm' : 'Remilo'}
          onPress={() => setPicker('sound')} />
        <Toggle icon="vibration" label="Vibration" value={settings.vibration} onChange={(vibration) => save({ vibration })} />
        <SettingRow icon="snooze" label="Snooze duration" value={settings.snoozeMinutes + ' minutes'}
          onPress={() => { setMinutes(String(settings.snoozeMinutes)); setPicker('snooze'); }} />
        <SettingRow icon="alarm" label="Test alarm" description="Rings in 15 seconds" disabled={busy} onPress={() => void run(async () => {
          const result = await engine().scheduleTestAlarm();
          setMessage(result.status === 'Scheduled' ? 'Test alarm set for 15 seconds from now.' : 'Test saved, but blocked. Check permissions below.');
        })} />
      </Group>
      <Copy muted size={13}>Sound and vibration defaults apply to new reminders.</Copy>
      <Group title="Permissions">
        <SettingRow icon="schedule" label="On-time alarms" description={caps.data?.exactAlarms === false ? 'Allow alarms to ring at their scheduled time.' : undefined}
          disabled={busy} statusLabel={permissionLabel(caps.data?.exactAlarms)} onPress={() => access('exact')}>{permission(caps.data?.exactAlarms)}</SettingRow>
        <SettingRow icon="notifications" label="Notifications" description={caps.data && (!caps.data.notifications || !caps.data.channelEnabled || !caps.data.notificationChannelEnabled)
          ? 'Allow notifications and enable Remilo’s channels.' : undefined} disabled={busy}
          statusLabel={permissionLabel(caps.data ? caps.data.notifications && caps.data.channelEnabled && caps.data.notificationChannelEnabled : undefined)} onPress={() => access('notifications')}>
          {permission(caps.data ? caps.data.notifications && caps.data.channelEnabled && caps.data.notificationChannelEnabled : undefined)}
        </SettingRow>
        <SettingRow icon="lock" label="Lock-screen alarms" description={caps.data?.fullScreen === false ? 'Notifications remain available without full-screen access.' : undefined}
          disabled={busy} statusLabel={permissionLabel(caps.data?.fullScreen, true)} onPress={() => access('fullScreen')}>{permission(caps.data?.fullScreen, true)}</SettingRow>
      </Group>
      {caps.error && <Status label="Could not check permissions. Return to refresh." tone="warning" />}
      <Group title="Postpone shortcuts">
        {(['tomorrowMorning', 'tomorrowAfternoon', 'tomorrowEvening'] as const).map((key, index) => <DateField key={key}
          label={['Tomorrow morning', 'Tomorrow afternoon', 'Tomorrow evening'][index]} timeOnly value={timeValue(settings[key])}
          onChange={(value) => { const date = new Date(value); save({ [key]: date.getHours() * 60 + date.getMinutes() }); }} />)}
      </Group>
      <Group title="Appearance"><SettingRow icon="palette" label="Theme" value={settings.theme === 'system' ? 'Follow device' : settings.theme === 'light' ? 'Light' : 'Dark'}
        onPress={() => setPicker('theme')} /></Group>
      {query.saving && <Copy muted size={13}>Saving changes…</Copy>}
      {query.saveError && <Group><Status label={query.saveError} tone="danger" /><Button label="Retry saving changes" variant="secondary" onPress={preferences.retry} /></Group>}
    </>}
    <Group title="Data">
      <SettingRow icon="upload" label="Export backup" disabled={busy} onPress={exportFile} />
      <SettingRow icon="download" label="Restore backup" onPress={() => router.push('/backup')} />
    </Group>
    <Group title="Help"><SettingRow icon="info" label="Diagnostics" onPress={() => router.push('/diagnostics')} />
      <SettingRow label="Remilo" value="0.4.0 · Android" /></Group>
    {!!message && <Status label={message} />}
    <Sheet title={picker === 'sound' ? 'Alarm sound' : picker === 'theme' ? 'Theme' : 'Snooze duration'} visible={picker !== null} onClose={() => setPicker(null)}>
      {picker === 'sound' && (['remilo', 'system'] as const).map((sound) => <View key={sound} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}><Choice label={sound === 'remilo' ? 'Remilo' : 'System alarm'} selected={settings?.sound === sound}
          onPress={() => { save({ sound }); setPicker(null); }} /></View>
        <IconButton icon="play_arrow" label={'Preview ' + sound + ' sound'} onPress={() => void run(async () => {
          const result = await engine().previewSound(sound); if (result.status === 'Rejected') setMessage(result.errorMessage ?? 'Sound unavailable.');
        })} />
      </View>)}
      {picker === 'theme' && (['system', 'light', 'dark'] as const).map((theme) => <Choice key={theme} label={theme === 'system' ? 'Follow device' : theme === 'light' ? 'Light' : 'Dark'}
        selected={settings?.theme === theme} onPress={() => { save({ theme }); setPicker(null); }} />)}
      {picker === 'snooze' && <>
        {[5, 10, 15, 30].map((duration) => <Choice key={duration} label={duration + ' minutes'} selected={settings?.snoozeMinutes === duration}
          onPress={() => { save({ snoozeMinutes: duration }); setPicker(null); }} />)}
        <Field label="Custom minutes (1–1440)" value={minutes} keyboardType="number-pad" onChangeText={setMinutes} />
        <Button label="Use custom duration" disabled={!/^\d+$/.test(minutes) || Number(minutes) < 1 || Number(minutes) > 1440}
          onPress={() => { save({ snoozeMinutes: Number(minutes) }); setPicker(null); }} />
      </>}
    </Sheet>
  </Page>;
}
