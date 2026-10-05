import { router } from 'expo-router';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { PermissionsAndroid, View } from 'react-native';
import type { AppSettings } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback, type Tone } from '../domain/actions';
import { ActionFeedback, Button, Choice, Copy, DateField, Field, Group, IconButton, Page, QueryState, SettingRow, Sheet, shortDateTime, Status, Toggle } from '../ui/components';
import { engine, nativeAvailable, preferences, useCapabilities, useSettings } from '../ui/native';
type Picker = 'sound' | 'snooze' | 'theme' | null;
type Action = 'test' | 'sound' | 'permissions' | 'export';
type Feedback = { message: string; tone: Tone };
function timeValue(minutes: number) { const date = new Date(); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); return date.getTime(); }
export default function Settings() {
  const query = useSettings(), caps = useCapabilities();
  const [picker, setPicker] = useState<Picker>(null), [minutes, setMinutes] = useState('10');
  const [feedback, setFeedback] = useState<Partial<Record<Action, Feedback>>>({}), [pending, setPending] = useState<Action | null>(null), running = useRef(false);
  const busy = pending !== null;
  const settings = query.data;
  const run = async (action: Action, task: () => Promise<Feedback>) => {
    if (running.current) return; running.current = true; setPending(action); setFeedback((old) => ({ ...old, [action]: undefined }));
    try { const result = await task(); setFeedback((old) => ({ ...old, [action]: result })); }
    catch (error) { setFeedback((old) => ({ ...old, [action]: { message: error instanceof Error ? error.message : 'Could not complete that action. Try again.', tone: 'danger' } })); }
    finally { running.current = false; setPending(null); }
  };
  const access = (kind: 'exact' | 'notifications' | 'fullScreen') => void run('permissions', async () => {
    if (kind === 'notifications' && !caps.data?.notifications) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) await engine().openSettings(kind);
    } else await engine().openSettings(kind);
    return { message: 'Return here after updating permissions.', tone: 'muted' };
  });
  const save = (patch: Partial<AppSettings>) => preferences.change(patch);
  const permissionLabel = (enabled?: boolean, limited = false) => enabled === undefined ? 'Checking' : enabled ? 'Allowed' : limited ? 'Limited' : 'Blocked';
  const permission = (enabled?: boolean, limited = false) => <Status label={enabled === undefined ? 'Checking' : enabled ? 'Allowed' : limited ? 'Limited' : 'Blocked'}
    tone={enabled === undefined ? 'muted' : enabled ? 'success' : limited ? 'warning' : 'danger'} />;
  const exportFile = () => void run('export', async () => {
    if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device. Try again when a share destination is available.');
    const data = await engine().exportBackup(), directory = new Directory(Paths.cache, 'remilo-exports');
    directory.create({ idempotent: true, intermediates: true });
    const file = new File(directory, 'remilo-' + Date.now() + '.json'); file.create(); file.write(data);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Remilo backup' });
    return { message: 'Backup prepared for sharing.', tone: 'success' };
  });
  return <Page title="Settings">
    <QueryState loading={!settings && query.isLoading && nativeAvailable} error={query.error} empty={!settings && !query.isLoading} emptyMessage="Settings are unavailable." onRetry={() => void query.refetch()} />
    {!!settings && <>
      <Group title="Alarms">
        <SettingRow icon="volume_up" label="Sound" value={settings.sound === 'system' ? 'System alarm' : 'Remilo'}
          onPress={() => setPicker('sound')} />
        <Toggle icon="vibration" label="Vibration" value={settings.vibration} onChange={(vibration) => save({ vibration })} />
        <SettingRow icon="snooze" label="Snooze duration" value={settings.snoozeMinutes + ' minutes'}
          onPress={() => { setMinutes(String(settings.snoozeMinutes)); setPicker('snooze'); }} />
        <SettingRow icon="alarm" label="Test alarm" description="Schedule a test in 15 seconds" disabled={busy} onPress={() => void run('test', async () => {
          const result = await engine().scheduleTestAlarm();
          return commandFeedback(result, result.occurrence?.nextAlertMs ? 'Test alarm scheduled for ' + shortDateTime(result.occurrence.nextAlertMs) : 'Test alarm scheduled.');
        })} />
        {(pending === 'test' || feedback.test) && <ActionFeedback loading={pending === 'test'} message={pending === 'test' ? 'Scheduling test alarm…' : feedback.test?.message} tone={feedback.test?.tone} />}
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
      <QueryState loading={false} error={caps.error} onRetry={() => void caps.refetch()} />
      {(pending === 'permissions' || feedback.permissions) && <ActionFeedback loading={pending === 'permissions'} message={pending === 'permissions' ? 'Opening permission settings…' : feedback.permissions?.message} tone={feedback.permissions?.tone} />}
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
      <SettingRow icon="upload" label="Export backup" disabled={busy || !nativeAvailable} onPress={exportFile} />
      {(pending === 'export' || feedback.export) && <ActionFeedback loading={pending === 'export'} message={pending === 'export' ? 'Preparing backup…' : feedback.export?.message} tone={feedback.export?.tone} />}
      <SettingRow icon="download" label="Restore backup" onPress={() => router.push('/backup')} />
    </Group>
    <Group title="Help"><SettingRow icon="info" label="Diagnostics" onPress={() => router.push('/diagnostics')} />
      <SettingRow label="Remilo" value="0.4.0 · Android" /></Group>
    <Sheet title={picker === 'sound' ? 'Alarm sound' : picker === 'theme' ? 'Theme' : 'Snooze duration'} visible={picker !== null} onClose={() => setPicker(null)}>
      {picker === 'sound' && (['remilo', 'system'] as const).map((sound) => <View key={sound} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}><Choice label={sound === 'remilo' ? 'Remilo' : 'System alarm'} selected={settings?.sound === sound}
          onPress={() => { save({ sound }); setPicker(null); }} /></View>
        <IconButton icon="play_arrow" label={'Preview ' + sound + ' sound'} disabled={busy} onPress={() => void run('sound', async () => {
          const result = await engine().previewSound(sound); return commandFeedback(result, 'Sound preview started.');
        })} />
      </View>)}
      {picker === 'sound' && (pending === 'sound' || feedback.sound) && <ActionFeedback loading={pending === 'sound'} message={pending === 'sound' ? 'Starting sound preview…' : feedback.sound?.message} tone={feedback.sound?.tone} />}
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
