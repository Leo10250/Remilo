import { errorText, t } from '../localization';
import { useLocalizedState, useTranslation } from '../localization/react';
import { useTimeFormatting, useTimeDisplay } from '../ui/time-display';
import { router, useLocalSearchParams } from 'expo-router';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { WidgetSetupRow } from '../ui/widget-setup';
import type { AppSettings } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from '../domain/actions';
import { normalizeAtmosphere } from '../domain/appearance';
import { creationOrigin, retainedOriginParams, rootKey, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { atmosphereNames, permissionSummary, preferenceRecoveryOwner, type preferenceGroups } from '../domain/settings-presentation';
import type { HandoffTicket } from '../domain/handoff';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, Field, Page, QueryState, RowSupport, SettingRow, Sheet, Toggle } from '../ui/components';
import { engine, nativeAvailable, preferences, useCapabilities, useSettings } from '../ui/native';
import { PreferenceFeedback } from '../ui/preference-feedback';
import { SoundPicker } from '../ui/sound-picker';
import { ClockPreferenceRow } from '../ui/settings-controls';
import { usePageHandoff } from '../ui/handoff';
import { space } from '../ui/tokens';

type Feedback = { message: string; tone: Tone };
function appearanceSummary(settings: AppSettings) {
  return `${atmosphereNames[normalizeAtmosphere(settings.atmosphere)]} · ${settings.theme === 'system' ? t('m_5e4aca65d4a4') : settings.theme === 'light' ? t('m_dbcd5e7bb7a0') : t('m_60acc53f13a5')}`;
}
export default function Settings() {
  'use no memo';
  const t = useTranslation();
  const { shortDateTime, clockPreferenceLabel } = useTimeFormatting();
  const presentation = useTimeDisplay();
  const params = useLocalSearchParams<OriginParams>(), origin = creationOrigin(params), routeParams = retainedOriginParams(params);
  const query = useSettings(), caps = useCapabilities(), settings = query.data;
  const [languagePicker, setLanguagePicker] = useState(false), [snoozePicker, setSnoozePicker] = useState(false), [shortcuts, setShortcuts] = useState(false), [backupInfo, setBackupInfo] = useState(false);
  const [minutes, setMinutes] = useState('10'), [feedback, setFeedback] = useLocalizedState<Feedback>(), [pending, setPending] = useState(false);
  const running = useRef(false), mounted = useRef(true), [preparedExport, setPreparedExport] = useState<File>();
  const handoff = usePageHandoff(() => setPending(running.current));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const runExport = async (task: (ticket: HandoffTicket) => Promise<Feedback | undefined>) => {
    if (running.current) return;
    const ticket = handoff.scope.capture();
    if (!handoff.scope.canLaunch(ticket)) return;
    running.current = true; setPending(true); setFeedback(undefined);
    try { const result = await task(ticket); if (result) handoff.commit(ticket, () => setFeedback(result)); }
    catch (error) { handoff.commit(ticket, () => setFeedback({ message: errorText(error, t('m_ce0a2a599e4d')), tone: 'danger' })); }
    finally { running.current = false; if (mounted.current && handoff.scope.active()) setPending(false); }
  };
  const save = (patch: Partial<AppSettings>) => { if (!pending) preferences.change(patch); };
  const sharePrepared = async (file: File, ticket: HandoffTicket): Promise<Feedback | undefined> => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!handoff.scope.canLaunch(ticket)) return;
      if (!available) return { message: t('m_0798a52ef16b'), tone: 'warning' };
      if (!handoff.scope.markOpened(ticket)) return;
      await Sharing.shareAsync(file.uri, { mimeType: 'application/zip', dialogTitle: t('m_746212ed7cd6') });
      return { message: t('m_c764a0c6727b'), tone: 'muted' };
    } catch { return { message: t('m_81d4cad2c628'), tone: 'danger' }; }
  };
  const exportFile = () => void runExport(async ticket => {
    const prepared = await engine().prepareBackupExport();
    if (!handoff.scope.canLaunch(ticket)) return;
    const file = new File(prepared.uri);
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
    ? t('m_c56e51fc430f', { arg0: String(shortDateTime(caps.data.observedAtMs)), arg1: String(caps.error ? t('m_d6d1cdc660d1') : t('m_eb50add3d378')) }) : undefined;
  return <Page title={t('m_74a883a037bc')} scrollKey={`settings:${rootKey(origin)}`} scrollReady={!!settings || !query.isLoading}
    onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(routeParams))}>
    <View style={{ gap: space.md }}>
      <QueryState loading={!settings && query.isLoading && nativeAvailable} error={!settings ? query.error : undefined} empty={!settings && !query.isLoading}
        emptyMessage={nativeAvailable ? t('m_de367fa1d4a6') : t('m_eb0582ac36eb')} onRetry={nativeAvailable ? () => void query.refetch() : undefined} />
      {nativeAvailable && permission.needsAttention && <ConnectedGroup>
        <View><RowSupport><ActionFeedback message={permission.message} tone={permission.tone} />
          {permissionRefresh && <Copy muted size={14}>{permissionRefresh}</Copy>}
          <Button label={t('m_0146bbb12bf3')} variant="secondary" disabled={pending} onPress={openAlarmCheck} />
        </RowSupport></View>
      </ConnectedGroup>}
      {!!settings && <>
        <ConnectedGroup title={t('m_5fb7b58aa419')} footer={<><Copy muted size={14}>{t('m_0cd7c6a99c15')}</Copy>{preferenceFeedback('defaults')}</>}>
          <SoundPicker key="sound" value={settings.sound} onChange={sound => save({ sound })} disabled={pending} />
          <Toggle key="vibration" icon="vibration" label={t('m_59e1fd02f6c2')} value={settings.vibration} disabled={pending} onChange={vibration => save({ vibration })} />
        </ConnectedGroup>
        <ConnectedGroup title={t('m_f21ec393fe6b')} footer={preferenceFeedback('postponement')}>
          <SettingRow intent="picker" key="snooze" icon="snooze" label={t('m_3f030a6921b9')} value={t('m_1c3c36c66261', { count: settings.snoozeMinutes })} disabled={pending}
            onPress={() => { setMinutes(String(settings.snoozeMinutes)); setSnoozePicker(true); }} />
          <SettingRow intent="navigation" key="shortcuts" icon="schedule" label={t('m_9b0f67429df4')}
            value={[settings.tomorrowMorning, settings.tomorrowAfternoon, settings.tomorrowEvening].map(value => clockPreferenceLabel(value)).join(' · ')}
            disabled={pending} onPress={() => setShortcuts(true)} />
        </ConnectedGroup>
        <ConnectedGroup footer={preferenceFeedback('appearance')}><SettingRow intent="navigation" key="appearance" icon="palette" label={t('m_3907fa7f8072')} value={appearanceSummary(settings)} disabled={pending}
          onPress={() => router.push({ pathname: '/appearance', params: routeParams })} /></ConnectedGroup>
        <ConnectedGroup footer={preferenceFeedback('language')}><SettingRow intent="picker" key="language" icon="language" label={t('m_a4fe65264ef7')} value={settings.language === 'system' ? t('m_b0459211f9f7') : settings.language === 'en' ? 'English' : '简体中文'} disabled={pending} onPress={() => setLanguagePicker(true)} /></ConnectedGroup>
      </>}
      <ConnectedGroup><WidgetSetupRow disabled={pending} /></ConnectedGroup>
      <ConnectedGroup><SettingRow intent="navigation" key="permissions" icon="alarm" label={t('m_b7902c54f3ec')} value={nativeAvailable ? permission.message : t('m_9abfcd6cc71c')}
        description={permissionRefresh} disabled={pending} onPress={openAlarmCheck} /></ConnectedGroup>
      <ConnectedGroup><SettingRow intent="navigation" key="google-calendar" icon="event" label={t('m_b074310e911f')} description={t('m_e75d471ec00e')} disabled={pending}
        onPress={() => router.push({ pathname: '/calendar', params: routeParams })} /></ConnectedGroup>
      <ConnectedGroup title={t('m_3334fee2c77f')} footer={<><Copy muted size={14}>{t('m_a7b215af0d49')}</Copy>
        <Button label={t('m_95365d0f81ab')} variant="secondary" disabled={pending} onPress={() => setBackupInfo(true)} /></>}>
        <View key="export"><SettingRow intent="action" icon="upload" label={t('m_d6dfd0f08280')} disabled={pending || !nativeAvailable} onPress={exportFile} />
          {(pending || feedback || preparedExport) && <RowSupport>
            {(pending || feedback) && <ActionFeedback loading={pending} message={pending ? t('m_580447a9d871') : feedback?.message} tone={feedback?.tone} />}
            {preparedExport && <Button label={t('m_6b88c0d8044d')} variant="secondary" disabled={pending} onPress={() => void runExport(ticket => sharePrepared(preparedExport, ticket))} />}
          </RowSupport>}
        </View>
        <SettingRow intent="navigation" key="restore" icon="download" label={t('m_6da1c554212c')} disabled={pending} onPress={() => router.push({ pathname: '/backup', params: routeParams })} />
      </ConnectedGroup>
      <ConnectedGroup title={t('m_b79cac926e0b')} footer={<><Copy>{t('m_f65890724d03')}</Copy><Copy muted size={14}>{t('m_cf96192a609d')}</Copy></>}>
        <SettingRow intent="navigation" key="diagnostics" icon="info" label={t('m_268f14bbfe11')} disabled={pending} onPress={() => router.push({ pathname: '/diagnostics', params: routeParams })} />
      </ConnectedGroup>
      <Sheet title={t('m_a4fe65264ef7')} visible={languagePicker} onClose={() => setLanguagePicker(false)}>
        <Choice label={t('m_b0459211f9f7')} description={settings?.language === 'system' ? t('m_515c527078e9', { arg0: presentation.resolvedLanguage === 'zh-Hans' ? '简体中文' : 'English' }) : undefined} selected={settings?.language === 'system'} disabled={pending} onPress={() => { save({ language: 'system' }); setLanguagePicker(false); }} />
        <Choice label="English" selected={settings?.language === 'en'} disabled={pending} onPress={() => { save({ language: 'en' }); setLanguagePicker(false); }} />
        <Choice label="简体中文" selected={settings?.language === 'zh-Hans'} disabled={pending} onPress={() => { save({ language: 'zh-Hans' }); setLanguagePicker(false); }} />
      </Sheet>
      <Sheet title={t('m_3f030a6921b9')} visible={snoozePicker} onClose={() => setSnoozePicker(false)} footer={<BottomActionBar><View style={{ flex: 1 }}>
        <Button label={t('m_27c124be1e8d')} disabled={!snoozeValid || pending} onPress={() => { save({ snoozeMinutes: Number(minutes) }); setSnoozePicker(false); }} />
      </View></BottomActionBar>}>
        <Copy muted size={14}>{t('m_608a77cbf8bc')}</Copy>
        {[5, 10, 15, 30].map(duration => <Choice key={duration} label={t('m_1c3c36c66261', { count: duration })} selected={settings?.snoozeMinutes === duration}
          disabled={pending} onPress={() => { save({ snoozeMinutes: duration }); setSnoozePicker(false); }} />)}
        <Field label={t('m_518075e750af')} value={minutes} keyboardType="number-pad" onChangeText={setMinutes} error={!snoozeValid ? t('m_da461edf6be4') : undefined} />
      </Sheet>
      <Sheet title={t('m_9b0f67429df4')} visible={shortcuts} onClose={() => setShortcuts(false)}>
        <Copy muted size={14}>{t('m_c03efc02ebc8')}</Copy>
        {!!settings && <ConnectedGroup>{(['tomorrowMorning', 'tomorrowAfternoon', 'tomorrowEvening'] as const).map(key =>
          <ClockPreferenceRow key={key} minutes={settings[key]} disabled={pending} onChange={value => save({ [key]: value })} />)}</ConnectedGroup>}
        <PreferenceFeedback fields={['tomorrowMorning', 'tomorrowAfternoon', 'tomorrowEvening']} />
      </Sheet>
      <Sheet title={t('m_417b6c80d6e4')} visible={backupInfo} onClose={() => setBackupInfo(false)}>
        <Copy>{t('m_03588484b7c5')}</Copy>
        <Copy>{t('m_a9a1a38b9395')}</Copy>
        <Copy>{t('m_6d3b4ca3720b')}</Copy>
      </Sheet>
    </View>
  </Page>;
}
