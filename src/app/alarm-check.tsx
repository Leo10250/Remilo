import { errorText, t } from '../localization';
import { useLocalizedState, useTranslation } from '../localization/react';
import { useTimeFormatting } from '../ui/time-display';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, View } from 'react-native';
import type { CommandResult } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from '../domain/actions';
import { retainedOriginParams, type OriginParams } from '../domain/navigation';
import { permissionSummary } from '../domain/settings-presentation';
import { TestAlarmOperation } from '../domain/test-alarm';
import { ActionFeedback, Button, ConnectedGroup, Copy, Disclosure, Page, QueryState, RowSupport, SettingRow, Status } from '../ui/components';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { engine, nativeAvailable, useCapabilities } from '../ui/native';
import { useAppearanceHold } from '../ui/theme';

type Action = 'test' | 'permissions';
type Feedback = { message: string; tone: Tone };
type PermissionKind = 'exact' | 'notifications' | 'fullScreen';
function testFeedback(result: CommandResult, format: (value: number) => string): Feedback {
  if (result.status === 'Rejected') return { message: result.errorMessage ?? t('m_36ef6cf2c46c'), tone: 'danger' };
  if (result.status === 'Blocked') return { message: t('m_010a597d991e'), tone: 'warning' };
  if (result.status === 'Pending') return { message: t('m_7a5132b4d647'), tone: 'warning' };
  if (result.retry && !result.occurrence) return { message: t('m_031724e4ae59'), tone: 'muted' };
  return { message: result.occurrence?.nextAlertMs != null ? t('m_7c8a0e2eb3d3', { arg0: String(format(result.occurrence.nextAlertMs)) }) : t('m_cd2217e1cbe2'),
    tone: result.status === 'Scheduled' ? 'success' : 'muted' };
}
export default function AlarmCheck() {
  'use no memo';
  const t = useTranslation();
  const { shortDateTime } = useTimeFormatting();
  const params = useLocalSearchParams<OriginParams>(), routeParams = retainedOriginParams(params), caps = useCapabilities();
  const confirm = useAppearanceConfirmation();
  const [feedback, setFeedback] = useLocalizedState<Partial<Record<Action, Feedback>>>({}), [pending, setPending] = useState<Action | null>(null);
  const [test, setTest] = useState<CommandResult>(), [uncertainTest, setUncertainTest] = useState(false), [notificationDenied, setNotificationDenied] = useState(false);
  const running = useRef(false), mounted = useRef(true);
  const [operation] = useState(() => new TestAlarmOperation({ id: () => engine().createOperationId(), schedule: id => engine().scheduleTestAlarm(id) }));
  const busy = pending !== null, frozen = busy || uncertainTest;
  useAppearanceHold(pending === 'test' || uncertainTest);
  usePreventRemove(pending === 'test' || uncertainTest, () => confirm(t('m_42cf9dffd1d4'), t('m_82920cc8bb89')));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (caps.data?.notifications) setNotificationDenied(false); }, [caps.data?.notifications]);
  const run = async (action: Action, task: () => Promise<Feedback>) => {
    if (running.current || operation.pending && action !== 'test') return;
    running.current = true; setPending(action); setFeedback(old => ({ ...old, [action]: undefined }));
    try { const result = await task(); if (mounted.current) setFeedback(old => ({ ...old, [action]: result })); }
    catch (error) { if (mounted.current) setFeedback(old => ({ ...old, [action]: { message: errorText(error, t('m_eaf8e694f3fe')), tone: 'danger' } })); }
    finally { running.current = false; if (mounted.current) setPending(null); }
  };
  const scheduleTest = () => void run('test', async () => {
    try { const result = await operation.run(); if (mounted.current) { setTest(result); setUncertainTest(false); } return testFeedback(result, shortDateTime); }
    catch { if (mounted.current) setUncertainTest(operation.pending); return { message: t('m_95c4f83972cf'), tone: 'warning' }; }
  });
  const openPermission = (kind: PermissionKind, requestNotification = true) => void run('permissions', async () => {
    if (kind === 'notifications' && requestNotification && caps.data?.notifications === false) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        if (mounted.current) setNotificationDenied(true);
        await caps.refetch();
        return { message: t('m_f357218ab66c'), tone: 'warning' };
      }
      if (mounted.current) setNotificationDenied(false);
    } else await engine().openSettings(kind);
    await caps.refetch();
    return { message: t('m_65f4158b6c7d'), tone: 'muted' };
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
    if (operation.pending) { confirm(t('m_42cf9dffd1d4'), t('m_82920cc8bb89')); return; }
    if (router.canGoBack()) router.back(); else router.replace({ pathname: '/settings', params: routeParams });
  };
  const permissionLabel = (enabled?: boolean, limited = false) => enabled === undefined ? !nativeAvailable || caps.error && !caps.data ? t('m_ca1844969742') : t('m_0dfe1d63c9d8') : enabled ? t('m_1bb201d18835') : limited ? t('m_e5125d9f63d2') : t('m_18f2a0947f9d');
  const permission = (enabled?: boolean, limited = false) => <Status label={permissionLabel(enabled, limited)} tone={enabled === undefined ? 'muted' : enabled ? 'success' : limited ? 'warning' : 'danger'} />;
  const summary = permissionSummary(caps.data, !!caps.error);
  const notificationBlocked = !!caps.data && (!caps.data.notifications || !caps.data.channelEnabled || !caps.data.notificationChannelEnabled);
  return <Page title={t('m_b7902c54f3ec')} compact onBack={back}>
    {!nativeAvailable && <QueryState loading={false} empty emptyMessage={t('m_a5562ad3cf7a')} />}
    {nativeAvailable && <>
      {summary.needsAttention && !caps.error && <ActionFeedback message={summary.message} tone={summary.tone} />}
      {caps.error && <ActionFeedback tone="warning" message={caps.data ? t('m_9f70c8e0c9ba', { arg0: String(shortDateTime(caps.data.observedAtMs)) }) : t('m_9461fb5601f6')} />}
      {caps.error && <Button label={t('m_4fbcda2801db')} variant="secondary" disabled={caps.isFetching || frozen} onPress={retryPermissions} />}
      {caps.isFetching && <ActionFeedback loading message={caps.data ? t('m_0a7648b7d121', { arg0: String(shortDateTime(caps.data.observedAtMs)) }) : t('m_9c3f5ca13afe')} />}
    </>}
    <ConnectedGroup title={t('m_abccc78cc93c')} footer={<>
      {(pending === 'permissions' || feedback.permissions) && <ActionFeedback loading={pending === 'permissions'}
        message={pending === 'permissions' ? t('m_e824800717b4') : feedback.permissions?.message} tone={feedback.permissions?.tone} />}
      {notificationDenied && <Button label={t('m_c6885c8ebcb2')} variant="secondary" disabled={frozen} onPress={() => openPermission('notifications', false)} />}
    </>}>
      <SettingRow intent="action" key="exact" icon="schedule" label={t('m_142c2ae8d0bb')} description={caps.data?.exactAlarms === false ? t('m_9ac9a33b0a76') : undefined}
        disabled={frozen || !nativeAvailable} statusLabel={permissionLabel(caps.data?.exactAlarms)} onPress={() => access('exact')}>{permission(caps.data?.exactAlarms)}</SettingRow>
      <View key="notifications"><SettingRow intent="action" icon="notifications" label={t('m_788011833a5a')} description={notificationBlocked ? t('m_07607efa8ec3') : undefined}
        disabled={frozen || !nativeAvailable} statusLabel={permissionLabel(caps.data ? caps.data.notifications && caps.data.channelEnabled && caps.data.notificationChannelEnabled : undefined)} onPress={() => access('notifications')}>
        {permission(caps.data ? caps.data.notifications && caps.data.channelEnabled && caps.data.notificationChannelEnabled : undefined)}
      </SettingRow>
        {!!caps.data && <RowSupport><Disclosure title={t('m_c33ea23d51f1')} forceOpen={notificationBlocked}>
          {([[t('m_31d7ae351725'), caps.data.notifications], [t('m_9cbbfcb9624f'), caps.data.channelEnabled], [t('m_261078774b32'), caps.data.notificationChannelEnabled]] as const).map(([label, allowed]) =>
            <View key={label} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12, rowGap: 4 }}>
              <Copy>{label}</Copy><Copy muted size={14}>{allowed ? t('m_1bb201d18835') : t('m_18f2a0947f9d')}</Copy>
            </View>)}
        </Disclosure></RowSupport>}
      </View>
      <SettingRow intent="action" key="lock-screen" icon="lock" label={t('m_66b41af0ba4b')} description={caps.data?.fullScreen === false ? t('m_69bbfaef0807') : undefined}
        disabled={frozen || !nativeAvailable} statusLabel={permissionLabel(caps.data?.fullScreen, true)} onPress={() => access('fullScreen')}>{permission(caps.data?.fullScreen, true)}</SettingRow>
    </ConnectedGroup>
    <ConnectedGroup title={t('m_94ff0d164e2e')} footer={<Copy muted size={14}>{t('m_cf04d66fee50')}</Copy>}>
      <View key="test"><SettingRow intent="action" icon="alarm" label={test && !uncertainTest ? t('m_95e37a41ce17') : t('m_a16e4f038ad7')} description={t('m_076475e48b36')}
        disabled={frozen || !nativeAvailable} onPress={scheduleTest} />
        {(pending === 'test' || feedback.test || uncertainTest) && <RowSupport>
          {(pending === 'test' || feedback.test) && <ActionFeedback loading={pending === 'test'} message={pending === 'test' ? t('m_617e1821a820') : feedback.test?.message} tone={feedback.test?.tone} />}
          {uncertainTest && <Button label={t('m_1a57cd6677a5')} variant="secondary" disabled={busy} onPress={scheduleTest} />}
        </RowSupport>}
      </View>
      {test?.occurrence && !uncertainTest && <SettingRow intent="navigation" key="view-test" label={t('m_e3193f30edce')} disabled={frozen} onPress={() => {
        if (running.current || frozen) return;
        router.push({ pathname: '/reminder/[id]', params: { id: test.occurrence!.id, ...routeParams } });
      }} />}
    </ConnectedGroup>
  </Page>;
}
