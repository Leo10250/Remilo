import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, useColorScheme } from 'react-native';
import Alarm from '../../modules/remilo-alarm/src/RemiloAlarmModule';
import { useSettings } from './native';

import { atmosphereColors, palettes, type Colors } from './colors';
import type { Foundation } from './foundations/foundation';
import { AppearanceTransitions, nextAppearanceBoundary, normalizeAtmosphere, resolveAtmosphere, type Atmosphere, type Brightness } from '../domain/appearance';
import { shape, space, typography } from './tokens';
import { presentation } from './atmosphere.generated';
const Theme = createContext<Colors>(palettes.light);
const FontScaleOverride = createContext(1);
const ReducedMotionOverride = createContext<boolean | undefined>(undefined);
const FoundationStyle = createContext<Foundation | null>(null);
const Appearance = createContext<{ scene: Atmosphere; brightness: Brightness }>({ scene: 'sky', brightness: 'light' });
const AppearanceHolds = createContext({ hold: () => Symbol(), release: (_token: symbol) => {} });
export const useAtmosphere = () => useContext(Appearance);
export function useAppearanceHold(active: boolean) {
  const owner = useContext(AppearanceHolds);
  useEffect(() => { if (!active) return; const token = owner.hold(); return () => owner.release(token); }, [active, owner]);
}
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
  const settings = useSettings().data;
  const selection = normalizeAtmosphere(settings?.atmosphere), setting = settings?.theme ?? 'system';
  const brightness: Brightness = (setting === 'system' ? system : setting) === 'dark' ? 'dark' : 'light';
  const [transitions] = useState(() => new AppearanceTransitions(resolveAtmosphere(selection, new Date())));
  const [scene, setScene] = useState<Atmosphere>(() => resolveAtmosphere(selection, new Date()));
  const previousSelection = useRef(selection);
  const holds = useMemo(() => ({ hold: () => transitions.hold(), release: (token: symbol) => setScene(transitions.release(token)) }), [transitions]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reconcile = (explicit = false) => {
      if (timer) clearTimeout(timer);
      setScene(transitions.update(resolveAtmosphere(selection, new Date()), explicit));
      if (selection === 'automatic' && AppState.currentState === 'active') timer = setTimeout(() => reconcile(), nextAppearanceBoundary(new Date()));
    };
    reconcile(previousSelection.current !== selection); previousSelection.current = selection;
    const app = AppState.addEventListener('change', state => { if (state === 'active') reconcile(); else if (timer) clearTimeout(timer); });
    const native = Alarm?.addListener('onChange', () => { if (AppState.currentState === 'active') reconcile(); });
    return () => { if (timer) clearTimeout(timer); app.remove(); native?.remove(); };
  }, [selection, transitions]);
  const foundation = useMemo<Foundation>(() => ({ colors: atmosphereColors(scene, brightness), tokens: {
    type: { display: typography.display, appBar: typography.appBar, heading: typography.heading, body: typography.body, supporting: typography.supporting, metadata: typography.label, lineHeightRatio: 1.4 },
    space, shape: { tile:presentation.geometry.radius, group:shape.group, field:shape.field, action:shape.action, sheet:shape.sheet, icon:presentation.geometry.radius }, target: { minimum:presentation.geometry.target, nativeSingle:presentation.geometry.nativeSingle },
  } }), [scene, brightness]);
  return <Appearance.Provider value={{scene, brightness}}><AppearanceHolds.Provider value={holds}>
    <FoundationStyleProvider foundation={foundation}>{children}</FoundationStyleProvider>
  </AppearanceHolds.Provider></Appearance.Provider>;
}
export const useTheme = () => useContext(Theme);
export const useFontScaleOverride = () => useContext(FontScaleOverride);
export const useReducedMotionOverride = () => useContext(ReducedMotionOverride);
export function PresentationProvider({ colors, fontScale, reducedMotion, children }: PropsWithChildren<{ colors: Colors; fontScale?: number; reducedMotion?: boolean }>) {
  const inheritedScale = useFontScaleOverride(), inheritedMotion = useReducedMotionOverride();
  return <Theme.Provider value={colors}><FontScaleOverride.Provider value={fontScale ?? inheritedScale}><ReducedMotionOverride.Provider value={reducedMotion ?? inheritedMotion}>{children}</ReducedMotionOverride.Provider></FontScaleOverride.Provider></Theme.Provider>;
}
