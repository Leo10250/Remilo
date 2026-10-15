import { currentLanguage } from '../localization';
import { presentation } from './atmosphere.generated';
export const typography = presentation.typography;
export const space = presentation.spacing;
export const shape = presentation.shape;

export function lineHeightFor(size: number, englishMultiplier = 1.4): number {
  if (currentLanguage() !== 'zh-Hans') return size * englishMultiplier;
  const roles = presentation.localeTypography['zh-Hans'];
  return Object.values(roles).find(role => role.size === size)?.lineHeight ?? Math.ceil(size * 1.5);
}

export function fontWeightFor(size: number, english: '400' | '500' | '600' | '700'): '400' | '500' | '600' | '700' {
  if (currentLanguage() !== 'zh-Hans') return english;
  const weight = Object.values(presentation.localeTypography['zh-Hans']).find(role => role.size === size)?.weight ?? 400;
  return String(size <= 16 && english !== '400' ? 500 : weight) as '400' | '500' | '600';
}

/** Locale override for ordinary scaled Text; English keeps its original style. */
export function chineseTextMetrics(size: number, scale: number, weight: string = '400') {
  return currentLanguage() === 'zh-Hans' ? {
    lineHeight: lineHeightFor(size) * scale,
    fontWeight: fontWeightFor(size, weight === '400' ? '400' : '500'),
    letterSpacing: 0,
  } : {};
}
