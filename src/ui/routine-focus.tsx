import { useState } from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { RoutineSession } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { routineFocusStep } from '../domain/routine-focus';
import { modeLabel } from '../domain/presentation';
import { useTranslation } from '../localization/react';
import { Button, Card, ConnectedGroup, Copy, Disclosure, Icon, Sheet } from './components';
import { getExerciseIllustration, type ExerciseIllustration } from './exercise-illustrations';
import { RoutineProgress } from './routine-progress';
import { useFontScaleOverride, useTheme } from './theme';
import { useTimeFormatting } from './time-display';
import { chineseTextMetrics, fontWeightFor, lineHeightFor } from './tokens';

const stateKeys = { Ready: 'routine_ready', InProgress: 'routine_in_progress', Completed: 'routine_completed', Skipped: 'routine_skipped', NotCompleted: 'routine_not_completed',
  PartiallyCompleted: 'routine_partial', Rest: 'routine_rest', Paused: 'routine_paused', Upcoming: 'routine_upcoming' } as const;

export type RoutineUndo = { stepId: string; name: string; date: string };

function ExerciseGuidance({ notes, name }: { notes: string; name: string }) {
  const t = useTranslation(), colors = useTheme(), scale = useFontScaleOverride();
  const [open, setOpen] = useState(false), [overflows, setOverflows] = useState(false);
  const textStyle = { color: colors.muted, fontSize: 16 * scale, lineHeight: lineHeightFor(16) * scale, ...chineseTextMetrics(16, scale) };
  return <View style={{ gap: 4 }}>
    <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
      style={[textStyle, { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 }]}
      onTextLayout={event => setOverflows(event.nativeEvent.lines.length > 3)}>{notes}</Text>
    <Text style={textStyle} numberOfLines={3}>{notes}</Text>
    {overflows && <Button variant="neutral" label={t('routine_read_more')} accessibilityLabel={t('routine_read_more') + ': ' + name} onPress={() => setOpen(true)} />}
    <Sheet title={name} visible={open} onClose={() => setOpen(false)}><Copy>{notes}</Copy></Sheet>
  </View>;
}

export function ExerciseIllustrationFrame({ illustration, name }: { illustration: ExerciseIllustration; name: string }) {
  const t = useTranslation(), colors = useTheme(), scale = useFontScaleOverride(), { fontScale, height } = useWindowDimensions();
  const [zoom, setZoom] = useState(false), [availableWidth, setAvailableWidth] = useState(0);
  const collapsed = Math.max(scale, fontScale) >= 1.6 || height < 640;
  const frameWidth = Math.min(320, availableWidth), frameHeight = Math.min(180, frameWidth * 9 / 16);
  return <View onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)}>
    {collapsed ? <Button label={t('routine_view_illustration')} variant="neutral" onPress={() => setZoom(true)} /> :
      <Pressable accessibilityRole="button" accessibilityLabel={t('routine_illustration_title', { name }) + '. ' + t(illustration.descriptionKey)} accessibilityHint={t('routine_view_illustration')}
        onPress={() => setZoom(true)} style={{ alignSelf: 'center', width: availableWidth ? frameWidth : '100%', aspectRatio: 16 / 9, maxHeight: 180, minHeight: 48, borderRadius: 16, backgroundColor: colors.soft, overflow: 'hidden' }}>
        <Image source={illustration.source} accessibilityLabel={t(illustration.descriptionKey)} accessible={false} resizeMode="contain" style={{ width: '100%', height: frameHeight || '100%' }} />
        <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', right: 8, top: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="open_in_new" size={20} /></View>
      </Pressable>}
    <Sheet title={t('routine_illustration_title', { name })} visible={zoom} onClose={() => setZoom(false)}>
      <Image source={illustration.source} accessibilityLabel={t(illustration.descriptionKey)} resizeMode="contain" style={{ width: '100%', height: Math.max(180, Math.min(480, height * 0.5)), backgroundColor: colors.soft, borderRadius: 16 }} />
      <Copy muted>{t(illustration.descriptionKey)}</Copy>
    </Sheet>
  </View>;
}

function RoutineSequenceRow({ step, index, total, guarded, onSelect }: {
  step: RoutineSession['steps'][number]; index: number; total: number; guarded: boolean; onSelect: () => void;
}) {
  const t = useTranslation(), colors = useTheme(), [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" disabled={guarded} accessibilityState={{ disabled: guarded }}
    accessibilityLabel={[t('routine_ordinal', { current: index + 1, total }), step.name, step.target, step.completed ? t('routine_completed') : ''].filter(Boolean).join('. ')}
    onPress={onSelect} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ minHeight: 64, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
      borderWidth: 2, borderColor: focused ? colors.accent : 'transparent', backgroundColor: pressed ? colors.soft : colors.surface })}>
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft }}>
      {step.completed ? <Icon name="check" size={20} /> : <Copy muted size={14}>{index + 1}</Copy>}
    </View>
    <View style={{ flex: 1, gap: 4 }}><Copy>{step.name}</Copy>{!!step.target && <Copy muted size={14}>{step.target}</Copy>}{step.completed && <Copy muted size={14}>{t('routine_completed')}</Copy>}</View>
    <Icon name="chevron_right" size={20} />
  </Pressable>;
}

