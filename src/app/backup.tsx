import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import type { ImportPreview } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Card, Copy, Heading, Page, Toggle } from '../ui/components';
import { engine } from '../ui/native';

export default function Backup() {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [json, setJson] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [copies, setCopies] = useState<string[]>([]);
  const [operationId, setOperationId] = useState('');
  const [previewLimit, setPreviewLimit] = useState(25);
  const [message, setMessage] = useState('');
  const exportFile = async () => {
    setBusy(true); setMessage('');
    try {
      const data = await engine().exportBackup();
      const directory = new Directory(Paths.cache, 'remilo-exports');
      directory.create({ idempotent: true, intermediates: true });
      const file = new File(directory, `remilo-${Date.now()}.json`);
      file.create(); file.write(data);
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save or share Remilo backup' });
      setMessage('Backup prepared. Save a copy using the Android share menu.');
    } catch (error) { setMessage(error instanceof Error && error.message.includes('BACKUP_TOO_LARGE')
      ? 'This backup exceeds the current 10 MB or 10,000-reminder limit. No incomplete backup was exported.'
      : 'Could not export the backup. Try again.'); }
    finally { setBusy(false); }
  };
  const choose = async () => {
    setBusy(true); setMessage(''); setPreview(null); setCopies([]);
    try {
      const selected = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['application/json', 'text/plain', 'application/octet-stream'] });
      if (selected.canceled) return;
      const file = new File(selected.assets[0].uri);
      if (file.size > 10_000_000) throw new Error('Backup exceeds 10 MB.');
      const data = await file.text();
      const next = await engine().previewImport(data);
      setJson(data); setPreview(next); setOperationId(engine().createOperationId()); setPreviewLimit(25);
    } catch { setMessage('This file could not be read as a valid Remilo backup. Nothing was imported.'); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await engine().importBackup(json, copies, operationId);
      await client.invalidateQueries();
      setMessage(result.retry ? 'The previously saved import was recovered.' : `Restored ${result.added ?? 0}; preserved ${result.preserved ?? 0} existing reminders.${result.blocked ? ' Some alerts need permission before delivery.' : ''}`);
      setPreview(null); setJson(''); setCopies([]);
    } catch { setMessage('Import did not finish. Retry from this preview; existing reminders are preserved.'); }
    finally { setBusy(false); }
  };
  return <Page title="Backup & restore" subtitle="Keep a portable copy of your reminders and history.">
    <Card><Heading>Export</Heading><Copy muted>Backups include reminder text and notes. Choose where to save or share your file.</Copy>
      <Copy muted>Accounts, device identity, running sessions and Android alarm handles are excluded.</Copy>
      <Button label="Export backup" disabled={busy} onPress={() => void exportFile()} /></Card>
    <Card><Heading>Restore</Heading><Copy muted>Preview before importing. Existing reminders stay as they are. Elapsed alerts remain silent.</Copy>
      <Button label="Choose backup file" disabled={busy} onPress={() => void choose()} /></Card>
    {preview && <Card><Heading>Restore preview · {preview.count} reminders or series</Heading>
      <Copy muted>New reminders will be added. Conflicts are skipped unless you select them below as new copies.</Copy>
      <Copy muted>A repeating series is restored as a whole, including saved exceptions and history. Conflicting series keep their existing local data unless you choose a separate copy.</Copy>
      {preview.items.slice(0, previewLimit).map((item) => item.conflict ? <Toggle key={item.id} label={`Restore a copy of “${item.title}”`}
        value={copies.includes(item.id)} onChange={(value) => setCopies((current) => value ? [...current, item.id] : current.filter((id) => id !== item.id))} />
        : <Copy key={item.id}>Add: {item.title}{item.futureAlert ? ' · future alert' : ' · no future alert'}</Copy>)}
      {previewLimit < preview.items.length && <Button label="Show 25 more preview entries" variant="secondary" onPress={() => setPreviewLimit(previewLimit + 25)} />}
      <Button label="Restore selected data" disabled={busy} onPress={() => void restore()} />
      <Button label="Cancel preview" variant="secondary" disabled={busy} onPress={() => { setPreview(null); setJson(''); }} />
    </Card>}
    {!!message && <Copy>{message}</Copy>}
  </Page>;
}
