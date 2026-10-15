import { useLocale } from '../localization/react';
import type { PropsWithChildren } from 'react';

/** Ordinary/native bundles keep their settings-backed presentation unchanged. */
export default function PresentationPreview({ children }: PropsWithChildren) {
  'use no memo';
  useLocale(); return <>{children}</>; }
