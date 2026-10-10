import { router, useLocalSearchParams } from 'expo-router';
import { normalizeAtmosphere } from '../domain/appearance';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, View } from 'react-native';
import type { AppSettings, CommandResult } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from '../domain/actions';
import { creationOrigin, retainedOriginParams, rootKey, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { TestAlarmOperation } from '../domain/test-alarm';
import type { HandoffTicket } from '../domain/handoff';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, DateField, Field, Page, QueryState, RowSupport, SettingRow, Sheet, shortDateTime, Status, Toggle } from '../ui/components';
import { engine, nativeAvailable, preferences, useCapabilities, useSettings } from '../ui/native';
import { PreferenceFeedback } from '../ui/preference-feedback';
import { SoundPicker } from '../ui/sound-picker';
import { useAppearanceHold } from '../ui/theme';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { usePageHandoff } from '../ui/handoff';
import { space } from '../ui/tokens';

type Action = 'test' | 'permissions' | 'export';
type Feedback = { message: string; tone: Tone };
const preferenceGroups = [
  ['defaults', ['sound', 'vibration']],
  ['snooze', ['snoozeMinutes']],
  ['shortcuts', ['tomorrowMorning', 'tomorrowAfternoon', 'tomorrowEvening']],
  ['appearance', ['theme', 'atmosphere']],
] as const;
function timeValue(minutes: number) { const date = new Date(); date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); return date.getTime(); }
function appearanceSummary(settings: AppSettings) {
  const atmosphere = normalizeAtmosphere(settings.atmosphere);
  return `${atmosphere[0].toUpperCase() + atmosphere.slice(1)} · ${settings.theme === 'system' ? 'System' : settings.theme === 'light' ? 'Light' : 'Dark'}`;
}
function testFeedback(result: CommandResult): Feedback {
  if (result.status === 'Rejected') return { message: result.errorMessage ?? 'Test alarm could not be created.', tone: 'danger' };
  if (result.status === 'Blocked') return { message: 'Test reminder saved; alert blocked. Review permissions and its next alert status.', tone: 'warning' };
  if (result.status === 'Pending') return { message: 'Test reminder saved; scheduling pending. Check its next alert status.', tone: 'warning' };
  if (result.retry && !result.occurrence) return { message: 'Your previous test reminder was confirmed. Check its next alert status.', tone: 'muted' };
  return { message: result.occurrence?.nextAlertMs != null ? `Test alarm scheduled for ${shortDateTime(result.occurrence.nextAlertMs)}.` : 'Test reminder saved. Check its next alert status.', tone: result.status === 'Scheduled' ? 'success' : 'muted' };
}
export default function Settings() {
  const params = useLocalSearchParams<OriginParams>(), origin = creationOrigin(params), routeParams = retainedOriginParams(params);
  const query = useSettings(), caps = useCapabilities();
  const confirm = useAppearanceConfirmation();
  const [picker, setPicker] = useState(false), [minutes, setMinutes] = useState('10');
  const [feedback, setFeedback] = useState<Partial<Record<Action, Feedback>>>({}), [pending, setPending] = useState<Action | null>(null), running = useRef(false);
  const activeAction = useRef<Action | null>(null);
  const [test, setTest] = useState<CommandResult>(), [uncertainTest, setUncertainTest] = useState(false);
  const [preparedExport, setPreparedExport] = useState<File>(), mounted = useRef(true);
  const [operation] = useState(() => new TestAlarmOperation({ id: () => engine().createOperationId(), schedule: (id) => engine().scheduleTestAlarm(id) }));
  const handoff = usePageHandoff(() => setPending(activeAction.current));
  const busy = pending !== null, frozen = busy || uncertainTest, settings = query.data;
  useAppearanceHold(pending === 'test' || uncertainTest);
  usePreventRemove(pending === 'test' || uncertainTest, () => confirm('Test alarm not yet confirmed', 'Wait for this request, or retry the same test before leaving.'));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (action: Action, task: (ticket?: HandoffTicket) => Promise<Feedback | undefined>) => {
    if (running.current || uncertainTest && action !== 'test') return;
    const ticket = action === 'export' ? handoff.scope.capture() : undefined;
    if (ticket && !handoff.scope.canLaunch(ticket)) return;
    running.current = true; activeAction.current = action; setPending(action); setFeedback((old) => ({ ...old, [action]: undefined }));
    const publish = (result: Feedback) => {
      const update = () => setFeedback((old) => ({ ...old, [action]: result }));
      if (ticket) handoff.commit(ticket, update); else if (mounted.current) update();
    };
    try { const result = await task(ticket); if (result) publish(result); }
    catch (error) { publish({ message: error instanceof Error ? error.message : 'Could not complete that action. Try again.', tone: 'danger' }); }
    finally { running.current = false; activeAction.current = null; if (mounted.current && (!ticket || handoff.scope.active())) setPending(null); }
  };
  const scheduleTest = () => void run('test', async () => {
    try { const result = await operation.run(); setTest(result); setUncertainTest(false); return testFeedback(result); }
    catch { setUncertainTest(operation.pending); return { message: 'Test alarm not confirmed. Retry the same test before leaving; another test may create a duplicate reminder.', tone: 'warning' }; }
  });
  const access = (kind: 'exact' | 'notifications' | 'fullScreen') => void run('permissions', async () => {
    if (kind === 'notifications' && caps.data?.notifications === false) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) await engine().openSettings(kind);
    } else await engine().openSettings(kind);
    await caps.refetch();
    return { message: 'Permissions are checked again when you return to Remilo.', tone: 'muted' };
  });
  const save = (patch: Partial<AppSettings>) => { if (!frozen) preferences.change(patch); };
  const permissionLabel = (enabled?: boolean, limited = false) => enabled === undefined ? caps.error && !caps.data ? 'Unavailable' : 'Checking' : enabled ? 'Allowed' : limited ? 'Limited' : 'Blocked';
  const permission = (enabled?: boolean, limited = false) => <Status label={permissionLabel(enabled, limited)} tone={enabled === undefined ? 'muted' : enabled ? 'success' : limited ? 'warning' : 'danger'} />;
  const sharePrepared = async (file: File, ticket: HandoffTicket): Promise<Feedback | undefined> => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!handoff.scope.canLaunch(ticket)) return;
      if (!available) return { message: 'Backup prepared. Sharing is unavailable on this device. You can retry sharing this file.', tone: 'warning' };
      if (!handoff.scope.markOpened(ticket)) return;
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Remilo backup' });
      return { message: 'Backup prepared and opened in the share sheet. Remilo cannot confirm whether you saved or sent it.', tone: 'muted' };
    } catch { return { message: 'Backup prepared, but the share sheet could not be opened. Retry sharing this file.', tone: 'danger' }; }
  };
  const exportFile = () => void run('export', async (ticket) => {
    if (!ticket) return;
    const data = await engine().exportBackup();
    if (!handoff.scope.canLaunch(ticket)) return;
    const directory = new Directory(Paths.cache, 'remilo-exports');
    directory.create({ idempotent: true, intermediates: true });
    const file = new File(directory, 'remilo-' + Date.now() + '.json'); file.create(); file.write(data);
    if (mounted.current) setPreparedExport(file);
    return sharePrepared(file, ticket);
  });
  const snoozeValid = /^\d+$/.test(minutes) && Number(minutes) >= 1 && Number(minutes) <= 1440;
  // One operation can contain fields from several groups; expose its recovery once.
  const preferenceOwner = preferenceGroups.find(([, fields]) => fields.some((field) => query.preferenceFields.includes(field)));
  const preferenceFeedback = (group: typeof preferenceGroups[number][0]) =>
    preferenceOwner?.[0] === group && (query.saving || query.saveError) ? <PreferenceFeedback fields={[...preferenceOwner[1]]} /> : undefined;
  return <Page title="Settings" scrollKey={`settings:${rootKey(origin)}`} scrollReady={!!settings || !query.isLoading}
    onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(routeParams))}>
    <View style={{ gap: space.md }}>
    <QueryState loading={!settings && query.isLoading && nativeAvailable} error={!settings ? query.error : undefined} empty={!settings && !query.isLoading}
      emptyMessage={nativeAvailable ? 'Settings are unavailable.' : 'Use the Android app to manage settings.'} onRetry={nativeAvailable ? () => void query.refetch() : undefined} />
    {!!settings && <>
      <View style={{ gap: space.md }}>
        <ConnectedGroup title="Alarms" footer={<>
          <Copy muted size={14}>Sound and vibration are defaults for new reminders. Existing reminders keep their choices.</Copy>
          {preferenceFeedback('defaults')}
        </>}>
          <SoundPicker key="sound" value={settings.sound} onChange={(sound) => save({ sound })} disabled={frozen} />
          <Toggle key="vibration" icon="vibration" label="Vibration" value={settings.vibration} disabled={frozen} onChange={(vibration) => save({ vibration })} />
        </ConnectedGroup>
        <ConnectedGroup footer={<>
          <Copy muted size={14}>Used the next time you Snooze, including existing alerts. A current target or ringing deadline does not move.</Copy>
          {preferenceFeedback('snooze')}
        </>}>
          <SettingRow key="snooze" icon="snooze" label="Snooze duration" value={settings.snoozeMinutes + ' minutes'} disabled={frozen}
            onPress={() => { setMinutes(String(settings.snoozeMinutes)); setPicker(true); }} />
        </ConnectedGroup>
        <ConnectedGroup>
          <View key="test"><SettingRow icon="alarm" label={test && !uncertainTest ? 'Schedule a new test alarm' : 'Test alarm'} description="Schedule a test in 15 seconds" disabled={frozen} onPress={scheduleTest} />
            {(pending === 'test' || feedback.test || uncertainTest) && <RowSupport>
              {(pending === 'test' || feedback.test) && <ActionFeedback loading={pending === 'test'} message={pending === 'test' ? 'Scheduling test alarm…' : feedback.test?.message} tone={feedback.test?.tone} />}
              {uncertainTest && <Button label="Retry same test" variant="secondary" disabled={busy} onPress={scheduleTest} />}
            </RowSupport>}
          </View>
          {test?.occurrence && !uncertainTest && <SettingRow key="view-test" label="View test reminder" disabled={frozen} onPress={() => {
            if (running.current || frozen) return;
            router.push({ pathname: '/reminder/[id]', params: { id: test.occurrence!.id, ...routeParams } });
          }} />}
        </ConnectedGroup>
      </View>
      <ConnectedGroup title="Permissions" footer={<>
        {caps.error && <ActionFeedback tone="warning" message={caps.data ? `Last checked ${shortDateTime(caps.data.observedAtMs)}; could not refresh permissions.` : 'Could not check permissions.'} />}
        {caps.error && <Button label="Retry permission check" variant="secondary" disabled={caps.isFetching || frozen} onPress={() => void caps.refetch()} />}
        {caps.isFetching && <ActionFeedback loading message={caps.data ? 'Refreshing permissions…' : 'Checking permissions…'} />}
        {(pending === 'permissions' || feedback.permissions) && <ActionFeedback loading={pending === 'permissions'} message={pending === 'permissions' ? 'Opening permission settings…' : feedback.permissions?.message} tone={feedback.permissions?.tone} />}
        <Copy muted size={14}>Allowed means checked access. It does not confirm volume, playback or audibility.</Copy>
      </>}>
        <SettingRow key="exact" icon="schedule" label="On-time alarms" description={caps.data?.exactAlarms === false ? 'Exact-alarm access is blocked for Alarm scheduling.' : undefined}
          disabled={frozen || !nativeAvailable} statusLabel={permissionLabel(caps.data?.exactAlarms)} onPress={() => access('exact')}>{permission(caps.data?.exactAlarms)}</SettingRow>
        <View key="notifications"><SettingRow icon="notifications" label="Notifications" description={caps.data && (!caps.data.notifications || !caps.data.channelEnabled || !caps.data.notificationChannelEnabled)
          ? 'Check app access and the channels below. Each channel has separate delivery requirements.' : undefined} disabled={frozen || !nativeAvailable}
          statusLabel={permissionLabel(caps.data ? caps.data.notifications && caps.data.channelEnabled && caps.data.notificationChannelEnabled : undefined)} onPress={() => access('notifications')}>
          {permission(caps.data ? caps.data.notifications && caps.data.channelEnabled && caps.data.notificationChannelEnabled : undefined)}
        </SettingRow>
          {!!caps.data && <RowSupport>
            {[['App notifications', caps.data.notifications], ['Alarm channel', caps.data.channelEnabled], ['Reminder channel', caps.data.notificationChannelEnabled]].map(([label, allowed]) =>
              <View key={String(label)} style={{ gap: space.xs }}><Copy>{String(label)}</Copy><Copy muted size={14}>{allowed ? 'Allowed' : 'Blocked'}</Copy></View>)}
          </RowSupport>}
        </View>
        <SettingRow key="lock-screen" icon="lock" label="Lock-screen alarms" description={caps.data?.fullScreen === false ? 'Full-screen presentation is unavailable. Notification delivery follows its separate access and channel settings.' : undefined}
          disabled={frozen || !nativeAvailable} statusLabel={permissionLabel(caps.data?.fullScreen, true)} onPress={() => access('fullScreen')}>{permission(caps.data?.fullScreen, true)}</SettingRow>
      </ConnectedGroup>
      <ConnectedGroup title="Postpone shortcuts" footer={<>
        <Copy muted size={14}>Local clock times for later Postpone selections. Already postponed reminders keep their chosen instant.</Copy>
        {preferenceFeedback('shortcuts')}
      </>}>
        {(['tomorrowMorning', 'tomorrowAfternoon', 'tomorrowEvening'] as const).map((key, index) => <DateField key={key}
          label={['Tomorrow morning', 'Tomorrow afternoon', 'Tomorrow evening'][index]} timeOnly value={timeValue(settings[key])} disabled={frozen}
          onChange={(value) => { const date = new Date(value); save({ [key]: date.getHours() * 60 + date.getMinutes() }); }} />)}
      </ConnectedGroup>
      <ConnectedGroup title="Appearance" footer={preferenceFeedback('appearance')}><SettingRow key="appearance" icon="palette" label="Appearance" value={appearanceSummary(settings)} disabled={frozen}
        onPress={() => router.push({ pathname: '/appearance', params: routeParams })} /></ConnectedGroup>
    </>}
    <ConnectedGroup title="Google Calendar"><SettingRow key="google-calendar" icon="event" label="Google Calendar" description="Optional, manual one-off publishing" disabled={frozen}
      onPress={() => router.push({ pathname: '/calendar', params: routeParams })} /></ConnectedGroup>
    <ConnectedGroup title="Data" footer={<Copy muted size={14}>Backups contain titles, notes, lists and reminders in plain JSON. They exclude one-off reminders in Trash; repeating deletion exclusions are kept. App settings, appearance and Google Calendar connection/publication data are excluded.</Copy>}>
      <View key="export"><SettingRow icon="upload" label="Export backup" disabled={frozen || !nativeAvailable} onPress={exportFile} />
        {(pending === 'export' || feedback.export || preparedExport) && <RowSupport>
          {(pending === 'export' || feedback.export) && <ActionFeedback loading={pending === 'export'} message={pending === 'export' ? 'Preparing backup and opening share sheet…' : feedback.export?.message} tone={feedback.export?.tone} />}
          {preparedExport && <Button label="Share prepared backup again" variant="secondary" disabled={frozen} onPress={() => void run('export', (ticket) => ticket ? sharePrepared(preparedExport, ticket) : Promise.resolve(undefined))} />}
        </RowSupport>}
      </View>
      <SettingRow key="restore" icon="download" label="Restore backup" disabled={frozen} onPress={() => router.push({ pathname: '/backup', params: routeParams })} />
    </ConnectedGroup>
    <ConnectedGroup title="Help" footer={<><Copy>Remilo</Copy><Copy muted size={14}>0.4.0 · Android</Copy></>}>
      <SettingRow key="diagnostics" icon="info" label="Diagnostics" disabled={frozen} onPress={() => router.push({ pathname: '/diagnostics', params: routeParams })} />
    </ConnectedGroup>
    <Sheet title="Snooze duration" visible={picker} onClose={() => setPicker(false)} footer={<BottomActionBar><View style={{ flex: 1 }}>
      <Button label="Use custom duration" disabled={!snoozeValid || frozen} onPress={() => { save({ snoozeMinutes: Number(minutes) }); setPicker(false); }} />
    </View></BottomActionBar>}>
      {[5, 10, 15, 30].map((duration) => <Choice key={duration} label={duration + ' minutes'} selected={settings?.snoozeMinutes === duration}
        onPress={() => { save({ snoozeMinutes: duration }); setPicker(false); }} />)}
      <Field label="Custom minutes (1–1440)" value={minutes} keyboardType="number-pad" onChangeText={setMinutes} error={!snoozeValid ? 'Enter a whole number from 1 to 1440.' : undefined} />
    </Sheet>
    </View>
  </Page>;
}
