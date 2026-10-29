import { router } from 'expo-router';
import { useEffect, useRef, type RefObject } from 'react';
import type { View } from 'react-native';
import type { OriginParams } from '../domain/navigation';
import { useTranslation } from '../localization/react';
import { ConnectedGroup, SettingRow, Sheet } from './components';

export function CreationMenu({ visible, onClose, params, trigger }: { visible: boolean; onClose: () => void; params?: OriginParams; trigger: RefObject<View | null> }) {
  const t = useTranslation(), choosing = useRef(false), destination = useRef<'/edit' | '/routine-edit' | null>(null);
  useEffect(() => { if (visible) choosing.current = false; }, [visible]);
  useEffect(() => {
    if (visible || !destination.current) return;
    const path = destination.current; destination.current = null; router.push({ pathname: path, params });
  }, [visible, params]);
  const choose = (path: '/edit' | '/routine-edit') => { if (choosing.current) return; choosing.current = true; destination.current = path; onClose(); };
  return <Sheet title={t('create_title')} visible={visible} onClose={onClose} returnFocusRef={trigger} returnFocusWhen={() => !choosing.current}>
    <ConnectedGroup>
      <SettingRow intent="action" minHeight={64} label={t('create_reminder')} description={t('create_reminder_help')} icon="event" onPress={() => choose('/edit')} />
      <SettingRow intent="action" minHeight={64} label={t('routine_new')} description={t('create_routine_help')} icon="checklist" onPress={() => choose('/routine-edit')} />
    </ConnectedGroup>
  </Sheet>;
}
