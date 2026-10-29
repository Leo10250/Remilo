import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { AccessibilityInfo, AppState, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { PostponeChoice, PostponeCapture } from '../domain/postpone';
import { emptyPostponeDraft, PostponeDraft, postponeChoices } from '../domain/postpone';
import { useLocalizedState, useTranslation } from '../localization/react';
import { ActionFeedback, BottomActionBar, Button, Copy, Icon, Sheet, Status } from './components';
import { engine } from './native';
import { useFontScaleOverride, useFoundationStyle, useTheme } from './theme';
import { chineseTextMetrics, lineHeightFor, typography, shape, space } from './tokens';
import { useTimeFormatting } from './time-display';
import { ZoneSummary } from './schedule';
import { DateTimeFields } from './date-time-fields';
import { presentation } from './atmosphere.generated';

const noSubscribe = () => () => {};
const emptySnapshot = () => emptyPostponeDraft;
export function PostponeChooser({ visible, capture, busy, uncertain, acknowledged, eligible, feedback, retryLabel, progressLabel,
  onClose, onSubmit, onRetry, onAlarmSettings, onSelectionChange, returnFocusRef, returnFocusWhen, acknowledgedLabel, draftOwner }: {
  visible: boolean; capture: PostponeCapture | null; busy: boolean; uncertain: boolean; acknowledged: boolean; eligible: boolean;
  feedback?: ReactNode; retryLabel: string; progressLabel: string; acknowledgedLabel?: string; draftOwner?: PostponeDraft;
  onClose: () => void; onSubmit: (targetMs: number) => void; onRetry: () => void; onAlarmSettings: () => void;
  onSelectionChange: () => void;
  returnFocusRef?: RefObject<View | null>; returnFocusWhen?: () => boolean;
}) {
  'use no memo';
  const t = useTranslation(), inherited = useTheme(), foundation = useFoundationStyle();
  const colors = foundation?.colors ?? inherited;
  const { fontScale } = useWindowDimensions(), scale = useFontScaleOverride(), layoutScale = Math.max(scale, fontScale);
  const { shortTime, formatTime, clockPreferenceLabel } = useTimeFormatting();
  const [width, setWidth] = useState(0), [columnRequiredFor, setColumnRequiredFor] = useState(''), [now, setNow] = useState(Date.now);
  const [tileMeasure, setTileMeasure] = useState({ key: '', height: Number(presentation.geometry.postponeTile) }), [focused, setFocused] = useState<PostponeChoice | null>(null);
  const [pickerError, setPickerError] = useLocalizedState<string | null>(null);
  const customTrigger = useRef<View>(null), wasCustom = useRef(false);
  const draft = useMemo(() => draftOwner ?? (capture ? new PostponeDraft(capture, input => engine().resolvePostponeTime(input)) : null), [capture, draftOwner]);
  const state = useSyncExternalStore(draft?.subscribe ?? noSubscribe, draft?.snapshot ?? emptySnapshot, draft?.snapshot ?? emptySnapshot);
  useEffect(() => {
    const returned = wasCustom.current && !state.customOpen; wasCustom.current = state.customOpen;
    if (!returned || !visible) return;
    const timer = setTimeout(() => { const target = customTrigger.current;
      if (target) { target.focus(); if (Platform.OS === 'android') AccessibilityInfo.sendAccessibilityEvent(target, 'focus'); } }, 0);
    return () => clearTimeout(timer);
  }, [state.customOpen, visible]);
  const frozen = busy || uncertain || acknowledged;
  useEffect(() => { draft?.setFrozen(frozen); }, [draft, frozen]);
  useEffect(() => {
    if (!visible || !draft) return;
    void draft.initialize();
    let minute = Math.floor(Date.now() / 60_000);
    const refresh = () => { const time = Date.now(); setNow(time); void draft.refreshPreviews(time); };
    const tick = setInterval(() => { if (AppState.currentState !== 'active') return;
      const time = Date.now(); setNow(time); const next = Math.floor(time / 60_000);
      if (next !== minute) { minute = next; void draft.refreshPreviews(time); } }, 1_000);
    const app = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(tick); app.remove(); if (!draftOwner) draft.close(); };
  }, [visible, draft, draftOwner]);
  const selected = state.customOpen ? state.customDraft?.instantMs === state.customInstantMs ? state.customDraft : null : state.target;
  const previewMs = state.customOpen ? state.customInstantMs : state.target?.instantMs;
  const future = previewMs != null && previewMs > now;
  const fitKey = `${width}:${layoutScale}:${t('postpone_24_hours')}`;
  const oneColumn = layoutScale >= 1.6 || columnRequiredFor === fitKey || width > 0 && (width - space.sm) / 2 < 140 * Math.min(layoutScale, 1.3);
  const tileWidth = oneColumn || !width ? '100%' : (width - space.sm) / 2;
  const measurementKey = `${fitKey}:${oneColumn}`;
  const tileHeight = tileMeasure.key === measurementKey ? tileMeasure.height : presentation.geometry.postponeTile;
  const title = (choice: PostponeChoice) => choice === '15' ? t('postpone_15_minutes') : choice === '30' ? t('postpone_30_minutes') : choice === '60' ? t('postpone_one_hour')
    : choice === '1440' ? t('postpone_one_day') : choice === 'custom' ? t('postpone_custom') : t('postpone_tomorrow');
  const subtitle = (choice: PostponeChoice) => {
    if (choice === 'custom') return state.targets.custom ? shortTime(state.targets.custom.instantMs, capture?.zoneId) : t('postpone_date_time');
    const resolved = state.targets[choice];
    if (choice === '1440') return [t('postpone_24_hours'), resolved ? shortTime(resolved.instantMs, capture?.zoneId) : '—'].join('\n');
    if (resolved) return shortTime(resolved.instantMs, capture?.zoneId);
    return choice.startsWith('tomorrow-') && capture ? clockPreferenceLabel(capture.tomorrowMinutes[Number(choice.at(-1))]) : '—';
  };
  const groupCount = capture && 'kind' in capture && capture.kind === 'Group' ? capture.members.length : null;
  const back = () => { if (!frozen) { setPickerError(null); draft?.backToChoices(); } };
  return <Sheet visible={visible} title={state.customOpen ? t('postpone_custom_date_time') : t('m_a5200499d443')} onClose={onClose}
    returnFocusRef={returnFocusRef} returnFocusWhen={returnFocusWhen}
    onBack={state.customOpen ? back : onClose}
    footer={<BottomActionBar><View style={{ width: '100%', gap: 8 }}>
      {capture && previewMs != null && <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 16, gap: 4 }}>
        <Copy muted size={typography.supporting}>{groupCount != null ? t('postpone_next_group', { count: groupCount }) : t('postpone_next_alert')}</Copy><Copy>{formatTime(previewMs, capture.zoneId)}</Copy>
        <ZoneSummary zoneId={capture.zoneId} atMs={previewMs} />
      </View>}
      {selected?.adjustment !== 'none' && selected && <Copy muted size={typography.supporting}>
        {selected.adjustment === 'gapForward' ? t('m_d242331f3d81') : t('m_9365adde07dc')}</Copy>}
      {previewMs != null && !future && !frozen && <Status label={t('postpone_future_time')} tone="danger" />}
      {feedback}
      {state.customOpen ? <>
        <Button label={t('postpone_use_time')} disabled={frozen || state.resolving || !!state.error || !future} onPress={() => { void draft?.useCustom(Date.now()).then(applied => { if (applied) onSelectionChange(); }); }} />
        <Button label={t('postpone_back_choices')} variant="secondary" disabled={frozen} onPress={back} />
      </> : acknowledged ? <>
        <Button label={acknowledgedLabel ?? t('m_59f6ec7bb281')} onPress={onClose} />
        <Button label={t('m_0146bbb12bf3')} variant="secondary" onPress={onAlarmSettings} />
      </> : <Button label={busy ? progressLabel : uncertain ? retryLabel : groupCount != null ? t('postpone_all_action', { count: groupCount }) : t('postpone_action')} busy={busy}
        disabled={busy || !uncertain && (!eligible || !future || state.resolving || !!state.error)}
        onPress={() => { if (uncertain) onRetry(); else if (state.target) onSubmit(state.target.instantMs); }} />}
    </View></BottomActionBar>}>
    {capture && <>
      <Copy heading>{'title' in capture ? capture.title || t('m_31757bbfa17e') : t('postpone_group_subject', { count: capture.members.length })}</Copy>
      <Copy muted size={typography.supporting}>{groupCount != null ? t('postpone_scope_group', { count: groupCount }) : t('postpone_scope_single')}</Copy>
      {state.customOpen ? <>
        {state.customInstantMs != null && <DateTimeFields value={state.customInstantMs} zoneId={capture.zoneId} allDay={false}
          labelPrefix={t('postpone_custom_date_time')} onError={setPickerError}
          disabled={frozen || state.resolving} onChange={value => { setPickerError(null); onSelectionChange(); void draft?.editCustom(value, Date.now()); }} />}
        {pickerError && <ActionFeedback message={pickerError} tone="danger" />}
      </> : <View onLayout={event => setWidth(event.nativeEvent.layout.width)} accessibilityRole="radiogroup"
        accessibilityLabel={t('m_a5200499d443')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'stretch' }}>
        {postponeChoices.map(choice => {
          const selected = state.choice === choice;
          return <Pressable key={choice} ref={choice === 'custom' ? customTrigger : undefined} accessibilityRole={choice === 'custom' ? 'button' : 'radio'}
            accessibilityState={{ ...(choice === 'custom' ? { selected } : { checked: selected }), disabled: frozen || !eligible }}
            accessibilityLabel={[title(choice), subtitle(choice)].join(', ')} disabled={frozen || !eligible}
            onFocus={() => setFocused(choice)} onBlur={() => setFocused(null)}
            onLayout={event => { const height = Math.ceil(event.nativeEvent.layout.height);
              setTileMeasure(old => ({ key: measurementKey, height: Math.max(old.key === measurementKey ? old.height : presentation.geometry.postponeTile, height) })); }}
            onPress={() => { if (frozen) return; onSelectionChange(); if (choice === 'custom') void draft?.openCustom(Date.now()); else void draft?.select(choice, Date.now()); }}
            style={({ pressed }) => ({ width: tileWidth, minHeight: tileHeight, borderRadius: shape.group, borderWidth: selected || focused === choice ? 2 : 1,
              padding: selected || focused === choice ? 11 : 12, paddingRight: selected || focused === choice ? 39 : 40, gap: 4, justifyContent: 'center',
              borderColor: selected || focused === choice ? colors.accent : colors.border, backgroundColor: selected || pressed ? colors.soft : colors.background,
              opacity: frozen || !eligible ? .55 : 1 })}>
            <Text onTextLayout={event => { if (!oneColumn && event.nativeEvent.lines.length > 2) setColumnRequiredFor(fitKey); }}
              style={{ color: colors.ink, fontSize: typography.body * scale, lineHeight: lineHeightFor(typography.body) * scale,
                fontWeight: selected ? '500' : '400', ...chineseTextMetrics(typography.body, scale, selected ? '500' : '400') }}>{title(choice)}</Text>
            <Text onTextLayout={event => { if (!oneColumn && event.nativeEvent.lines.length > 2) setColumnRequiredFor(fitKey); }}
              style={{ color: colors.muted, fontSize: typography.supporting * scale, lineHeight: lineHeightFor(typography.supporting) * scale,
              ...chineseTextMetrics(typography.supporting, scale) }}>{subtitle(choice)}</Text>
            {selected && <View style={{ position: 'absolute', right: 12, top: 8 }}><Icon name="check" color={colors.accent} size={20} /></View>}
            {choice === 'custom' && <View style={{ position: 'absolute', right: 12, top: '50%', marginTop: -10 }}><Icon name="chevron_right" size={20} /></View>}
          </Pressable>;
        })}
      </View>}
      {state.resolving && <ActionFeedback loading />}
      {!!state.error && future && <Status label={t('postpone_failed_time')} tone="danger" />}
      {!acknowledged && !uncertain && !eligible && <Status label={t('postpone_stale')} tone="warning" />}
    </>}
  </Sheet>;
}
