import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReviewMotion } from './theme';
export function useReducedMotion() {
  const review = useReviewMotion();
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (live) setReduced(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { live = false; subscription.remove(); };
  }, []);
  return review ?? reduced;
}
