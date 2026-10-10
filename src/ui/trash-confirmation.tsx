import { View } from 'react-native';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Copy, Sheet } from './components';

/** The parent holds the displayed occurrence and revision until confirmation. */
export function TrashConfirmation({ item, onCancel, onConfirm }: {
  item: Occurrence | null; onCancel: () => void; onConfirm: () => void;
}) {
  return <Sheet title={item?.segmentId ? 'Move this occurrence to Trash?' : 'Move reminder to Trash?'}
    visible={!!item} onClose={onCancel}>
    {item && <Copy heading>{item.title}</Copy>}
    <Copy>Its alert will be cancelled. You can restore it from Trash.</Copy>
    {!!item?.segmentId && <Copy muted>Only this occurrence moves to Trash. The repeating plan and other occurrences are kept.</Copy>}
    <View style={{ gap: 8 }}>
      <Button label="Move to Trash" icon="delete" variant="danger" onPress={onConfirm} />
      <Button label="Keep reminder" variant="outlined" onPress={onCancel} />
    </View>
  </Sheet>;
}
