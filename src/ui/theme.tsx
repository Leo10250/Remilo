import { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from './native';

import { palettes, type Colors } from './colors';
const Theme = createContext<Colors>(palettes.light);
export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const setting = useSettings().data?.theme ?? 'system';
  return <Theme.Provider value={(setting === 'system' ? system : setting) === 'dark' ? palettes.dark : palettes.light}>{children}</Theme.Provider>;
}
export const useTheme = () => useContext(Theme);
