/** Browsing-only presentation policy; never changes the approved artwork/palette. */
export const headerTransition = { distance: 64, minimumOpacity: 0.66, feather: 40 } as const;

export function headerBlendBounds(decoration: number) {
  if (decoration <= 0) return null;
  return { start: Math.max(0, decoration - headerTransition.distance), end: decoration };
}

/** Reference evaluation of the same native Animated arithmetic used by chrome. */
export function headerSurfaceOpacity(offset: number, decoration: number) {
  const bounds = headerBlendBounds(decoration);
  if (!bounds) return 1;
  const p = Math.max(0, Math.min(1, (offset - bounds.start) / (bounds.end - bounds.start)));
  const blend = p * p * (3 - 2 * p);
  return headerTransition.minimumOpacity + (1 - headerTransition.minimumOpacity) * blend;
}

export function headerScrimGeometry(opening: number, toolbar: number, subtitleHeight: number | null) {
  // Protect the whole opening until the optional label has actually been measured.
  const plateau = Math.min(opening, subtitleHeight === null ? opening : toolbar + subtitleHeight);
  const height = Math.min(opening, plateau + headerTransition.feather);
  return { height, plateauEnd: plateau / height };
}
