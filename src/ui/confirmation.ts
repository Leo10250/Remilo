import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { Keyboard } from 'react-native';
import { confirmations, type ConfirmationButton, type ConfirmationOptions } from './confirmation-state';

/** One themed confirmation above the active page/sheet; route ownership fences late choices. */
export function useAppearanceConfirmation() {
  const owner = useRef(Symbol('confirmation')), mounted = useRef(false);
  useFocusEffect(useCallback(() => {
    const identity = owner.current;
    mounted.current = true;
    return () => { mounted.current = false; confirmations.release(identity); };
  }, []));
  return useCallback((title: string, message?: string, buttons?: ConfirmationButton[], options?: ConfirmationOptions) => {
    if (mounted.current && !confirmations.getSnapshot()) { Keyboard.dismiss(); confirmations.present(owner.current, title, message, buttons, options); }
  }, []);
}
