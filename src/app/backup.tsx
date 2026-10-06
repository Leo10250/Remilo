import { useQueryClient } from '@tanstack/react-query';
import { usePreventRemove } from 'expo-router/react-navigation';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import type { ImportPreview } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { RestoreOperation } from '../domain/restore';
import { ActionFeedback, BottomActionBar, Button, Copy, Group, Page, SettingRow, Toggle } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';

export default function Backup() {
  const client = useQueryClient();
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
  usePreventRemove(busy || uncertain, () => {
    Alert.alert(phase === 'reading' ? 'Reading backup' : 'Restore not yet confirmed',
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
    } catch { setFeedback({ message: 'This file could not be read as a valid Remilo backup. Nothing was imported.', tone: 'danger' }); }
    finally { working.current = false; setPhase('idle'); }
  };
  const restore = async () => {
    if (working.current || !preview) return;
    working.current = true; setPhase('restoring'); setFeedback(undefined);
    try {
      const result = await operation.run(json, copies);
      setUncertain(false);
      setFeedback({ message: result.retry ? 'Your previous restore was confirmed.' :
        `Restored ${result.added ?? 0}; preserved ${result.preserved ?? 0} existing reminders.${result.blocked ? ' Some alerts need permission before delivery.' : ''}`,
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
  return <Page title="Restore backup"
    footer={preview ? <BottomActionBar><View style={{ flex: 1, gap: 8 }}>
      <Button label={phase === 'restoring' ? 'Restoring…' : uncertain ? 'Retry same restore' : 'Restore selected data'}
        disabled={!nativeAvailable || busy} onPress={() => void restore()} />
      <Button label="Cancel preview" variant="secondary" disabled={busy || uncertain}
        onPress={() => { setPreview(null); setJson(''); setCopies([]); setFeedback(undefined); }} />
    </View></BottomActionBar> : undefined}>
    <Copy muted>Preview a backup before restoring. Existing reminders are preserved; elapsed alarms stay silent.</Copy>
    <Copy muted size={14}>Backups exclude one-off reminders in Trash. Repeating deletion exclusions are retained.</Copy>
    {!nativeAvailable && <Copy muted>Use the Android app to restore a backup.</Copy>}
    <Group><SettingRow label={phase === 'reading' ? 'Reading backup…' : preview ? 'Choose another backup' : 'Choose backup file'}
      icon="download" disabled={!nativeAvailable || busy || uncertain} onPress={() => void choose()} /></Group>
    <ActionFeedback loading={busy} message={phase === 'reading' ? 'Reading backup…' : phase === 'restoring' ? 'Restoring backup…' : feedback?.message}
      tone={busy ? 'muted' : feedback?.tone} />
    {preview && <>
      <Copy size={20}>{preview.count} reminders or series</Copy>
      <Copy muted>New reminders will be added. Existing reminders and series are preserved unless you select a separate copy below.</Copy>
      <Copy muted size={14}>A repeating series includes its exceptions and activity.</Copy>
      {!!preview.lists?.length && <Group title={`Lists · ${preview.lists.length}`}>
        <Copy muted size={14}>Empty lists are included. Matching list identities keep local names; other name conflicts use the restored names below.</Copy>
        {preview.lists.map((list) => <SettingRow key={list.id} label={list.name}
          value={list.restoredName !== list.name ? `Restored as ${list.restoredName}` : list.conflict ? 'Keep local list' : 'Add list'} />)}
      </Group>}
      <Group>
        {preview.items.slice(0, previewLimit).map((item) => item.conflict ? busy || uncertain ?
          <SettingRow key={item.id} label={item.title} value={copies.includes(item.id) ? 'Restore a copy' : 'Keep existing'} /> :
          <Toggle key={item.id} label={`Restore a copy of “${item.title}”`}
            value={copies.includes(item.id)} onChange={(value) => setCopies((current) => value ? [...current, item.id] : current.filter((id) => id !== item.id))} /> :
          <SettingRow key={item.id} label={item.title} value={item.futureAlert ? 'Future alert' : 'No future alert'} />)}
      </Group>
      {previewLimit < preview.items.length && <Button label="Show 25 more preview entries" variant="secondary"
        onPress={() => setPreviewLimit((current) => current + 25)} />}
    </>}
  </Page>;
}
