import { useState, type PropsWithChildren } from 'react';
import { PresentationProvider, useTheme } from '../../src/ui/theme';

/** Opt-in web fixture only; capture review scale before in-app navigation changes the URL. */
export default function PresentationPreview({ children }: PropsWithChildren) {
  const colors = useTheme();
  const [fontScale] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('reviewScale') === '2' ? 2 : undefined);
  const [reducedMotion] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('reviewMotion') === 'reduced' ? true : undefined);
  return <PresentationProvider colors={colors} fontScale={fontScale} reducedMotion={reducedMotion}>{children}</PresentationProvider>;
}
