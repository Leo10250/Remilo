import { router } from 'expo-router';
import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Keyboard, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootTab } from '../domain/navigation';
import { SceneArt } from './components';
import { presentation } from './atmosphere.generated';
import { useReducedMotion } from './motion';
import { RootNavigation } from './navigation';
import { RootChrome, type RootBarState } from './root-chrome';
import { useCompactChrome } from './scroll-chrome';
import { useTheme } from './theme';

export function RootShell({
  selected,
  scene,
}: {
  selected: RootTab;
  scene: (tab: RootTab) => ReactNode;
}) {
  'use no memo';
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const compact = useCompactChrome();
  const [shown, setShown] = useState(selected);
  if (reduced && shown !== selected) setShown(selected);
  const [opacity] = useState(() => new Animated.Value(1));
  const [bar, setBar] = useState<RootBarState | null>(null);
  const select = useCallback((tab: RootTab) => {
    Keyboard.dismiss();
    router.setParams({ tab });
  }, []);
  const register = useCallback((next: RootBarState) => {
    setBar(next);
    return () => setBar((current) => (current === next ? null : current));
  }, []);

  useLayoutEffect(() => {
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    const leaving = shown !== selected;
    const fade = Animated.timing(opacity, {
      toValue: leaving ? 0 : 1,
      duration: leaving ? 80 : 140,
      easing: leaving ? Easing.in(Easing.quad) : Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    fade.start(({ finished }) => {
      if (finished && leaving) setShown(selected);
    });
    return () => fade.stop();
  }, [opacity, reduced, selected, shown]);

  const outgoing = shown !== selected;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {!compact && (
        <SafeAreaView
          pointerEvents="none"
          edges={['left', 'right']}
          style={StyleSheet.absoluteFill}
        >
          <View style={{ marginTop: insets.top, height: presentation.geometry.home }}>
            <SceneArt home />
          </View>
        </SafeAreaView>
      )}
      <Animated.View
        pointerEvents={outgoing ? 'none' : 'auto'}
        aria-hidden={outgoing}
        accessibilityElementsHidden={outgoing}
        importantForAccessibility={outgoing ? 'no-hide-descendants' : 'auto'}
        style={{ flex: 1, opacity: reduced ? 1 : opacity }}
      >
        <RootChrome.Provider value={{ selected, shown, select, register }}>
          <View key={shown} style={{ flex: 1 }}>
            {scene(shown)}
          </View>
        </RootChrome.Provider>
      </Animated.View>
      {bar && (
        <SafeAreaView edges={['left', 'right']} style={{ backgroundColor: colors.surface }}>
          <RootNavigation
            destination={selected}
            disabled={bar.disabled}
            isGuarded={bar.isGuarded}
            onChoose={select}
          />
        </SafeAreaView>
      )}
    </View>
  );
}
