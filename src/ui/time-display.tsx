import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import Alarm from '../../modules/remilo-alarm/src/RemiloAlarmModule';
import { displayClock, displayDateTime, TimeDisplayObservation, type TimeDisplayOptions } from '../domain/time-display';
import * as presentation from '../domain/presentation';
import { clockPreferenceLabel } from '../domain/clock-preferences';

const TimeDisplay = createContext<TimeDisplayOptions>({});
export function TimeDisplayProvider({ children }: PropsWithChildren) {
  const [options, setOptions] = useState<TimeDisplayOptions>({});
  useEffect(() => {
    const observation = new TimeDisplayObservation(setOptions);
    const refresh = () => { const module = Alarm; if (module) void observation.refresh(() => module.getTimeDisplayPreferences()); };
    refresh();
    const native = Alarm?.addListener('onTimeDisplayPreferencesChanged', next => observation.update(next));
    const app = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { observation.close(); native?.remove(); app.remove(); };
  }, []);
  return <TimeDisplay.Provider value={options}>{children}</TimeDisplay.Provider>;
}
export function TimeDisplayOverride({ options, children }: PropsWithChildren<{ options: TimeDisplayOptions }>) {
  return <TimeDisplay.Provider value={options}>{children}</TimeDisplay.Provider>;
}
export function useTimeDisplay() { return useContext(TimeDisplay); }
export function useTimeFormatting() {
  const options = useTimeDisplay();
  return useMemo(() => ({
    shortTime: (value: number, zone?: string) => displayClock(value, zone, options),
    formatDate: (value: number, zone?: string) => new Intl.DateTimeFormat(options.localeTag, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: zone }).format(value),
    formatTime: (value: number | null | undefined, zone?: string) => value == null ? 'No alarm scheduled' : displayDateTime(value, zone, options, true),
    shortDateTime: (value: number, zone?: string) => displayDateTime(value, zone, options),
    clockPreferenceLabel: (minutes: number) => clockPreferenceLabel(minutes, options.localeTag, options),
    scheduleDateTime: (value: number, zone?: string, now?: number) => presentation.scheduleDateTime(value, zone, now, options),
    eventRange: (item: presentation.ScheduleItem, now?: number, omitDate?: boolean) => presentation.eventRange(item, now, omitDate, options),
    alertPresentation: (item: presentation.ScheduleItem, draft?: boolean, now?: number) => presentation.alertPresentation(item, draft, now, options),
    detailSchedulePresentation: (item: presentation.ScheduleItem, now?: number, hasPublication?: boolean) => presentation.detailSchedulePresentation(item, now, hasPublication, options),
    reminderBrowsingPresentation: (item: presentation.ScheduleItem & { agendaAtMs?: number }, now?: number, context?: presentation.CardContext) => presentation.reminderBrowsingPresentation(item, now, context, options),
  }), [options]);
}
