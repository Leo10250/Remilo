import { useState, type PropsWithChildren } from 'react';
import { PresentationProvider, useTheme } from '../../src/ui/theme';

/** Opt-in web fixture only; capture review scale before in-app navigation changes the URL. */
export default function PresentationPreview({ children }: PropsWithChildren) {
  const colors = useTheme();
  const [fontScale] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('reviewScale') === '2' ? 2 : undefined);
  const [reducedMotion] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('reviewMotion') === 'reduced' ? true : undefined);
  const [width] = useState(() => {
    const value = typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('reviewWidth')) : 0;
    return value >= 300 && value <= 1200 ? value : undefined;
  });
  return <PresentationProvider colors={colors} fontScale={fontScale} reducedMotion={reducedMotion}>
    <div style={{ display: 'flex', flex: 1, width: width ?? '100%', maxWidth: '100%', marginInline: 'auto', backgroundColor: colors.background }}>{children}</div>
  </PresentationProvider>;
}
