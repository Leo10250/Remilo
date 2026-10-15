import { useLocale } from '../localization/react';
import { Redirect } from 'expo-router';
/** Retain the old route for links; permissions now live directly in Settings. */
export default function Readiness() {
  'use no memo';
  useLocale(); return <Redirect href="/settings" />; }
