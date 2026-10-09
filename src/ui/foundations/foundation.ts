import type { Colors } from '../colors';

/** Optional component roles, supplied by presentation callers rather than a catalog. */
export type FoundationColors = Colors & {
  readonly outline: string;
  readonly focus: string;
  readonly primaryPressed: string;
  readonly onPrimaryPressed: string;
  readonly secondaryPressed: string;
  readonly onSecondaryPressed: string;
  readonly disabledSurface: string;
  readonly disabledInk: string;
  readonly selectedSurface: string;
  readonly selectedInk: string;
  readonly inverseSurface: string;
  readonly inverseInk: string;
  readonly inverseAction: string;
  readonly dangerSurface: string;
  readonly dangerInk: string;
};

/** Existing component geometry; no palette, scene or settings resolution. */
export interface FoundationTokens {
  readonly type: {
    readonly display: number; readonly appBar: number; readonly heading: number;
    readonly body: number; readonly supporting: number; readonly metadata: number;
    readonly lineHeightRatio: number;
  };
  readonly space: {
    readonly xs: number; readonly sm: number; readonly md: number;
    readonly gutter: number; readonly lg: number; readonly xl: number;
  };
  readonly shape: {
    readonly tile: number; readonly group: number; readonly field: number;
    readonly action: number; readonly sheet: number; readonly icon: number;
  };
  readonly target: { readonly minimum: number; readonly nativeSingle: number };
}

export interface Foundation {
  readonly colors: FoundationColors;
  readonly tokens: FoundationTokens;
}
