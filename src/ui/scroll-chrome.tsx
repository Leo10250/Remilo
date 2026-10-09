import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { readRootSnapshot } from '../domain/navigation';
import { useFontScaleOverride, useTheme } from './theme';
import { presentation } from './atmosphere.generated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScrollChrome = {
  value: Animated.Value; opening: number; toolbar: number; decoration: number; folded: boolean;
  measureToolbar: (height: number) => void; observeOffset: (offset: number) => void; restoreOffset: (offset: number) => void;
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

/** One native scroll value; React state changes only at the toolbar boundary. */
export function usePageChrome(scrollKey?: string, compact = false): ScrollChrome {
  const { height, fontScale } = useWindowDimensions(), reviewScale = useFontScaleOverride();
  const insets=useSafeAreaInsets();
  const constrained = compact || height-insets.top-insets.bottom < 480 || Math.max(fontScale, reviewScale) >= 1.6;
  const [toolbar, setToolbar] = useState<number>(presentation.geometry.toolbar);
  const opening = constrained ? toolbar : Math.max(presentation.geometry.home, toolbar);
  const decoration = opening - toolbar;
  const initial = readRootSnapshot(scrollKey ? scrollKey + ':scroll' : '', 0);
  const [value] = useState(() => new Animated.Value(initial));
  const offset = useRef(initial), foldedRef = useRef(initial >= decoration);
  const [folded, setFolded] = useState(initial >= decoration);
  const observeOffset = useCallback((y: number) => {
    offset.current = y;
    const next = decoration <= 0 || y >= decoration - 0.5;
    if (next !== foldedRef.current) { foldedRef.current = next; setFolded(next); }
  }, [decoration]);
  const restoreOffset = useCallback((y: number) => { value.setValue(y); observeOffset(y); }, [value, observeOffset]);
  useEffect(() => { observeOffset(offset.current); }, [observeOffset]);
  const measureToolbar = useCallback((h: number) => setToolbar(previous => Math.abs(previous - h) < 0.5 ? previous : Math.max(56, h)), []);
  return useMemo(() => ({ value, opening, toolbar, decoration, folded: constrained || folded,
    measureToolbar, observeOffset, restoreOffset }), [value, opening, toolbar, decoration, constrained, folded, measureToolbar, observeOffset, restoreOffset]);
}

export function useChromeScroll(chrome: ScrollChrome | null, listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => void) {
  return useMemo(() => chrome ? Animated.event([{ nativeEvent: { contentOffset: { y: chrome.value } } }], {
    useNativeDriver: Platform.OS !== 'web', listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      chrome.observeOffset(event.nativeEvent.contentOffset.y); listener(event);
    },
  }) : listener, [chrome, listener]);
}
