import { router } from 'expo-router';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import type { OriginParams } from '../domain/navigation';
import { useTranslation } from '../localization/react';
import { ConnectedGroup, SettingRow, Sheet } from './components';
import { useSheetExitAction } from './sheet-motion';

export function CreationMenu({
  visible,
  onClose,
  params,
  trigger,
}: {
  visible: boolean;
  onClose: () => void;
  params?: OriginParams;
  trigger: RefObject<View | null>;
}) {
  const t = useTranslation();
  const exit = useSheetExitAction(onClose);
  const choose = (path: '/edit' | '/routine-edit') =>
    exit.afterClose(() => router.push({ pathname: path, params }));
  return (
    <Sheet
      title={t('create_title')}
      visible={visible}
      onClose={onClose}
      returnFocusRef={trigger}
      returnFocusWhen={exit.canReturnFocus}
      onDismissed={exit.onDismissed}
    >
      <ConnectedGroup>
        <SettingRow
          intent="action"
          minHeight={64}
          label={t('create_reminder')}
          description={t('create_reminder_help')}
          icon="event"
          onPress={() => choose('/edit')}
        />
        <SettingRow
          intent="action"
          minHeight={64}
          label={t('routine_new')}
          description={t('create_routine_help')}
          icon="checklist"
          onPress={() => choose('/routine-edit')}
        />
      </ConnectedGroup>
    </Sheet>
  );
}
