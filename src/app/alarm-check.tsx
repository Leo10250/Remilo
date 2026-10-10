import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, View } from 'react-native';
import type { CommandResult } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from '../domain/actions';
import { retainedOriginParams, type OriginParams } from '../domain/navigation';
import { permissionSummary } from '../domain/settings-presentation';
import { TestAlarmOperation } from '../domain/test-alarm';
import { ActionFeedback, Button, ConnectedGroup, Copy, Disclosure, Page, QueryState, RowSupport, SettingRow, shortDateTime, Status } from '../ui/components';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { engine, nativeAvailable, useCapabilities } from '../ui/native';
import { useAppearanceHold } from '../ui/theme';

type Action = 'test' | 'permissions';
type Feedback = { message: string; tone: Tone };
type PermissionKind = 'exact' | 'notifications' | 'fullScreen';
function testFeedback(result: CommandResult): Feedback {
  if (result.status === 'Rejected') return { message: result.errorMessage ?? 'Test alarm could not be created.', tone: 'danger' };
  if (result.status === 'Blocked') return { message: 'Test reminder saved; alert blocked. Review permissions.', tone: 'warning' };
  if (result.status === 'Pending') return { message: 'Test reminder saved; scheduling pending. Check its next alert status.', tone: 'warning' };
  if (result.retry && !result.occurrence) return { message: 'Your previous test reminder was confirmed. Check its next alert status.', tone: 'muted' };
  return { message: result.occurrence?.nextAlertMs != null ? `Test alarm scheduled for ${shortDateTime(result.occurrence.nextAlertMs)}.` : 'Test reminder saved. Check its next alert status.',
    tone: result.status === 'Scheduled' ? 'success' : 'muted' };
}
export default function AlarmCheck() {
  const params = useLocalSearchParams<OriginParams>(), routeParams = retainedOriginParams(params), caps = useCapabilities();
  const confirm = useAppearanceConfirmation();
  const [feedback, setFeedback] = useState<Partial<Record<Action, Feedback>>>({}), [pending, setPending] = useState<Action | null>(null);
  const [test, setTest] = useState<CommandResult>(), [uncertainTest, setUncertainTest] = useState(false), [notificationDenied, setNotificationDenied] = useState(false);
  const running = useRef(false), mounted = useRef(true);
  const [operation] = useState(() => new TestAlarmOperation({ id: () => engine().createOperationId(), schedule: id => engine().scheduleTestAlarm(id) }));
  const busy = pending !== null, frozen = busy || uncertainTest;
  useAppearanceHold(pending === 'test' || uncertainTest);
  usePreventRemove(pending === 'test' || uncertainTest, () => confirm('Test alarm not yet confirmed', 'Wait for this request, or retry the same test before leaving.'));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (caps.data?.notifications) setNotificationDenied(false); }, [caps.data?.notifications]);
  const run = async (action: Action, task: () => Promise<Feedback>) => {
    if (running.current || operation.pending && action !== 'test') return;
    running.current = true; setPending(action); setFeedback(old => ({ ...old, [action]: undefined }));
    try { const result = await task(); if (mounted.current) setFeedback(old => ({ ...old, [action]: result })); }
    catch (error) { if (mounted.current) setFeedback(old => ({ ...old, [action]: { message: error instanceof Error ? error.message : 'Could not complete that action. Try again.', tone: 'danger' } })); }
    finally { running.current = false; if (mounted.current) setPending(null); }
  };
  const scheduleTest = () => void run('test', async () => {
    try { const result = await operation.run(); if (mounted.current) { setTest(result); setUncertainTest(false); } return testFeedback(result); }
    catch { if (mounted.current) setUncertainTest(operation.pending); return { message: 'Test alarm not confirmed. Retry the same test before leaving.', tone: 'warning' }; }
  });
  const openPermission = (kind: PermissionKind, requestNotification = true) => void run('permissions', async () => {
    if (kind === 'notifications' && requestNotification && caps.data?.notifications === false) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        if (mounted.current) setNotificationDenied(true);
        await caps.refetch();
        return { message: 'Notifications remain off. You can change access in Android settings.', tone: 'warning' };
      }
      if (mounted.current) setNotificationDenied(false);
    } else await engine().openSettings(kind);
    await caps.refetch();
    return { message: 'Permissions are checked again when you return.', tone: 'muted' };
  });
  const access = (kind: PermissionKind) => {
    if (running.current || operation.pending || !nativeAvailable) return;
    openPermission(kind);
  };
  const retryPermissions = () => {
    if (running.current || operation.pending || caps.isFetching || !nativeAvailable) return;
    void caps.refetch();
  };
  const back = () => {
    if (operation.pending) { confirm('Test alarm not yet confirmed', 'Wait for this request, or retry the same test before leaving.'); return; }
    if (router.canGoBack()) router.back(); else router.replace({ pathname: '/settings', params: routeParams });
  };
  const permissionLabel = (enabled?: boolean, limited = false) => enabled === undefined ? !nativeAvailable || caps.error && !caps.data ? 'Unavailable' : 'Checking' : enabled ? 'Allowed' : limited ? 'Limited' : 'Blocked';
  const permission = (enabled?: boolean, limited = false) => <Status label={permissionLabel(enabled, limited)} tone={enabled === undefined ? 'muted' : enabled ? 'success' : limited ? 'warning' : 'danger'} />;
  const summary = permissionSummary(caps.data, !!caps.error);
  const notificationBlocked = !!caps.data && (!caps.data.notifications || !caps.data.channelEnabled || !caps.data.notificationChannelEnabled);
  return <Page title="Permissions & alarm check" compact onBack={back}>
    {!nativeAvailable && <QueryState loading={false} empty emptyMessage="Use the Android app to check permissions and test an alarm." />}
    {nativeAvailable && <>
      {summary.needsAttention && !caps.error && <ActionFeedback message={summary.message} tone={summary.tone} />}
      {caps.error && <ActionFeedback tone="warning" message={caps.data ? `Last checked ${shortDateTime(caps.data.observedAtMs)}; couldn’t refresh permissions.` : 'Could not check permissions.'} />}
      {caps.error && <Button label="Retry permission check" variant="secondary" disabled={caps.isFetching || frozen} onPress={retryPermissions} />}
      {caps.isFetching && <ActionFeedback loading message={caps.data ? `Last checked ${shortDateTime(caps.data.observedAtMs)}; refreshing permissions…` : 'Checking permissions…'} />}
    </>}
    <ConnectedGroup title="Permissions" footer={<>
      {(pending === 'permissions' || feedback.permissions) && <ActionFeedback loading={pending === 'permissions'}
        message={pending === 'permissions' ? 'Opening permission settings…' : feedback.permissions?.message} tone={feedback.permissions?.tone} />}
      {notificationDenied && <Button label="Open notification settings" variant="secondary" disabled={frozen} onPress={() => openPermission('notifications', false)} />}
    </>}>
      <SettingRow key="exact" icon="schedule" label="On-time alarms" description={caps.data?.exactAlarms === false ? 'Allow access to schedule alarms on time.' : undefined}
        disabled={frozen || !nativeAvailable} statusLabel={permissionLabel(caps.data?.exactAlarms)} onPress={() => access('exact')}>{permission(caps.data?.exactAlarms)}</SettingRow>
      <View key="notifications"><SettingRow icon="notifications" label="Notifications" description={notificationBlocked ? 'Some alert notifications are turned off.' : undefined}
        disabled={frozen || !nativeAvailable} statusLabel={permissionLabel(caps.data ? caps.data.notifications && caps.data.channelEnabled && caps.data.notificationChannelEnabled : undefined)} onPress={() => access('notifications')}>
        {permission(caps.data ? caps.data.notifications && caps.data.channelEnabled && caps.data.notificationChannelEnabled : undefined)}
      </SettingRow>
        {!!caps.data && <RowSupport><Disclosure title="Notification details" forceOpen={notificationBlocked}>
          {([['App notifications', caps.data.notifications], ['Alarm notifications', caps.data.channelEnabled], ['Reminder notifications', caps.data.notificationChannelEnabled]] as const).map(([label, allowed]) =>
            <View key={label} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12, rowGap: 4 }}>
              <Copy>{label}</Copy><Copy muted size={14}>{allowed ? 'Allowed' : 'Blocked'}</Copy>
            </View>)}
        </Disclosure></RowSupport>}
      </View>
      <SettingRow key="lock-screen" icon="lock" label="Lock-screen alarms" description={caps.data?.fullScreen === false ? 'Full-screen alarm display is unavailable.' : undefined}
        disabled={frozen || !nativeAvailable} statusLabel={permissionLabel(caps.data?.fullScreen, true)} onPress={() => access('fullScreen')}>{permission(caps.data?.fullScreen, true)}</SettingRow>
    </ConnectedGroup>
    <ConnectedGroup title="Alarm check" footer={<Copy muted size={14}>Permissions alone don’t confirm sound. A test creates a real reminder.</Copy>}>
      <View key="test"><SettingRow icon="alarm" label={test && !uncertainTest ? 'Schedule a new test alarm' : 'Test alarm'} description="In 15 seconds"
        disabled={frozen || !nativeAvailable} onPress={scheduleTest} />
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
  </Page>;
}
