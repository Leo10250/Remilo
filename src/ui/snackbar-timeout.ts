type AccessibilityTimeout = {
  isScreenReaderEnabled: () => Promise<boolean>;
  getRecommendedTimeoutMillis?: (duration: number) => Promise<number>;
};

/** A failed accessibility query still leaves ordinary feedback with a deadline. */
export function scheduleSnackbarDismiss(dismiss: () => void, accessibility: AccessibilityTimeout, baseDuration: number) {
  let live = true, timer: ReturnType<typeof setTimeout> | undefined;
  void (async () => {
    let reader = false;
    try { reader = await accessibility.isScreenReaderEnabled(); } catch { /* Use the ordinary deadline. */ }
    if (!live || reader) return;
    let duration = baseDuration;
    try {
      const recommended = await accessibility.getRecommendedTimeoutMillis?.(baseDuration);
      if (recommended !== undefined && Number.isFinite(recommended)) duration = Math.max(baseDuration, recommended);
    } catch { /* Keep the ordinary deadline when the platform query fails. */ }
    if (live) timer = setTimeout(dismiss, duration);
  })();
  return () => { live = false; if (timer !== undefined) clearTimeout(timer); };
}
