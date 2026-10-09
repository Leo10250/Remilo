import { useCallback, useState } from 'react';
import { Alert, type AlertButton, type AlertOptions } from 'react-native';
import { useAppearanceHold } from './theme';

/** Native confirmations retain the atmosphere until a choice or dismissal. */
export function useAppearanceConfirmation() {
  const [active, setActive] = useState(false);
  useAppearanceHold(active);
  return useCallback((title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => {
    setActive(true);
    const choices = (buttons?.length ? buttons : [{ text: 'OK' }]).map((button) => ({ ...button, onPress: () => {
      setActive(false); button.onPress?.();
    } }));
    try {
      Alert.alert(title, message, choices, { ...options, onDismiss: () => { setActive(false); options?.onDismiss?.(); } });
    } catch (error) { setActive(false); throw error; }
  }, []);
}
