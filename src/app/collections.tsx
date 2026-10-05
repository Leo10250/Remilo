import { router } from 'expo-router';
import { Group, Page, SettingRow } from '../ui/components';

export default function Collections() {
  return <Page title="Collections" subtitle="Choose the reminders you want to see.">
    <Group>
      <SettingRow label="Agenda" icon="event" description="Upcoming and unfinished reminders" onPress={() => router.dismissTo('/')} />
      <SettingRow label="Repeats" icon="repeat" description="Active, paused and ended schedules" onPress={() => router.push('/series')} />
      <SettingRow label="Completed" icon="check_circle" description="Completed reminders and skipped occurrences" onPress={() => router.push({ pathname: '/records', params: { view: 'completed' } })} />
      <SettingRow label="Trash" icon="delete" description="Deleted reminders you can restore" onPress={() => router.push({ pathname: '/records', params: { view: 'deleted' } })} />
    </Group>
    <Group>
      <SettingRow label="Settings" icon="settings" description="Alarms, permissions, appearance and data" onPress={() => router.push('/settings')} />
    </Group>
  </Page>;
}
