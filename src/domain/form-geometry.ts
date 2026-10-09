/** Window/viewport coordinates are dp. The footer is a sibling, already reserved. */
export function revealRange(top: number, bottom: number, viewportTop: number, viewportHeight: number, offset: number, contentHeight: number) {
  const padding = 12, availableBottom = viewportTop + viewportHeight - padding;
  const delta = bottom > availableBottom ? bottom - availableBottom : top < viewportTop + padding ? top - viewportTop - padding : 0;
  return Math.max(0, Math.min(offset + delta, Math.max(0, contentHeight - viewportHeight)));
}
