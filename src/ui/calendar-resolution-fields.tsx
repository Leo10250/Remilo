import { View } from 'react-native';
import type {
  CalendarFields,
  CalendarLinkPreview,
  CalendarSelections,
} from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { resolvedCalendarFields } from '../domain/calendar-link';
import { modeLabel } from '../domain/presentation';
import { useTranslation } from '../localization/react';
import { ActionFeedback, Choice, ConnectedGroup, Copy, ReadOnlyRow } from './components';
import { useTimeFormatting } from './time-display';

export function useCalendarFieldText() {
  const t = useTranslation();
  const { scheduleDateTime, formatDate } = useTimeFormatting();
  return (field: keyof CalendarFields, fields: Partial<CalendarFields>) => {
    if (fields[field] === undefined) return t('m_31893018064e');
    if (field !== 'schedule')
      return fields[field] || (field === 'notes' ? t('m_efe1cde67784') : t('m_4850b174b713'));
    const schedule = fields.schedule!;
    return (
      (schedule.allDay
        ? formatDate(schedule.eventStartMs, schedule.zoneId) + t('m_b3d544d5d55c')
        : scheduleDateTime(schedule.eventStartMs, schedule.zoneId) +
          ' – ' +
          scheduleDateTime(schedule.eventEndMs, schedule.zoneId)) +
      ' · ' +
      schedule.zoneId +
      (schedule.recurrence ? t('m_9e79a8b1aee5') : '')
    );
  };
}

export function CalendarResolutionFields({
  preview,
  selections,
  disabled,
  blockedMessage,
  onSelect,
}: {
  preview: CalendarLinkPreview;
  selections: CalendarSelections;
  disabled: boolean;
  blockedMessage?: string;
  onSelect: (field: keyof CalendarSelections, side: 'remilo' | 'google') => void;
}) {
  const t = useTranslation();
  const fieldText = useCalendarFieldText();
  const { scheduleDateTime } = useTimeFormatting();
  const { local, remote, baseline } = preview;
  if (!local) return null;
  const resolved = resolvedCalendarFields(local, remote, selections);
  const timing = selections.schedule ? preview.timings?.[selections.schedule] : null;
  const retained =
    preview.retainedAlertMs === undefined ? preview.nextAlertMs : preview.retainedAlertMs;
  return (
    <>
      {(['title', 'notes', 'schedule'] as const).map((field) => (
        <ConnectedGroup
          key={field}
          title={t(
            field === 'title'
              ? 'm_7e8cd2056da7'
              : field === 'notes'
                ? 'm_8a7525b1492f'
                : 'm_f4830a1dae29',
          )}
        >
          <View key="choices" style={{ padding: 16, gap: 8 }}>
            {baseline && (
              <View style={{ gap: 4 }}>
                <Copy muted size={14}>
                  {t('ui_calendar_last_confirmed')}
                </Copy>
                <Copy>{fieldText(field, baseline)}</Copy>
              </View>
            )}
            <Choice
              label={t('m_ab4821c44cdf')}
              description={fieldText(field, local)}
              selected={selections[field] === 'remilo'}
              disabled={disabled}
              onPress={() => onSelect(field, 'remilo')}
            />
            <Choice
              label={t('m_c017c30b1471')}
              description={fieldText(field, remote)}
              selected={selections[field] === 'google'}
              disabled={disabled}
              onPress={() => onSelect(field, 'google')}
            />
            {!selections[field] && <Copy muted>{t('m_52f9493747f8')}</Copy>}
          </View>
        </ConnectedGroup>
      ))}
      {resolved && (
        <ConnectedGroup title={t('m_3b8981de73a5')}>
          <View key="resolution" style={{ padding: 16, gap: 12 }}>
            <Copy heading>{resolved.title}</Copy>
            <Copy>{resolved.notes || t('m_efe1cde67784')}</Copy>
            <Copy>{fieldText('schedule', resolved)}</Copy>
            {timing && (
              <>
                <ReadOnlyRow
                  label={t('m_9071738f1459')}
                  value={scheduleDateTime(timing.dueAtMs, resolved.schedule.zoneId)}
                />
                {timing.mode === 'None' ? (
                  <Copy>{modeLabel('None')}</Copy>
                ) : (
                  <ReadOnlyRow
                    label={modeLabel(timing.mode === 'Notification' ? 'Notification' : 'Alarm')}
                    value={scheduleDateTime(timing.alarmAtMs, resolved.schedule.zoneId)}
                  />
                )}
              </>
            )}
          </View>
        </ConnectedGroup>
      )}
      <Copy muted>{t('m_32af1909c259')}</Copy>
      {!!blockedMessage && <ActionFeedback tone="warning" message={blockedMessage} />}
      {retained !== null && (
        <Copy>{t('ui_calendar_retained_alert_time', { time: scheduleDateTime(retained) })}</Copy>
      )}
      <Copy muted>{t('m_b2ab1c6e45a0')}</Copy>
    </>
  );
}
