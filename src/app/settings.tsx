import { router, useLocalSearchParams } from 'expo-router';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { AppSettings } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from '../domain/actions';
import { normalizeAtmosphere } from '../domain/appearance';
import { clockPreferenceLabel } from '../domain/clock-preferences';
import { creationOrigin, retainedOriginParams, rootKey, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { atmosphereNames, permissionSummary, preferenceRecoveryOwner, type preferenceGroups } from '../domain/settings-presentation';
import type { HandoffTicket } from '../domain/handoff';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, Field, Page, QueryState, RowSupport, SettingRow, Sheet, shortDateTime, Toggle } from '../ui/components';
import { engine, nativeAvailable, preferences, useCapabilities, useSettings } from '../ui/native';
import { PreferenceFeedback } from '../ui/preference-feedback';
import { SoundPicker } from '../ui/sound-picker';
import { ClockPreferenceRow } from '../ui/settings-controls';
import { usePageHandoff } from '../ui/handoff';
import { space } from '../ui/tokens';

type Feedback = { message: string; tone: Tone };
function appearanceSummary(settings: AppSettings) {
  return `${atmosphereNames[normalizeAtmosphere(settings.atmosphere)]} · ${settings.theme === 'system' ? 'Match device' : settings.theme === 'light' ? 'Light' : 'Dark'}`;
}
export default function Settings() {
  const params = useLocalSearchParams<OriginParams>(), origin = creationOrigin(params), routeParams = retainedOriginParams(params);
  const query = useSettings(), caps = useCapabilities(), settings = query.data;
  const [snoozePicker, setSnoozePicker] = useState(false), [shortcuts, setShortcuts] = useState(false), [backupInfo, setBackupInfo] = useState(false);
  const [minutes, setMinutes] = useState('10'), [feedback, setFeedback] = useState<Feedback>(), [pending, setPending] = useState(false);
  const running = useRef(false), mounted = useRef(true), [preparedExport, setPreparedExport] = useState<File>();
  const handoff = usePageHandoff(() => setPending(running.current));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const runExport = async (task: (ticket: HandoffTicket) => Promise<Feedback | undefined>) => {
    if (running.current) return;
    const ticket = handoff.scope.capture();
    if (!handoff.scope.canLaunch(ticket)) return;
    running.current = true; setPending(true); setFeedback(undefined);
    try { const result = await task(ticket); if (result) handoff.commit(ticket, () => setFeedback(result)); }
    catch (error) { handoff.commit(ticket, () => setFeedback({ message: error instanceof Error ? error.message : 'Could not export this backup. Try again.', tone: 'danger' })); }
    finally { running.current = false; if (mounted.current && handoff.scope.active()) setPending(false); }
  };
  const save = (patch: Partial<AppSettings>) => { if (!pending) preferences.change(patch); };
  const sharePrepared = async (file: File, ticket: HandoffTicket): Promise<Feedback | undefined> => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!handoff.scope.canLaunch(ticket)) return;
      if (!available) return { message: 'Backup prepared. Sharing is unavailable on this device. You can retry sharing this file.', tone: 'warning' };
      if (!handoff.scope.markOpened(ticket)) return;
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Remilo backup' });
      return { message: 'Backup prepared for sharing.', tone: 'muted' };
    } catch { return { message: 'Backup prepared, but the share sheet could not be opened. Retry sharing this file.', tone: 'danger' }; }
  };
  const exportFile = () => void runExport(async ticket => {
    const data = await engine().exportBackup();
    if (!handoff.scope.canLaunch(ticket)) return;
    const directory = new Directory(Paths.cache, 'remilo-exports');
    directory.create({ idempotent: true, intermediates: true });
    const file = new File(directory, 'remilo-' + Date.now() + '.json'); file.create(); file.write(data);
    if (mounted.current) setPreparedExport(file);
    return sharePrepared(file, ticket);
  });
  const snoozeValid = /^\d+$/.test(minutes) && Number(minutes) >= 1 && Number(minutes) <= 1440;
  const preferenceOwner = preferenceRecoveryOwner(query.preferenceFields);
  const preferenceFeedback = (group: typeof preferenceGroups[number][0]) =>
    preferenceOwner?.[0] === group && (query.saving || query.saveError) ? <PreferenceFeedback fields={[...preferenceOwner[1]]} /> : undefined;
  const permission = permissionSummary(caps.data, !!caps.error);
  const openAlarmCheck = () => { if (!running.current) router.push({ pathname: '/alarm-check', params: routeParams }); };
  const permissionRefresh = caps.data && (caps.error || caps.isFetching)
    ? `Last checked ${shortDateTime(caps.data.observedAtMs)}; ${caps.error ? 'couldn’t refresh.' : 'refreshing…'}` : undefined;
  return <Page title="Settings" scrollKey={`settings:${rootKey(origin)}`} scrollReady={!!settings || !query.isLoading}
    onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(routeParams))}>
    <View style={{ gap: space.md }}>
      <QueryState loading={!settings && query.isLoading && nativeAvailable} error={!settings ? query.error : undefined} empty={!settings && !query.isLoading}
        emptyMessage={nativeAvailable ? 'Settings are unavailable.' : 'Use the Android app to manage settings.'} onRetry={nativeAvailable ? () => void query.refetch() : undefined} />
      {nativeAvailable && permission.needsAttention && <ConnectedGroup>
        <View><RowSupport><ActionFeedback message={permission.message} tone={permission.tone} />
          {permissionRefresh && <Copy muted size={14}>{permissionRefresh}</Copy>}
          <Button label="Review alert permissions" variant="secondary" disabled={pending} onPress={openAlarmCheck} />
        </RowSupport></View>
      </ConnectedGroup>}
      {!!settings && <>
        <ConnectedGroup title="Sound & vibration" footer={<><Copy muted size={14}>For new reminders.</Copy>{preferenceFeedback('defaults')}</>}>
          <SoundPicker key="sound" value={settings.sound} onChange={sound => save({ sound })} disabled={pending} />
          <Toggle key="vibration" icon="vibration" label="Vibration" value={settings.vibration} disabled={pending} onChange={vibration => save({ vibration })} />
        </ConnectedGroup>
        <ConnectedGroup title="Snooze & postpone" footer={preferenceFeedback('postponement')}>
          <SettingRow key="snooze" icon="snooze" label="Snooze duration" value={settings.snoozeMinutes + ' minutes'} disabled={pending}
            onPress={() => { setMinutes(String(settings.snoozeMinutes)); setSnoozePicker(true); }} />
          <SettingRow key="shortcuts" icon="schedule" label="Tomorrow shortcuts"
            value={[settings.tomorrowMorning, settings.tomorrowAfternoon, settings.tomorrowEvening].map(value => clockPreferenceLabel(value)).join(' · ')}
            disabled={pending} onPress={() => setShortcuts(true)} />
        </ConnectedGroup>
        <ConnectedGroup footer={preferenceFeedback('appearance')}><SettingRow key="appearance" icon="palette" label="Appearance" value={appearanceSummary(settings)} disabled={pending}
          onPress={() => router.push({ pathname: '/appearance', params: routeParams })} /></ConnectedGroup>
      </>}
      <ConnectedGroup><SettingRow key="permissions" icon="alarm" label="Permissions & alarm check" value={nativeAvailable ? permission.message : 'Available in the Android app'}
        description={permissionRefresh} disabled={pending} onPress={openAlarmCheck} /></ConnectedGroup>
      <ConnectedGroup><SettingRow key="google-calendar" icon="event" label="Google Calendar" description="Optional, manual one-off publishing" disabled={pending}
        onPress={() => router.push({ pathname: '/calendar', params: routeParams })} /></ConnectedGroup>
      <ConnectedGroup title="Backups" footer={<><Copy muted size={14}>Includes titles, notes, lists and reminders.</Copy>
        <Button label="What’s included?" variant="secondary" disabled={pending} onPress={() => setBackupInfo(true)} /></>}>
        <View key="export"><SettingRow icon="upload" label="Export backup" disabled={pending || !nativeAvailable} onPress={exportFile} />
          {(pending || feedback || preparedExport) && <RowSupport>
            {(pending || feedback) && <ActionFeedback loading={pending} message={pending ? 'Preparing backup…' : feedback?.message} tone={feedback?.tone} />}
            {preparedExport && <Button label="Share prepared backup again" variant="secondary" disabled={pending} onPress={() => void runExport(ticket => sharePrepared(preparedExport, ticket))} />}
          </RowSupport>}
        </View>
        <SettingRow key="restore" icon="download" label="Restore backup" disabled={pending} onPress={() => router.push({ pathname: '/backup', params: routeParams })} />
      </ConnectedGroup>
      <ConnectedGroup title="Help" footer={<><Copy>Remilo</Copy><Copy muted size={14}>0.4.0 · Android</Copy></>}>
        <SettingRow key="diagnostics" icon="info" label="Diagnostics" disabled={pending} onPress={() => router.push({ pathname: '/diagnostics', params: routeParams })} />
      </ConnectedGroup>
      <Sheet title="Snooze duration" visible={snoozePicker} onClose={() => setSnoozePicker(false)} footer={<BottomActionBar><View style={{ flex: 1 }}>
        <Button label="Use custom duration" disabled={!snoozeValid || pending} onPress={() => { save({ snoozeMinutes: Number(minutes) }); setSnoozePicker(false); }} />
      </View></BottomActionBar>}>
        <Copy muted size={14}>Used when you tap Snooze.</Copy>
        {[5, 10, 15, 30].map(duration => <Choice key={duration} label={duration + ' minutes'} selected={settings?.snoozeMinutes === duration}
          disabled={pending} onPress={() => { save({ snoozeMinutes: duration }); setSnoozePicker(false); }} />)}
        <Field label="Custom minutes (1–1440)" value={minutes} keyboardType="number-pad" onChangeText={setMinutes} error={!snoozeValid ? 'Enter a whole number from 1 to 1440.' : undefined} />
      </Sheet>
      <Sheet title="Tomorrow shortcuts" visible={shortcuts} onClose={() => setShortcuts(false)}>
        <Copy muted size={14}>Shown when you postpone an alert to tomorrow.</Copy>
        {!!settings && <ConnectedGroup>{(['tomorrowMorning', 'tomorrowAfternoon', 'tomorrowEvening'] as const).map(key =>
          <ClockPreferenceRow key={key} minutes={settings[key]} disabled={pending} onChange={value => save({ [key]: value })} />)}</ConnectedGroup>}
        <PreferenceFeedback fields={['tomorrowMorning', 'tomorrowAfternoon', 'tomorrowEvening']} />
      </Sheet>
      <Sheet title="What’s included in backups" visible={backupInfo} onClose={() => setBackupInfo(false)}>
        <Copy>Titles, notes, lists and reminders are included in a plain-text JSON file.</Copy>
        <Copy>One-off reminders in Trash are excluded. Repeating deletion exclusions are kept.</Copy>
        <Copy>App settings, appearance and Google Calendar connection/publication data are excluded.</Copy>
      </Sheet>
    </View>
  </Page>;
}
