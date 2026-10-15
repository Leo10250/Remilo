import { useMemo, useState, useCallback, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import { captureFeedback, presentFeedback, createTranslator, currentLanguage, subscribeLanguage } from '.';

export function useLocale() { return useSyncExternalStore(subscribeLanguage, currentLanguage, () => 'en' as const); }
export function useTranslation() {
  const language = useLocale();
  return useMemo(() => createTranslator(language), [language]);
}
/** Retain message descriptors while preserving existing feedback call sites. */
export function useLocalizedState<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
export function useLocalizedState<T = undefined>(): [T | undefined, Dispatch<SetStateAction<T | undefined>>];
export function useLocalizedState<T>(initial?: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  useLocale();
  const [stored, setStored] = useState<unknown>(() => captureFeedback(typeof initial === 'function' ? (initial as () => T)() : initial));
  const set = useCallback<Dispatch<SetStateAction<T>>>(next => setStored((previous: unknown) => captureFeedback(
    typeof next === 'function' ? (next as (value: T) => T)(presentFeedback<T>(previous)) : next)), []);
  return [presentFeedback<T>(stored), set];
}
