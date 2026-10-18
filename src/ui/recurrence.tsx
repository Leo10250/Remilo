import { chineseTextMetrics } from './tokens';
import { errorText, t as currentText, currentLanguage } from '../localization';
import { useLocalizedState, useTranslation } from '../localization/react';

import { useTimeFormatting } from './time-display';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { RecurrenceDraft, ReminderDraft } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { changeDraftZone, editorDraft, editorPreviewPayload, hasSeparateEvent } from '../domain/editor-draft';
import { cleanRepeat, dayNames, matchesRepeatPreset, repeatErrors, repeatExplanation, repeatLabel, repeatNames } from '../domain/repeat';
import { civilAt, deviceZone } from '../domain/time';
import { ActionFeedback, BottomActionBar, Button, Choice, Copy, DateField, Disclosure, Field, Group, Icon, SelectRow, SettingRow, Sheet, Toggle } from './components';
import { engine, nativeAvailable } from './native';
import { useFontScaleOverride, useTheme } from './theme';
import { TimeZoneField } from './time-zone';
export { repeatLabel, repeatNames } from '../domain/repeat';

export function RepeatForm({ value, onChange, startMs, zoneId, previewDraft, hasPublication = false, disabled = false }: {
  value?: RecurrenceDraft; onChange: (value?: RecurrenceDraft, zoneId?: string) => void | Promise<void>; startMs: number; zoneId?: string; previewDraft: ReminderDraft; hasPublication?: boolean; disabled?: boolean;
}) {
  'use no memo';
  const t = useTranslation();
  const { formatTime, formatDate, eventRange } = useTimeFormatting();
  const colors = useTheme(), scale = useFontScaleOverride(), [open, setOpen] = useState(false), [custom, setCustom] = useState(false);
  const zone = zoneId ?? deviceZone();
  const start = new Date(civilAt(startMs, zone) + 'Z'), weekday = (start.getUTCDay() + 6) % 7 + 1;
  const base: RecurrenceDraft = { frequency: 'daily', interval: 1, weekdays: [weekday], day: start.getUTCDate(),
    ordinal: Math.ceil(start.getUTCDate() / 7), weekday, month: start.getUTCMonth() + 1, zoneMode: 'floating' };
  const [rule, setRule] = useState<RecurrenceDraft>(base), [customZone, setCustomZone] = useState(zone);
  const [numbers, setNumbers] = useState({ interval: '1', day: String(base.day), count: '10' });
  const [busy, setBusy] = useState(false), [message, setMessage] = useLocalizedState('');
  const [loadedEnd, setLoadedEnd] = useState<{ key: string; instantMs: number } | null>(null);
  const numeric = (text: string) => /^\d+$/.test(text) ? Number(text) : Number.NaN;
  const draftRule = { ...rule, interval: numeric(numbers.interval), day: ['monthlyDay', 'yearly'].includes(rule.frequency) ? numeric(numbers.day) : rule.day, ...(rule.count != null ? { count: numeric(numbers.count) } : {}) };
  const validation = repeatErrors(draftRule, civilAt(startMs, zone).slice(0, 10)), valid = !Object.keys(validation).length;
  const previewZone = rule.zoneMode === 'pinned' ? customZone : deviceZone();
  const previewSource = editorPreviewPayload({ draft: editorDraft(previewDraft), recurrence: draftRule });
  const preview = useQuery({ queryKey: ['custom-repeat-preview', previewSource, previewZone], enabled: nativeAvailable && open && custom && valid,
    queryFn: async () => {
      const source = editorDraft({ ...previewDraft, title: t('m_324b134f57c7'), notes: '' });
      const converted = source.zoneId === previewZone ? { draft: source } : await changeDraftZone(source, previewZone, (input) => engine().convertTime(input));
      return engine().previewSchedule(editorPreviewPayload({ draft: converted.draft, recurrence: draftRule }));
    } });
  const endKey = customZone + '|' + rule.until;
  const endEpoch = loadedEnd?.key === endKey ? loadedEnd.instantMs : null;
  useEffect(() => {
    let live = true;
    if (!open || !custom || !rule.until) return;
    const key = customZone + '|' + rule.until;
    void engine().convertTime({ zoneId: customZone, local: rule.until + 'T12:00:00' }).then((resolved) => {
      if (live) setLoadedEnd({ key, instantMs: resolved.instantMs });
    }).catch(() => { if (live) setMessage(currentText('m_181e6c051fea')); });
    return () => { live = false; };
  }, [open, custom, rule.until, customZone, setMessage]);
  const patch = (change: Partial<RecurrenceDraft>) => setRule((current) => ({ ...current, ...change }));
  const close = () => { if (!busy) { setOpen(false); setCustom(false); setMessage(''); } };
  const apply = async (next?: RecurrenceDraft, nextZone = zone) => {
    if (disabled || busy) return;
    setBusy(true); setMessage('');
    try { await onChange(next ? cleanRepeat(next) : undefined, next?.zoneMode === 'floating' ? deviceZone() : nextZone); setOpen(false); setCustom(false); }
    catch (error) { setMessage(errorText(error, t('m_acb7fa5f7b05'))); }
    finally { setBusy(false); }
  };
  const quick = (frequency: RecurrenceDraft['frequency'], weekdays?: number[]) => void apply({ ...base,
    ...(value ? { zoneMode: value.zoneMode, count: value.count, until: value.until } : {}), frequency, ...(weekdays ? { weekdays } : {}) });
  const preset = (frequency: RecurrenceDraft['frequency'], weekdays?: number[]) => matchesRepeatPreset(value, base, frequency, weekdays);
  const customSelected = !!value && !(['daily', 'weekly', 'monthlyDay', 'yearly'] as const).some(frequency => preset(frequency)) && !preset('weekly', [1, 2, 3, 4, 5]);
  const explanation = repeatExplanation(draftRule);
  const support = explanation === 'missingMonthDate' ? t('m_c2264bae8ee6') : explanation === 'fifthWeekday' ?
    t('m_4ea38cb62826', { arg0: String(dayNames[(rule.weekday ?? weekday) - 1]) }) : explanation === 'leapYear' ? t('m_dce399732a1f') :
    explanation === 'missingYearDate' ? t('m_79510a8ae8db') : explanation === 'lastWeekday' ? t('m_13e7b3880c99') : null;
  const noAlert = previewDraft.mode === 'None';
  const showCalendar = !noAlert && (hasPublication || hasSeparateEvent(editorDraft(previewDraft)));
  const openCustom = () => {
    const next = cleanRepeat(value ?? base);
    setRule(next); setCustomZone(next.zoneMode === 'floating' ? deviceZone() : zone);
    setNumbers({ interval: String(next.interval), day: String(next.day ?? base.day), count: String(next.count ?? 10) });
    setMessage(''); setCustom(true);
  };
  const useRule = () => {
    if (Object.keys(validation).length) return;
    if (!preview.data || preview.isFetching || preview.error || !preview.data.upcoming.length) return;
    void apply(draftRule, customZone);
  };
  const unit = rule.frequency === 'daily' ? t('m_ab51004e9d71') : rule.frequency === 'weekly' ? t('m_eb0d2375b518') : rule.frequency === 'yearly' ? t('m_1c50993b009c') : t('m_168374334431');
  return <>
    <SettingRow intent="picker" icon="repeat" label={t('m_b6b7a0065808')} value={repeatLabel(value)} disabled={disabled || busy} onPress={() => { if (disabled || busy) return; setCustom(false); setMessage(''); setOpen(true); }} />
    <Sheet title={custom ? t('m_78f1813922c0') : t('m_b6b7a0065808')} visible={open} onClose={close} onBack={() => { if (!busy) { if (custom) setCustom(false); else close(); } }}
      footer={custom ? <BottomActionBar><View style={{ flex: 1, gap: 8 }}>
        {busy && <ActionFeedback loading message={t('m_29080326dd40')} />}{!!message && <ActionFeedback message={message} tone="danger" />}
        <Button label={busy ? t('m_3329a9bb48b9') : t('m_050b04ca8915')} busy={busy} disabled={!valid || !preview.data || preview.isFetching || !!preview.error || !preview.data.upcoming.length} onPress={useRule} />
        <Button label={t('m_f0714b3053e2')} variant="neutral" disabled={busy} onPress={() => setCustom(false)} />
      </View></BottomActionBar> : undefined}>
      {/* Applying a repeat must not reparent the sheet's native controls. */}
      <View collapsable={false} pointerEvents={busy ? 'none' : 'auto'} importantForAccessibility={busy ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={busy} style={{ gap: 12 }}>
      {!custom ? <>
        <Choice label={t('m_621d129ab80a')} selected={!value} onPress={() => void apply(undefined)} />
        <Choice label={t('m_c4e42b974c33')} selected={preset('daily')} onPress={() => quick('daily')} />
        <Choice label={t('m_6f4b602bb529')} selected={preset('weekly', [1, 2, 3, 4, 5])} onPress={() => quick('weekly', [1, 2, 3, 4, 5])} />
        <Choice label={t('m_73088c2d4cbd') + dayNames[weekday - 1]} selected={preset('weekly')} onPress={() => quick('weekly')} />
        <Choice label={t('m_24859dc0201b')} selected={preset('monthlyDay')} onPress={() => quick('monthlyDay')} />
        <Choice label={t('m_828ca0e45f14')} selected={preset('yearly')} onPress={() => quick('yearly')} />
        <Choice label={t('m_78f1813922c0')} selected={customSelected} description={value ? repeatLabel(value) : t('m_1fe6aa5476c4')} onPress={openCustom} />
      </> : <>
        <SelectRow label={t('m_16b6668d9831')} value={rule.frequency} choices={Object.entries(repeatNames).map(([frequency, label]) => ({ value: frequency as RecurrenceDraft['frequency'], label }))}
          onChange={(frequency) => patch({ frequency })} />
        <Field label={t('repeat_interval_label', { unit })} keyboardType="number-pad" value={numbers.interval} error={validation.interval}
          onChangeText={(interval) => setNumbers((current) => ({ ...current, interval }))} />
        {rule.frequency === 'weekly' && <><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {dayNames.map((name, index) => { const selected = rule.weekdays?.includes(index + 1) ?? false; return <Pressable key={name}
            accessibilityRole="checkbox" accessibilityLabel={name} aria-checked={selected} accessibilityState={{ checked: selected }}
            onPress={() => patch({ weekdays: selected ? rule.weekdays?.filter((day) => day !== index + 1) : [...(rule.weekdays ?? []), index + 1].sort() })}
            style={{ minWidth: 48, minHeight: 48, borderRadius: 24, padding: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.accent : colors.soft }}>
            {selected && <Icon name="check" size={14} color={colors.accentInk} />}<Text style={{ color: selected ? colors.accentInk : colors.ink, fontSize: 14 * scale, ...chineseTextMetrics(14, scale) }}>{name.slice(0, 2)}</Text></Pressable>; })}
        </View>{validation.weekdays && <ActionFeedback message={validation.weekdays} tone="danger" />}</>}
        {['monthlyDay', 'yearly'].includes(rule.frequency) && <Field label={t('m_d15f47202352')} keyboardType="number-pad" value={numbers.day} error={validation.day}
          onChangeText={(day) => setNumbers((current) => ({ ...current, day }))} />}
        {rule.frequency === 'yearly' && <SelectRow label={t('m_310ca503ef36')} value={rule.month ?? base.month!}
          choices={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: new Date(2024, index, 1).toLocaleString(currentLanguage(), { month: 'long' }) }))}
          onChange={(month) => patch({ month })} />}
        {rule.frequency === 'monthlyOrdinal' && <>
          <SelectRow label={t('m_7e260537917a')} value={rule.ordinal ?? 1} choices={[1, 2, 3, 4, 5, -1].map((ordinal, index) => ({ value: ordinal, label: [t('m_a151ceb1711a'), t('m_8b88a8508956'), t('m_5e7425d72f32'), t('m_c737c0b33eb3'), t('m_b612a40113ea'), t('m_eb970eb0951c')][index] }))} onChange={(ordinal) => patch({ ordinal })} />
          <SelectRow label={t('m_6ff81986ead1')} value={rule.weekday ?? weekday} choices={dayNames.map((label, index) => ({ value: index + 1, label }))} onChange={(next) => patch({ weekday: next })} />
        </>}
        <SelectRow label={t('m_e98982c9f2ba')} value={rule.count != null ? 'count' : rule.until ? 'date' : 'never'} choices={[{ value: 'never', label: t('m_6300ef800bb8') }, { value: 'count', label: t('m_171c926a894e') }, { value: 'date', label: t('m_cdd784f04a3d') }]}
          onChange={(ending) => patch({ count: ending === 'count' ? Number(numbers.count) : undefined, until: ending === 'date' ? civilAt(startMs + 30 * 86_400_000, zone).slice(0, 10) : undefined })} />
        {rule.count != null && <Field label={t('m_3120e6c7bf12')} keyboardType="number-pad" value={numbers.count} error={validation.count}
          onChangeText={(count) => setNumbers((current) => ({ ...current, count }))} />}
        {rule.until && (endEpoch == null ? <Copy muted>{t('m_1c115cc30c80')}</Copy> : <DateField label={t('m_14303aa0c4a0')} value={endEpoch} zoneId={customZone} dateOnly
          onError={setMessage} onChange={(ms) => patch({ until: civilAt(ms, customZone).slice(0, 10) })} />)}
        {validation.until && <ActionFeedback message={validation.until} tone="danger" />}
        <Toggle label={t('m_aa68fa8e5db4')} value={rule.zoneMode === 'pinned'} onChange={(enabled) => {
          patch({ zoneMode: enabled ? 'pinned' : 'floating' }); if (!enabled) setCustomZone(deviceZone());
        }} />
        {rule.zoneMode === 'pinned' ? <TimeZoneField value={customZone} atMs={startMs} onChange={setCustomZone} /> : <Copy muted size={13}>{t('m_0ab6c7829d6b')}</Copy>}
        {support && <Copy muted size={13}>{support}</Copy>}
        <Group title={noAlert ? t('m_36b4a10de04d') : previewDraft.mode === 'Notification' ? t('m_8c2b2752eb0a') : t('m_c4fd79c88bc5')}>
          {!valid ? <Copy muted>{t('m_1787ad19aea5')}</Copy> : preview.isFetching ? <ActionFeedback loading message={t('m_d55b202a4153')} /> : preview.error ?
            <><ActionFeedback message={t('m_c54c5811eb4f')} tone="danger" /><Button label={t('m_ceba35272869')} variant="secondary" onPress={() => void preview.refetch()} /></> : preview.data && <>
              {preview.data.upcoming.map((slot) => <View key={slot.nominalSlot} style={{ padding: 12, gap: 4 }}><Copy>{noAlert && previewDraft.allDay ? formatDate(slot.eventStartMs, slot.zoneId) + t('m_b3d544d5d55c') : formatTime(noAlert ? slot.eventStartMs : slot.alarmAtMs, slot.zoneId)}</Copy>
                {slot.adjusted && <Copy muted size={14}>{t('m_64cf134a367d')}</Copy>}</View>)}
              {showCalendar && <Disclosure title={t('m_c45cf0e5f910')} icon="event">
                <Copy size={14}>{eventRange({ ...editorDraft(previewDraft), ...preview.data, zoneId: previewZone })}</Copy>
              </Disclosure>}
              {!preview.data.upcoming.length ? <Copy muted>{t('m_172517e4f5de')}</Copy> : preview.data.upcoming.length < 3 && <Copy muted>{t('m_de7aab2159df')}</Copy>}
              {preview.data.warnings.map((warning) => <ActionFeedback key={warning} message={warning} tone="warning" />)}
            </>}
        </Group>
      </>}
      </View>{!custom && busy && <ActionFeedback loading message={t('m_29080326dd40')} />}{!custom && !!message && <ActionFeedback message={message} tone="danger" />}
    </Sheet>
  </>;
}
