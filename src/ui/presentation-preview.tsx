import type { PropsWithChildren } from 'react';

/** Ordinary/native bundles keep their settings-backed presentation unchanged. */
export default function PresentationPreview({ children }: PropsWithChildren) { return <>{children}</>; }
