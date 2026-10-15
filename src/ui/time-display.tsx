import { useLocale, useTranslation } from '../localization/react';
import { t, confirmLanguage } from '../localization';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState, View, Text, Pressable, ActivityIndicator } from 'react-native';
import Alarm from '../../modules/remilo-alarm/src/RemiloAlarmModule';
import { displayClock, displayDateTime, TimeDisplayObservation, type TimeDisplayOptions } from '../domain/time-display';
import * as presentation from '../domain/presentation';
import { clockPreferenceLabel } from '../domain/clock-preferences';

const TimeDisplay = createContext<TimeDisplayOptions>({});
export function TimeDisplayProvider({ children }: PropsWithChildren) {
  'use no memo';
  const t = useTranslation();
  const [options, setOptions] = useState<TimeDisplayOptions>({});
  const [ready, setReady] = useState(!Alarm);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const observation = new TimeDisplayObservation(next => { confirmLanguage(next.resolvedLanguage ?? 'en'); setOptions(next); setReady(true); setFailed(false); });
    const refresh = () => { const module = Alarm; if (module) void observation.refresh(async () => { try { return await module.getTimeDisplayPreferences(); } catch (error) { setFailed(true); throw error; } }); };
    refresh();
    const native = Alarm?.addListener('onTimeDisplayPreferencesChanged', next => observation.update(next));
    const app = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { observation.close(); native?.remove(); app.remove(); };
  }, []);
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>{failed ? <><Text>{t('m_a74a73feb889')}</Text><Pressable onPress={() => { setFailed(false); void Alarm?.getTimeDisplayPreferences().then(next => { confirmLanguage(next.resolvedLanguage ?? 'en'); setOptions(next); setReady(true); }).catch(() => setFailed(true)); }}><Text>Retry / 重试</Text></Pressable></> : <ActivityIndicator />}</View>;
  return <TimeDisplay.Provider value={options}>{children}</TimeDisplay.Provider>;
}
export function TimeDisplayOverride({ options, children }: PropsWithChildren<{ options: TimeDisplayOptions }>) {
  'use no memo';
  useLocale();
  return <TimeDisplay.Provider value={options}>{children}</TimeDisplay.Provider>;
}
export function useTimeDisplay() { return useContext(TimeDisplay); }
export function useTimeFormatting() {
  const options = useTimeDisplay();
  return useMemo(() => ({
    shortTime: (value: number, zone?: string) => displayClock(value, zone, options),
    formatDate: (value: number, zone?: string) => new Intl.DateTimeFormat(options.localeTag, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: zone }).format(value),
    formatTime: (value: number | null | undefined, zone?: string) => value == null ? t('m_29605b40c59d') : displayDateTime(value, zone, options, true),
    shortDateTime: (value: number, zone?: string) => displayDateTime(value, zone, options),
    clockPreferenceLabel: (minutes: number) => clockPreferenceLabel(minutes, options.localeTag, options),
    scheduleDateTime: (value: number, zone?: string, now?: number) => presentation.scheduleDateTime(value, zone, now, options),
    eventRange: (item: presentation.ScheduleItem, now?: number, omitDate?: boolean) => presentation.eventRange(item, now, omitDate, options),
    alertPresentation: (item: presentation.ScheduleItem, draft?: boolean, now?: number) => presentation.alertPresentation(item, draft, now, options),
    detailSchedulePresentation: (item: presentation.ScheduleItem, now?: number, hasPublication?: boolean) => presentation.detailSchedulePresentation(item, now, hasPublication, options),
    reminderBrowsingPresentation: (item: presentation.ScheduleItem & { agendaAtMs?: number }, now?: number, context?: presentation.CardContext) => presentation.reminderBrowsingPresentation(item, now, context, options),
  }), [options]);
}
