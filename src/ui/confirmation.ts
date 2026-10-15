import { t, captureFeedback, presentFeedback, subscribeLanguage } from '../localization';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, type AlertButton, type AlertOptions } from 'react-native';
import { useAppearanceHold } from './theme';

/** Native confirmations retain the atmosphere until a choice or dismissal. */
export function useAppearanceConfirmation() {
  const [active, setActive] = useState(false);
  const retained = useRef<{ payload: unknown; generation: number } | undefined>(undefined);
  useAppearanceHold(active);
  const present = useCallback((entry: { payload: unknown; generation: number }) => {
    const { title, message, buttons, options } = presentFeedback<{ title: string; message?: string; buttons?: AlertButton[]; options?: AlertOptions }>(entry.payload);
    const generation = ++entry.generation;
    const choices = (buttons?.length ? buttons : [{ text: t('m_565339bc4d33') }]).map((button) => ({ ...button, onPress: () => {
      if (retained.current !== entry) return;
      retained.current = undefined;
      setActive(false); button.onPress?.();
    } }));
    try {
      Alert.alert(title, message, choices, { ...options, onDismiss: () => {
        // Re-presenting native Alert dismisses its former fragment. That is a
        // presentation replacement, not cancellation of the captured choice.
        if (retained.current !== entry || generation !== entry.generation) return;
        retained.current = undefined; setActive(false); options?.onDismiss?.();
      } });
    } catch (error) { retained.current = undefined; setActive(false); throw error; }
  }, []);
  useEffect(() => subscribeLanguage(() => {
    if (retained.current) try { present(retained.current); } catch { /* Native presentation failure must not interrupt the locale snapshot or execute a choice. */ }
  }), [present]);
  return useCallback((title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => {
    const entry = { payload: captureFeedback({ title, message, buttons, options }), generation: 0 };
    retained.current = entry; setActive(true); present(entry);
  }, [present]);
}
