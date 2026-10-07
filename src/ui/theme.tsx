import { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from './native';

import { palettes, type Colors } from './colors';
import type { Foundation } from './foundations/foundation';
const Theme = createContext<Colors>(palettes.light);
const ReviewFontScale = createContext(1);
const ReviewMotion = createContext<boolean | undefined>(undefined);
const FoundationStyle = createContext<Foundation | null>(null);
// Opt-in presentation only. The production provider stays on its approved baseline
// until the complete P02 catalog gate; existing P01 review inputs stay compatible.
const PresentationState = createContext<'default' | 'pressed' | 'focused'>('default');
export const useFoundationStyle = () => useContext(FoundationStyle);
export const usePresentationState = () => useContext(PresentationState);
export function FoundationStyleProvider({ foundation, children }: PropsWithChildren<{ foundation: Foundation }>) {
  return <FoundationStyle.Provider value={foundation}><ReviewThemeProvider colors={foundation.colors}>{children}</ReviewThemeProvider></FoundationStyle.Provider>;
}
export function PresentationStateProvider({ state, children }: PropsWithChildren<{ state: 'default' | 'pressed' | 'focused' }>) {
  return <PresentationState.Provider value={state}>{children}</PresentationState.Provider>;
}
export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const setting = useSettings().data?.theme ?? 'system';
  return <Theme.Provider value={(setting === 'system' ? system : setting) === 'dark' ? palettes.dark : palettes.light}>{children}</Theme.Provider>;
}
export const useTheme = () => useContext(Theme);
export const useReviewFontScale = () => useContext(ReviewFontScale);
export const useReviewMotion = () => useContext(ReviewMotion);
export function ReviewThemeProvider({ colors, fontScale, reducedMotion, children }: PropsWithChildren<{ colors: Colors; fontScale?: number; reducedMotion?: boolean }>) {
  const inheritedScale = useReviewFontScale(), inheritedMotion = useReviewMotion();
  return <Theme.Provider value={colors}><ReviewFontScale.Provider value={fontScale ?? inheritedScale}><ReviewMotion.Provider value={reducedMotion ?? inheritedMotion}>{children}</ReviewMotion.Provider></ReviewFontScale.Provider></Theme.Provider>;
}
