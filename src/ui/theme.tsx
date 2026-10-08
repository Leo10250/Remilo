import { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from './native';

import { palettes, type Colors } from './colors';
import type { Foundation } from './foundations/foundation';
const Theme = createContext<Colors>(palettes.light);
const FontScaleOverride = createContext(1);
const ReducedMotionOverride = createContext<boolean | undefined>(undefined);
const FoundationStyle = createContext<Foundation | null>(null);
// Optional presentation overrides do not change the ordinary settings-backed theme.
const PresentationState = createContext<'default' | 'pressed' | 'focused'>('default');
export const useFoundationStyle = () => useContext(FoundationStyle);
export const usePresentationState = () => useContext(PresentationState);
export function FoundationStyleProvider({ foundation, children }: PropsWithChildren<{ foundation: Foundation }>) {
  return <FoundationStyle.Provider value={foundation}><PresentationProvider colors={foundation.colors}>{children}</PresentationProvider></FoundationStyle.Provider>;
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
export const useFontScaleOverride = () => useContext(FontScaleOverride);
export const useReducedMotionOverride = () => useContext(ReducedMotionOverride);
export function PresentationProvider({ colors, fontScale, reducedMotion, children }: PropsWithChildren<{ colors: Colors; fontScale?: number; reducedMotion?: boolean }>) {
  const inheritedScale = useFontScaleOverride(), inheritedMotion = useReducedMotionOverride();
  return <Theme.Provider value={colors}><FontScaleOverride.Provider value={fontScale ?? inheritedScale}><ReducedMotionOverride.Provider value={reducedMotion ?? inheritedMotion}>{children}</ReducedMotionOverride.Provider></FontScaleOverride.Provider></Theme.Provider>;
}
