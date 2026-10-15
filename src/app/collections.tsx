import { useLocale } from '../localization/react';
import { Redirect } from 'expo-router';
// Older internal links return safely to the Agenda root.
export default function Collections() {
  'use no memo';
  useLocale(); return <Redirect href="/" />; }
