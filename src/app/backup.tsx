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
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'warning' | 'danger' }>();
  const [operation] = useState(() => new RestoreOperation({
    id: () => engine().createOperationId(),
    restore: (job) => engine().importBackup(job.json, job.copies, job.operationId),
  }));
  const busy = phase !== 'idle';
  useAppearanceHold(busy || uncertain);
  usePreventRemove(busy || uncertain, () => {
    confirm(phase === 'reading' ? 'Reading backup' : 'Restore not yet confirmed',
      phase === 'reading' ? 'Wait for the backup preview before leaving.' : 'Wait for this restore, or retry the same restore before leaving.');
  });
  const choose = async () => {
    if (working.current || operation.pending) return;
    working.current = true; setPhase('reading'); setFeedback(undefined);
    try {
      const selected = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['application/json', 'text/plain', 'application/octet-stream'] });
      if (selected.canceled) return;
      const file = new File(selected.assets[0].uri);
      if (file.size > 10_000_000) throw new Error('Backup exceeds 10 MB.');
      const data = await file.text();
      const next = await engine().previewImport(data);
      setJson(data); setPreview(next); setCopies([]); setPreviewLimit(25);
    } catch { setFeedback({ message: preview ? 'The new file could not be read as a valid Remilo backup. Nothing was imported; the previous preview and copy choices are kept.' : 'This file could not be read as a valid Remilo backup. Nothing was imported.', tone: 'danger' }); }
    finally { working.current = false; setPhase('idle'); }
  };
  const restore = async () => {
    if (working.current || !preview) return;
    working.current = true; setPhase('restoring'); setFeedback(undefined);
    try {
      const result = await operation.run(json, copies);
      setUncertain(false);
      setFeedback({ message: result.retry ? 'Your previous restore was confirmed.' :
        `Restored ${result.added ?? 0}; preserved ${result.preserved ?? 0} existing reminder or series entries.${result.blocked ? ' Some alerts could not be scheduled. Review Alert problems in Agenda.' : ''}`,
      tone: result.blocked ? 'warning' : 'success' });
      setPreview(null); setJson(''); setCopies([]);
      void client.invalidateQueries();
    } catch (error) {
      const pending = operation.pending;
      setUncertain(pending);
      setFeedback({ message: pending ? 'Restore not confirmed. Retry the same restore; your backup and copy selection are kept.' :
        error instanceof Error ? error.message : 'This backup could not be restored. Review the preview and try again.', tone: pending ? 'warning' : 'danger' });
    } finally { working.current = false; setPhase('idle'); }
  };
  return <Page compact title="Restore backup" onBack={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/settings', params: retainedOriginParams(params) })}
    footer={preview ? <BottomActionBar><View style={{ flex: 1, gap: 8 }}>
      {(phase === 'restoring' || uncertain || feedback) && <ActionFeedback loading={phase === 'restoring'} message={phase === 'restoring' ? 'Restoring backup…' : feedback?.message} tone={phase === 'restoring' ? 'muted' : feedback?.tone} />}
      <Button label={phase === 'restoring' ? 'Restoring…' : uncertain ? 'Retry same restore' : 'Restore backup'}
        disabled={!nativeAvailable || busy} onPress={() => void restore()} />
      <Button label="Cancel preview" variant="secondary" disabled={busy || uncertain}
        onPress={() => { setPreview(null); setJson(''); setCopies([]); setFeedback(undefined); }} />
    </View></BottomActionBar> : undefined}>
    <Copy muted>Restore reminders and lists from a backup. Existing reminders stay unchanged.</Copy>
    {!nativeAvailable && <Copy muted>Use the Android app to restore a backup.</Copy>}
    <Group><SettingRow label={phase === 'reading' ? 'Reading backup…' : preview ? 'Choose another backup' : 'Choose backup file'}
      icon="download" disabled={!nativeAvailable || busy || uncertain} onPress={() => void choose()} /></Group>
    {(!preview || phase === 'reading') && <ActionFeedback loading={phase === 'reading'} message={phase === 'reading' ? 'Reading backup…' : feedback?.message}
      tone={phase === 'reading' ? 'muted' : feedback?.tone} />}
    {preview && <>
      <Copy size={20}>{preview.count} reminders or series</Copy>
      <Copy muted>New reminders and lists are included. You can add separate copies of reminders already on this device.</Copy>
      <Copy muted size={14}>Elapsed alarms stay silent.</Copy>
      {!!preview.lists?.length && <Group title={`Lists · ${preview.lists.length}`}>
        <Copy muted size={14}>Empty lists are included. Matching list identities keep local names; other name conflicts use the restored names below.</Copy>
        {preview.lists.map((list) => <SettingRow key={list.id} label={list.name}
          value={list.restoredName !== list.name ? `Name on restore: ${list.restoredName}` : list.conflict ? 'Keep local list' : 'Add list'} />)}
      </Group>}
      <Group title="Reminders from the selected backup">
        <Copy muted size={14}>Whole backup · new entries are included automatically. Choices below only add copies of existing identities.</Copy>
        <Copy muted size={14}>Preview timing does not confirm delivery. Alerts are checked after restore.</Copy>
        {preview.items.slice(0, previewLimit).map((item) => <View key={item.id} style={{ paddingVertical: 12, gap: 8 }}>
          <Copy heading>{item.title}</Copy><Copy muted size={14}>{item.conflict ? 'Already on this device' : 'New entry · Included automatically'}</Copy>
          <Copy muted size={14}>{item.futureAlert ? 'Future time indicated' : 'No future time indicated'}</Copy>
          {item.conflict && (busy || uncertain ? <Copy>{copies.includes(item.id) ? 'Add a separate copy' : 'Keep existing'}</Copy> : <View accessibilityRole="radiogroup" accessibilityLabel={`Restore choices for ${item.title}`}>
            <Choice label="Keep existing" selected={!copies.includes(item.id)} onPress={() => setCopies((current) => current.filter((id) => id !== item.id))} />
            <Choice label="Add a separate copy" selected={copies.includes(item.id)} onPress={() => setCopies((current) => current.includes(item.id) ? current : [...current, item.id])} />
          </View>)}
        </View>)}
      </Group>
      {previewLimit < preview.items.length && <Button label="Show 25 more preview entries" variant="secondary"
        onPress={() => setPreviewLimit((current) => current + 25)} />}
    </>}
    <Disclosure title="What's included?">
      <Copy muted size={14}>A repeating reminder includes its changed occurrences and activity. Empty lists are included.</Copy>
      <Copy muted size={14}>One-off reminders in Trash are excluded. Repeating deletion exclusions are retained.</Copy>
      <Copy muted size={14}>Restore adds the whole backup. Existing reminders are kept unless you choose a separate copy.</Copy>
    </Disclosure>
  </Page>;
}
