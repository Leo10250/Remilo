/** Candidate colors and fixture-only appearance rules for the isolated design review. */
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Colors } from './colors';
import type { IconName } from './components';

export type ReviewPaletteId = 'classic' | 'sunrise' | 'sky' | 'meadow' | 'peach' | 'rose' | 'lavender' | 'mist';
export type ReviewBrightness = 'light' | 'dark';
export type ReviewPeriodId = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';
export type ReviewCategoryId = 'health' | 'nature' | 'fitness' | 'food' | 'social' | 'focus' | 'rest' | 'home' | 'general';
export type ReviewColors = Colors & { outline: string; decoration: string; decorationAlt: string };

export const reviewPalettes: readonly { id: ReviewPaletteId; name: string }[] = [
  { id: 'classic', name: 'Classic' }, { id: 'sunrise', name: 'Sunrise' }, { id: 'sky', name: 'Sky' },
  { id: 'meadow', name: 'Meadow' }, { id: 'peach', name: 'Peach' }, { id: 'rose', name: 'Rose' },
  { id: 'lavender', name: 'Lavender' }, { id: 'mist', name: 'Mist' },
];

const light = { dark: false, surface: '#FFFFFF', ink: '#14203A', muted: '#4D5870', accentInk: '#FFFFFF',
  border: '#DADEE7', outline: '#6F788C', danger: '#B3261E', warning: '#805000', success: '#17683C' };
const dark = { dark: true, ink: '#F4F5FA', muted: '#B9BECC', border: '#424A59', outline: '#828FA4',
  danger: '#FFB4AB', warning: '#F3CC83', success: '#98DBAF' };

export const reviewPaletteCatalog: Readonly<Record<ReviewPaletteId, Readonly<Record<ReviewBrightness, ReviewColors>>>> = {
  classic: {
    light: { ...light, background: '#F6F7FC', soft: '#EEF0FC', accent: '#454AC4', decoration: '#CCDDF8', decorationAlt: '#DCCBF6' },
    dark: { ...dark, background: '#161722', surface: '#212330', soft: '#2B2D41', accent: '#BAC0FF', accentInk: '#242143', decoration: '#394867', decorationAlt: '#534A71' },
  },
  sunrise: {
    light: { ...light, background: '#FFFBF2', soft: '#FFF1D6', accent: '#9B5D00', decoration: '#FFE19D', decorationAlt: '#F5C670' },
    dark: { ...dark, background: '#1C1913', surface: '#29251C', soft: '#342E20', accent: '#F1C267', accentInk: '#322400', decoration: '#645031', decorationAlt: '#826431' },
  },
  sky: {
    light: { ...light, background: '#F4F9FF', soft: '#EAF3FD', accent: '#1761AA', decoration: '#C2DDFC', decorationAlt: '#AFCDEC' },
    dark: { ...dark, background: '#141B22', surface: '#202B35', soft: '#253541', accent: '#99CBFA', accentInk: '#112D42', decoration: '#365976', decorationAlt: '#477693' },
  },
  meadow: {
    light: { ...light, background: '#F5FAF6', soft: '#E9F4ED', accent: '#286848', decoration: '#BBDDC5', decorationAlt: '#8CB99E' },
    dark: { ...dark, background: '#151D18', surface: '#202D25', soft: '#29382D', accent: '#98D5B0', accentInk: '#132E20', decoration: '#385B44', decorationAlt: '#52755C' },
  },
  peach: {
    light: { ...light, background: '#FFF7F4', soft: '#FCEBE5', accent: '#AA4334', decoration: '#FAC8B6', decorationAlt: '#EFA691' },
    dark: { ...dark, background: '#221918', surface: '#302321', soft: '#3D2B27', accent: '#F8B5A8', accentInk: '#3D2018', decoration: '#714C42', decorationAlt: '#935D50' },
  },
  rose: {
    light: { ...light, background: '#FFF7FA', soft: '#FCECF2', accent: '#A13C63', decoration: '#F2C5D5', decorationAlt: '#DFA9C5' },
    dark: { ...dark, background: '#211820', surface: '#2D222C', soft: '#3A2A37', accent: '#F5B6CD', accentInk: '#3A1D2B', decoration: '#6D4560', decorationAlt: '#8D5A79' },
  },
  lavender: {
    light: { ...light, background: '#F9F7FD', soft: '#F0EBFA', accent: '#6551A3', decoration: '#D6C8F4', decorationAlt: '#B9A4DF' },
    dark: { ...dark, background: '#1B1823', surface: '#282331', soft: '#322B40', accent: '#CFBDF8', accentInk: '#2E2046', decoration: '#54446E', decorationAlt: '#766091' },
  },
  mist: {
    light: { ...light, background: '#F6F8FA', soft: '#EDF1F4', accent: '#53616C', decoration: '#CDD8E2', decorationAlt: '#ABBCC9' },
    dark: { ...dark, background: '#161C20', surface: '#232C31', soft: '#2D373D', accent: '#BECBD6', accentInk: '#192A34', decoration: '#435B69', decorationAlt: '#617D8B' },
  },
};

