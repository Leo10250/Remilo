import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useState } from 'react';
import type { ImportPreview } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Copy, Group, Page, SettingRow, Status, Toggle } from '../ui/components';
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
  return <Page title="Restore backup">
    <Copy muted size={14}>Preview a backup before restoring. Existing reminders are preserved; elapsed alarms stay silent.</Copy>
    <Group><SettingRow label={busy ? 'Reading backup…' : 'Choose backup file'} icon="download" disabled={busy} onPress={() => void choose()} /></Group>
    {preview && <><Copy size={19}>{preview.count} reminders or series</Copy>
      <Copy muted>New reminders will be added. Conflicts are skipped unless you select them below as new copies.</Copy>
      <Copy muted size={13}>A repeating series includes its exceptions and activity.</Copy><Group>
      {preview.items.slice(0, previewLimit).map((item) => item.conflict ? <Toggle key={item.id} label={`Restore a copy of “${item.title}”`}
        value={copies.includes(item.id)} onChange={(value) => setCopies((current) => value ? [...current, item.id] : current.filter((id) => id !== item.id))} />
        : <SettingRow key={item.id} label={item.title} value={item.futureAlert ? 'Future alarm' : 'No future alarm'} />)}</Group>
      {previewLimit < preview.items.length && <Button label="Show 25 more preview entries" variant="secondary" onPress={() => setPreviewLimit(previewLimit + 25)} />}
      <Button label="Restore selected data" disabled={busy} onPress={() => void restore()} />
      <Button label="Cancel preview" variant="secondary" disabled={busy} onPress={() => { setPreview(null); setJson(''); }} />
    </>}
    {!!message && <Status label={message} />}
  </Page>;
}