/** Shared actual Focus composition; the screen alone owns dated native mutations. */
export function RoutineSessionContent({ session, selectedId, onSelect, onChangeStep, guarded = false, ended, undo, onUndo, onOpenToday }: {
  session: RoutineSession; selectedId?: string; onSelect: (id: string) => void; onChangeStep: (id: string, completed: boolean) => void;
  guarded?: boolean; ended: boolean; undo?: RoutineUndo | null; onUndo: () => void; onOpenToday: () => void;
}) {
  const t = useTranslation(), colors = useTheme(), scale = useFontScaleOverride();
  const { clockPreferenceLabel, formatDate } = useTimeFormatting();
  const current = routineFocusStep(session, selectedId), currentIndex = session.steps.findIndex(step => step.id === current?.id);
  const illustration = getExerciseIllustration(current?.illustration);
  const state = session.state;
  const mode = session.mode;
  const alert = modeLabel(mode);
  const eligible = !guarded && !ended && !!session.occurrenceId && !session.deleted && !session.skipped && state !== 'Upcoming';
  const remaining = session.steps.map((step, index) => ({ step, index })).filter(({ step }) => step.id !== current?.id);
  const canUndo = !!undo && undo.date === session.date && session.steps.some(step => step.id === undo.stepId && step.completed);
  return <View style={{ gap: 12 }}>
    <Copy heading size={24}>{session.title}</Copy>
    <Copy muted size={14}>{formatDate(new Date(session.date + 'T12:00:00').getTime())}</Copy>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon name={mode === 'Alarm' ? 'alarm' : mode === 'Notification' ? 'notifications' : 'alarm_off'} size={20} />
      <View style={{ flex: 1 }}><Copy muted size={14}>{alert}{mode !== 'None' && session.minutes != null ? ' · ' + clockPreferenceLabel(session.minutes) : ''}</Copy></View>
    </View>
    {!!session.totalCount ? <RoutineProgress done={session.completedCount} total={session.totalCount} state={t(stateKeys[state])} /> :
      <Copy heading>{t(stateKeys[state])}</Copy>}
    {ended && <><Copy muted>{t('routine_day_ended')}</Copy><Button label={t('routine_open_today')} variant="secondary" onPress={onOpenToday} disabled={guarded} /></>}
    {state === 'Rest' && <Copy muted>{t('routine_rest_hint')}</Copy>}
    {state === 'Paused' && <Copy muted>{t('routine_paused_hint')}</Copy>}
    {!!session.totalCount && <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View accessibilityLiveRegion="polite" style={{ flex: 1, minWidth: 0 }}><Copy muted size={14}>{canUndo ? t('routine_completed_named', { name: undo.name }) : t('routine_one_check')}</Copy></View>
      {canUndo && <View style={{ flexShrink: 0 }}><Button label={t('routine_undo')} accessibilityLabel={t('routine_undo_named', { name: undo.name })}
        icon="undo" variant="neutral" disabled={!eligible} onPress={onUndo} /></View>}
    </View>}
    {current && <Card><View style={{ gap: 12 }}>
      <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
        <Copy muted size={14}>{current.completed ? t('routine_completed_exercise') + ' · ' + t('routine_ordinal', { current: currentIndex + 1, total: session.totalCount }) : t('routine_current_position', { current: currentIndex + 1, total: session.totalCount })}</Copy>
        <Copy heading size={24}>{current.name}</Copy>
      </View>
      {illustration && <ExerciseIllustrationFrame key={current.id + ':' + illustration.id} illustration={illustration} name={current.name} />}
      {!!current.target && <Text style={{ color: colors.ink, fontSize: 24 * scale, lineHeight: lineHeightFor(24) * scale,
        fontWeight: fontWeightFor(24, '500'), ...chineseTextMetrics(24, scale, '500') }}>{current.target}</Text>}
      {!!current.notes && <ExerciseGuidance key={current.id} notes={current.notes} name={current.name} />}
      {current.completed && <Copy muted>{t('routine_completed')}</Copy>}
      <Button label={t(current.completed ? 'routine_undo_completion' : session.steps.filter(step => !step.completed).length === 1 ? 'routine_complete_exercise' : 'routine_complete_continue')} icon={current.completed ? 'undo' : 'check'}
        accessibilityLabel={t(current.completed ? 'routine_undo_named' : 'routine_mark_named', { name: current.name })}
        disabled={!eligible} onPress={() => onChangeStep(current.id, !current.completed)} />
      {currentIndex > 0 && <Button label={t('routine_view_previous')} variant="neutral" disabled={guarded} onPress={() => onSelect(session.steps[currentIndex - 1].id)} />}
    </View></Card>}
    {!current && session.completed && <Card><View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Icon name="check_circle" /><View style={{ flex: 1 }}><Copy heading>{t(ended ? 'routine_completed' : 'routine_daily_finished')}</Copy></View>
    </View></Card>}
    {!!remaining.length && <ConnectedGroup title={t('routine_sequence')}>{remaining.map(({ step, index }) => <RoutineSequenceRow key={step.id} step={step} index={index} total={session.totalCount} guarded={guarded} onSelect={() => onSelect(step.id)} />)}</ConnectedGroup>}
    {!!session.notes && <Disclosure title={t('m_8a7525b1492f')} icon="notes"><Copy>{session.notes}</Copy></Disclosure>}
  </View>;
}
