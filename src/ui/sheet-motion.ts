import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, useWindowDimensions } from 'react-native';

export function useSheetExitAction(close: () => void) {
  const pending = useRef<(() => void) | null>(null);
  return {
    afterClose(action: () => void) {
      if (pending.current) return;
      pending.current = action;
      close();
    },
    onDismissed() {
      const action = pending.current;
      pending.current = null;
      action?.();
    },
    canReturnFocus: () => pending.current === null,
  };
}

export function useSheetMotion(
  visible: boolean,
  reduced: boolean,
  opened: () => void,
  dismissed: () => void,
) {
  const [present, setPresent] = useState(visible);
  if (visible && !present) setPresent(true);
  const [shown, setShown] = useState(false);
  const [height, setHeight] = useState(0);
  const [progress] = useState(() => new Animated.Value(visible && reduced ? 1 : 0));
  const { height: windowHeight } = useWindowDimensions();
  const latest = useRef({ visible, opened, dismissed });
  const pendingDismiss = useRef(false);

  useLayoutEffect(() => {
    latest.current = { visible, opened, dismissed };
  }, [visible, opened, dismissed]);
  useLayoutEffect(() => {
    if (visible) pendingDismiss.current = false;
  }, [visible]);

  const measured = height > 0;
  useLayoutEffect(() => {
    if (!present || (visible && (!shown || !measured))) return;
    const finish = () => {
      if (visible) latest.current.opened();
      else {
        pendingDismiss.current = true;
        setShown(false);
        setHeight(0);
        setPresent(false);
      }
    };
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reduced || !shown ? 0 : visible ? 220 : 160,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished && latest.current.visible === visible) finish();
    });
    return () => animation.stop();
  }, [measured, present, progress, reduced, shown, visible]);

  const finishDismissal = () => {
    if (!pendingDismiss.current || latest.current.visible) return;
    pendingDismiss.current = false;
    latest.current.dismissed();
  };
  useEffect(() => {
    if (present || Platform.OS !== 'android' || !pendingDismiss.current) return;
    const frame = requestAnimationFrame(() => {
      if (!pendingDismiss.current || latest.current.visible) return;
      pendingDismiss.current = false;
      latest.current.dismissed();
    });
    return () => cancelAnimationFrame(frame);
  }, [present]);

  return {
    present,
    onShow: () => setShown(true),
    onDismiss: finishDismissal,
    measure: setHeight,
    opacity: reduced ? 1 : progress,
    translateY: reduced
      ? 0
      : progress.interpolate({
          inputRange: [0, 1],
          outputRange: [height || windowHeight, 0],
          extrapolate: 'clamp',
        }),
  };
}
