import { View } from 'react-native';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Copy, Sheet } from './components';

/** Parents capture the displayed identities/revisions before opening this sheet. */
export function PurgeConfirmation({ items, onCancel, onConfirm }: {
  items: readonly Occurrence[]; onCancel: () => void; onConfirm: () => void;
}) {
  return <Sheet title={items.length <= 1 ? 'Delete permanently?' : 'Delete ' + items.length + ' reminders permanently?'}
    visible={items.length > 0} onClose={onCancel}>
    {items.length === 1 && <Copy heading>{items[0].title}</Copy>}
    <Copy>This removes the reminder content and activity. It cannot be undone or restored from Trash.</Copy>
    {items.some(item => !!item.segmentId) && <Copy muted>Only these occurrences are deleted. Repeating plans and other occurrences are kept.</Copy>}
    <View style={{ gap: 8 }}>
      <Button label="Delete permanently" icon="delete_forever" variant="danger" onPress={onConfirm} />
      <Button label="Cancel" variant="secondary" onPress={onCancel} />
    </View>
  </Sheet>;
}
