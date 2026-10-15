import { errorText } from '../localization';
import { useLocalizedState, useTranslation } from '../localization/react';

import { useQueryClient } from '@tanstack/react-query';
import { usePreventRemove } from 'expo-router/react-navigation';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { ImportPreview } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { RestoreOperation } from '../domain/restore';
import { retainedOriginParams, type OriginParams } from '../domain/navigation';
import { ActionFeedback, BottomActionBar, Button, Choice, Copy, Disclosure, Group, Page, SettingRow } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';
import { useAppearanceHold } from '../ui/theme';
import { useAppearanceConfirmation } from '../ui/confirmation';

export default function Backup() {
  'use no memo';
  const t = useTranslation();
  const params = useLocalSearchParams<OriginParams>();
  const client = useQueryClient();
  const confirm = useAppearanceConfirmation();
  const [phase, setPhase] = useState<'idle' | 'reading' | 'restoring'>('idle');
  const working = useRef(false);
  const [json, setJson] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [copies, setCopies] = useState<string[]>([]);
  const [previewLimit, setPreviewLimit] = useState(25);
  const [uncertain, setUncertain] = useState(false);
  const [feedback, setFeedback] = useLocalizedState<{ message: string; tone: 'success' | 'warning' | 'danger' }>();
  const [operation] = useState(() => new RestoreOperation({
    id: () => engine().createOperationId(),
    restore: (job) => engine().importBackup(job.json, job.copies, job.operationId),
  }));
  const busy = phase !== 'idle';
  useAppearanceHold(busy || uncertain);
  usePreventRemove(busy || uncertain, () => {
    confirm(phase === 'reading' ? t('m_2fb20e11e66c') : t('m_9e03078b573e'),
      phase === 'reading' ? t('m_6ec07536b633') : t('m_1eec03248b74'));
  });
  const choose = async () => {
    if (working.current || operation.pending) return;
    working.current = true; setPhase('reading'); setFeedback(undefined);
    try {
      const selected = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['application/json', 'text/plain', 'application/octet-stream'] });
      if (selected.canceled) return;
      const file = new File(selected.assets[0].uri);
      if (file.size > 10_000_000) throw new Error(t('m_a9e9b2a1cbd3'));
      const data = await file.text();
      const next = await engine().previewImport(data);
      setJson(data); setPreview(next); setCopies([]); setPreviewLimit(25);
    } catch { setFeedback({ message: preview ? t('m_8244869b563b') : t('m_3370f7ef5943'), tone: 'danger' }); }
    finally { working.current = false; setPhase('idle'); }
  };
  const restore = async () => {
    if (working.current || !preview) return;
    working.current = true; setPhase('restoring'); setFeedback(undefined);
    try {
      const result = await operation.run(json, copies);
      setUncertain(false);
      setFeedback({ message: result.retry ? t('m_3484304627a9') :
        t('m_a43a0dc77b1e', { arg0: String(result.added ?? 0), arg1: String(result.preserved ?? 0), arg2: String(result.blocked ? t('m_e6230f66090b') : '') }),
      tone: result.blocked ? 'warning' : 'success' });
      setPreview(null); setJson(''); setCopies([]);
      void client.invalidateQueries();
    } catch (error) {
      const pending = operation.pending;
      setUncertain(pending);
      setFeedback({ message: pending ? t('m_83103fdb49c3') :
        errorText(error, t('m_bcfd006179ec')), tone: pending ? 'warning' : 'danger' });
    } finally { working.current = false; setPhase('idle'); }
  };
  return <Page compact title={t('m_6da1c554212c')} onBack={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/settings', params: retainedOriginParams(params) })}
    footer={preview ? <BottomActionBar><View style={{ flex: 1, gap: 8 }}>
      {(phase === 'restoring' || uncertain || feedback) && <ActionFeedback loading={phase === 'restoring'} message={phase === 'restoring' ? t('m_e9156b17f25a') : feedback?.message} tone={phase === 'restoring' ? 'muted' : feedback?.tone} />}
      <Button label={phase === 'restoring' ? t('m_5a4918e0201c') : uncertain ? t('m_24be300a8083') : t('m_6da1c554212c')}
        disabled={!nativeAvailable || busy} onPress={() => void restore()} />
      <Button label={t('m_f657ed08c403')} variant="secondary" disabled={busy || uncertain}
        onPress={() => { setPreview(null); setJson(''); setCopies([]); setFeedback(undefined); }} />
    </View></BottomActionBar> : undefined}>
    <Copy muted>{t('m_1034ca31a970')}</Copy>
    {!nativeAvailable && <Copy muted>{t('m_fd7ada1a6f59')}</Copy>}
    <Group><SettingRow label={phase === 'reading' ? t('m_e72fbb36b74a') : preview ? t('m_3d56dc86536d') : t('m_5eba2dbd12f9')}
      icon="download" disabled={!nativeAvailable || busy || uncertain} onPress={() => void choose()} /></Group>
    {(!preview || phase === 'reading') && <ActionFeedback loading={phase === 'reading'} message={phase === 'reading' ? t('m_e72fbb36b74a') : feedback?.message}
      tone={phase === 'reading' ? 'muted' : feedback?.tone} />}
    {preview && <>
      <Copy size={20}>{preview.count} {t('m_5e9e09782c22')}</Copy>
      <Copy muted>{t('m_6377003ff6b8')}</Copy>
      <Copy muted size={14}>{t('m_55163370572c')}</Copy>
      {!!preview.lists?.length && <Group title={t('m_cd0502b3a59a', { arg0: String(preview.lists.length) })}>
        <Copy muted size={14}>{t('m_d028075f15ca')}</Copy>
        {preview.lists.map((list) => <SettingRow key={list.id} label={list.name}
          value={list.restoredName !== list.name ? t('m_488e1fe2c9c6', { arg0: String(list.restoredName) }) : list.conflict ? t('m_60ab6223678c') : t('m_e8bf5cca37b0')} />)}
      </Group>}
      <Group title={t('m_b13d60535b1f')}>
        <Copy muted size={14}>{t('m_63a3c9c9cac7')}</Copy>
        <Copy muted size={14}>{t('m_dbcf624f9669')}</Copy>
        {preview.items.slice(0, previewLimit).map((item) => <View key={item.id} style={{ paddingVertical: 12, gap: 8 }}>
          <Copy heading>{item.title}</Copy><Copy muted size={14}>{item.calendarCollision ? t('m_6bc9b1c63bb2') : item.conflict ? t('m_1a3503399c91') : t('m_9e8f821a26a5')}</Copy>
          {item.calendarCollision && <Copy muted>{t('m_380f30e3f29a')}</Copy>}
          <Copy muted size={14}>{item.futureAlert ? t('m_f2131f6ed0be') : t('m_ac8de684100b')}</Copy>
          {item.conflict && (busy || uncertain ? <Copy>{copies.includes(item.id) ? t('m_e9aae96f529b') : t('m_ff3222a89b5a')}</Copy> : <View accessibilityRole="radiogroup" accessibilityLabel={t('m_6c0ea235fd27', { arg0: String(item.title) })}>
            <Choice label={t('m_ff3222a89b5a')} selected={!copies.includes(item.id)} onPress={() => setCopies((current) => current.filter((id) => id !== item.id))} />
            <Choice label={t('m_e9aae96f529b')} selected={copies.includes(item.id)} onPress={() => setCopies((current) => current.includes(item.id) ? current : [...current, item.id])} />
          </View>)}
        </View>)}
      </Group>
      {previewLimit < preview.items.length && <Button label={t('m_433dbdeec045')} variant="secondary"
        onPress={() => setPreviewLimit((current) => current + 25)} />}
    </>}
    <Disclosure title={t('m_6b92feecd7ad')}>
      <Copy muted size={14}>{t('m_743811479f87')}</Copy>
      <Copy muted size={14}>{t('m_89abfb77e41f')}</Copy>
      <Copy muted size={14}>{t('m_4948269089d8')}</Copy>
    </Disclosure>
  </Page>;
}
