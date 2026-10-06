import { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from './native';

import { palettes, type Colors } from './colors';
const Theme = createContext<Colors>(palettes.light);
const ReviewFontScale = createContext(1);
const ReviewMotion = createContext<boolean | undefined>(undefined);
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