export function reviewPalette(id: ReviewPaletteId, brightness: ReviewBrightness): ReviewColors {
  return reviewPaletteCatalog[id][brightness];
}

export const reviewPeriods: readonly { id: ReviewPeriodId; name: string; range: string; palette: ReviewPaletteId; minute: number }[] = [
  { id: 'morning', name: 'Morning', range: '6 AM - 10 AM', palette: 'sunrise', minute: 480 },
  { id: 'midday', name: 'Midday', range: '10 AM - 4 PM', palette: 'sky', minute: 780 },
  { id: 'afternoon', name: 'Afternoon', range: '4 PM - 8 PM', palette: 'peach', minute: 1050 },
  { id: 'evening', name: 'Evening', range: '8 PM - 11 PM', palette: 'lavender', minute: 1260 },
  { id: 'night', name: 'Night', range: '11 PM - 6 AM', palette: 'mist', minute: 1410 },
];

export function reviewPeriodForMinute(minute: number): (typeof reviewPeriods)[number] {
  const normalized = ((Math.floor(minute) % 1440) + 1440) % 1440;
  const id: ReviewPeriodId = normalized < 360 || normalized >= 1380 ? 'night' : normalized < 600 ? 'morning' :
    normalized < 960 ? 'midday' : normalized < 1200 ? 'afternoon' : 'evening';
  return reviewPeriods.find((period) => period.id === id)!;
}

export function reviewPeriodAt(instantMs: number, zoneId = 'America/Los_Angeles'): (typeof reviewPeriods)[number] {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zoneId, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(instantMs);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return reviewPeriodForMinute(hour * 60 + minute);
}

export const reviewCategories: readonly { id: ReviewCategoryId; name: string; glyph: IconName; palette: ReviewPaletteId }[] = [
  { id: 'health', name: 'Health', glyph: 'medication', palette: 'sky' },
  { id: 'nature', name: 'Nature', glyph: 'eco', palette: 'meadow' },
  { id: 'fitness', name: 'Fitness', glyph: 'fitness_center', palette: 'peach' },
  { id: 'food', name: 'Food', glyph: 'restaurant', palette: 'sunrise' },
  { id: 'social', name: 'Celebration and social', glyph: 'celebration', palette: 'rose' },
  { id: 'focus', name: 'Focus', glyph: 'book', palette: 'classic' },
  { id: 'rest', name: 'Rest', glyph: 'bedtime', palette: 'lavender' },
  { id: 'home', name: 'Home and errands', glyph: 'home', palette: 'mist' },
  { id: 'general', name: 'General', glyph: 'checklist', palette: 'classic' },
];

/** An explicitly authored review expectation, not the output of a text classifier. */
export type ReviewDescriptor = {
  category: ReviewCategoryId; confidence: 'confident' | 'general'; explanation: string; manualPalette?: ReviewPaletteId;
};
export type ReviewReminderAppearance = {
  palette: ReviewPaletteId; category: ReviewCategoryId; glyph: IconName;
  source: 'manual' | 'content' | 'event-time' | 'global'; explanation: string;
};
export function reviewReminderAppearance(item: Occurrence, options: {
  fixedPalette: ReviewPaletteId; colorMode: 'fixed' | 'time'; smartColors: boolean; descriptor?: ReviewDescriptor;
  ambientPalette?: ReviewPaletteId;
}): ReviewReminderAppearance {
  const descriptor = options.descriptor;
  const category = reviewCategories.find((candidate) => candidate.id === descriptor?.category) ?? reviewCategories[8];
  const base = { category: category.id, glyph: category.glyph };
  if (descriptor?.manualPalette) return { ...base, palette: descriptor.manualPalette, source: 'manual', explanation: 'Your selected color.' };
  if (options.smartColors && descriptor?.confidence === 'confident' && category.id !== 'general') {
    return { ...base, palette: category.palette, source: 'content', explanation: descriptor.explanation };
  }
  const general = reviewCategories[8];
  if (options.colorMode === 'time' && !item.allDay) {
    const period = reviewPeriodAt(item.eventStartMs, item.zoneId);
    return { palette: period.palette, category: general.id, glyph: general.glyph, source: 'event-time', explanation: 'Based on the event time.' };
  }
  const globalPalette = options.colorMode === 'time' ? options.ambientPalette ?? options.fixedPalette : options.fixedPalette;
  return { palette: globalPalette, category: general.id, glyph: general.glyph,
    source: 'global', explanation: item.allDay ? 'Uses the app color for an all-day event.' : 'Uses the app color.' };
}
