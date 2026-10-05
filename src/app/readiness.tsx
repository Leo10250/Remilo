import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PermissionsAndroid } from 'react-native';
import { Button, Card, Copy, Heading, Page } from '../ui/components';
import { engine, useCapabilities } from '../ui/native';

export default function Readiness() {
  const query = useCapabilities();
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<unknown>) => {
    setBusy(true); setMessage('');
    try { await task(); await engine().reconcile(); await client.invalidateQueries(); }
    catch { setMessage('Could not complete that action. Try again or review Android’s settings for Remilo.'); }
    finally { setBusy(false); }
  };
  const caps = query.data;
  return <Page title="Alarm readiness" subtitle="Android’s settings decide how an alarm can be presented.">
    <Card><Heading>Exact alarms</Heading><Copy>{caps?.exactAlarms ? 'Allowed' : 'Permission needed'}</Copy>
      <Copy muted>Alarm mode needs exact-alarm access. It is never silently changed into a notification.</Copy>
      <Button label="Review exact-alarm access" disabled={busy} onPress={() => void run(() => engine().openSettings('exact'))} />
    </Card>
    <Card><Heading>Notifications</Heading><Copy>{caps?.notifications && caps.channelEnabled ? 'Enabled' : 'Blocked or unchecked'}</Copy>
      <Copy muted>The ringing channel supplies controls. Native playback supplies the repeating sound.</Copy>
      <Button label="Review notification permission" disabled={busy} onPress={() => void run(async () => {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) await engine().openSettings('notifications');
      })} />
      <Button label="Review notification channels" variant="secondary" disabled={busy} onPress={() => void run(() => engine().openSettings('notifications'))} />
    </Card>
    <Card><Heading>Lock-screen presentation</Heading><Copy>{caps?.fullScreen ? 'Allowed' : 'Full-screen access not allowed'}</Copy>
      <Copy muted>Without full-screen access, use the alarm notification’s controls. Android controls compact and expanded layouts.</Copy>
      <Button label="Review lock-screen access" disabled={busy} onPress={() => void run(() => engine().openSettings('fullScreen'))} />
    </Card>
    <Card><Heading>Try an alarm</Heading><Copy muted>Check alarm volume and the selected speaker or Bluetooth device. A test rings for up to five minutes.</Copy>
      <Button label="Test alarm in 15 seconds" disabled={busy} onPress={() => void run(async () => {
        const result = await engine().scheduleTestAlarm();
        setMessage(result.status === 'Scheduled' ? 'Test saved for 15 seconds from now.' : 'Test saved, but delivery is blocked. Review the settings above.');
      })} />
    </Card>
    <Copy muted>Power off, Force stop, denied permissions and a locked Private Space can prevent delivery. Opening Remilo later does not replay elapsed alarms.</Copy>
    <Button label="Refresh readiness" variant="secondary" disabled={busy} onPress={() => void run(() => engine().reconcile())} />
    {!!message && <Copy>{message}</Copy>}
  </Page>;
}
