import { View } from 'react-native';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Copy, Sheet } from './components';
import { useCalendarAssociation } from './calendar-association';

/** The parent holds the displayed occurrence and revision until confirmation. */
export function TrashConfirmation({ item, onCancel, onConfirm }: {
  item: Occurrence | null; onCancel: () => void; onConfirm: () => void;
}) {
  const associated = useCalendarAssociation(item ? [item.id] : [], !!item);
  return <Sheet title={item?.segmentId ? 'Move this occurrence to Trash?' : 'Move reminder to Trash?'}
    visible={!!item} onClose={onCancel}>
    {item && <Copy heading>{item.title}</Copy>}
    <Copy>Its alert will be cancelled. You can restore it from Trash.</Copy>
    {associated && <Copy muted>Google Calendar will not be changed.</Copy>}
    {!!item?.segmentId && <Copy muted>Only this occurrence moves to Trash. The repeating plan and other occurrences are kept.</Copy>}
    <View style={{ gap: 8 }}>
      <Button label="Move to Trash" icon="delete" variant="danger" onPress={onConfirm} />
      <Button label="Keep reminder" variant="outlined" onPress={onCancel} />
    </View>
  </Sheet>;
}
