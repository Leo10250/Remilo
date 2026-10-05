import { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from './native';

const light = { background: '#F5F6F1', surface: '#FFFFFF', ink: '#192D27', muted: '#53685F',
  accent: '#245C47', accentInk: '#FFFFFF', soft: '#E4EEE6', border: '#C7D4CA', danger: '#A83632', warning: '#85510C' };
const dark = { background: '#111C18', surface: '#1C2A23', ink: '#ECF2EC', muted: '#B5C4B9',
  accent: '#A7D8B6', accentInk: '#112B1D', soft: '#2C4134', border: '#475D4D', danger: '#FFB4AB', warning: '#F2C77A' };
const Theme = createContext(light);
export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const setting = useSettings().data?.theme ?? 'system';
  const selected = setting === 'system' ? system : setting;
  return <Theme.Provider value={selected === 'dark' ? dark : light}>{children}</Theme.Provider>;
}
export const useTheme = () => useContext(Theme);
