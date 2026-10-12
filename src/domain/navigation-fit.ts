/** Real measured label widths, rather than a linear approximation of Android font scaling. */
export function rootLabelsFit(availableWidth: number, widths: readonly number[]) {
  return widths.length === 4 && widths.every(width => Number.isFinite(width) && width >= 0 && width + 4 <= (availableWidth - 16) / 4 - 16);
}
