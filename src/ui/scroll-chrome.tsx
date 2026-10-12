import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Animated, Platform, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { readRootSnapshot } from '../domain/navigation';
import { useFontScaleOverride, useTheme } from './theme';
import { presentation } from './atmosphere.generated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { headerBlendBounds, headerTransition } from './header-transition';

type ScrollChrome = {
  value: Animated.Value; surfaceOpacity: number | ReturnType<typeof Animated.add>;
  opening: number; toolbar: number; decoration: number;
  measureToolbar: (height: number) => void; restoreOffset: (offset: number) => void;
};
const Chrome = createContext<ScrollChrome | null>(null);
export const ScrollChromeProvider = Chrome.Provider;
export const useScrollChrome = () => useContext(Chrome);

/** Opaque content advances over the scene; only the decorative opening is transparent. */
export function ScrollReadingPlane() {
  const chrome = useScrollChrome(), colors = useTheme();
  if (!chrome) return null;
  const travel = chrome.value.interpolate({inputRange:[0,Math.max(1,chrome.decoration)],outputRange:[0,-chrome.decoration],extrapolate:'clamp'});
  return <Animated.View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{position:'absolute',top:chrome.decoration,left:0,right:0,height:'100%',backgroundColor:colors.background,transform:[{translateY:travel}]}} />;
}

/** One native scroll value drives both cover travel and the continuous header surface. */
export function usePageChrome(scrollKey?: string, compact = false): ScrollChrome {
  const { height, fontScale } = useWindowDimensions(), reviewScale = useFontScaleOverride();
  const insets=useSafeAreaInsets();
  const constrained = compact || height-insets.top-insets.bottom < 480 || Math.max(fontScale, reviewScale) >= 1.6;
  const [toolbar, setToolbar] = useState<number>(presentation.geometry.toolbar);
  const opening = constrained ? toolbar : Math.max(presentation.geometry.home, toolbar);
  const decoration = opening - toolbar;
  const initial = readRootSnapshot(scrollKey ? scrollKey + ':scroll' : '', 0);
  const [value] = useState(() => new Animated.Value(initial));
  const surfaceOpacity = useMemo(() => {
    const bounds = headerBlendBounds(decoration);
    if (!bounds) return 1;
    const p = value.interpolate({ inputRange: [bounds.start, bounds.end], outputRange: [0, 1], extrapolate: 'clamp' });
    // Native arithmetic keeps smoothstep on the UI thread, including gesture reversal.
    const blend = Animated.multiply(Animated.multiply(p, p), Animated.subtract(3, Animated.multiply(2, p)));
    return Animated.add(headerTransition.minimumOpacity, Animated.multiply(1 - headerTransition.minimumOpacity, blend));
  }, [value, decoration]);
  const restoreOffset = useCallback((y: number) => value.setValue(y), [value]);
  const measureToolbar = useCallback((h: number) => setToolbar(previous => Math.abs(previous - h) < 0.5 ? previous : Math.max(56, h)), []);
  return useMemo(() => ({ value, surfaceOpacity, opening, toolbar, decoration,
    measureToolbar, restoreOffset }), [value, surfaceOpacity, opening, toolbar, decoration, measureToolbar, restoreOffset]);
}

export function useChromeScroll(chrome: ScrollChrome | null, listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => void) {
  return useMemo(() => chrome ? Animated.event([{ nativeEvent: { contentOffset: { y: chrome.value } } }], {
    useNativeDriver: Platform.OS !== 'web', listener,
  }) : listener, [chrome, listener]);
}
