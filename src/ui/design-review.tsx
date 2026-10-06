import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { Occurrence, RecurrenceDraft } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { reviewPalette, reviewPalettes, reviewPeriods, reviewReminderAppearance, type ReviewBrightness, type ReviewPaletteId, type ReviewPeriodId } from './review-appearance';
import { reviewCollectionItems, reviewDescriptor, reviewItems, reviewLists, reviewNowMs, reviewRepeatFamilies, reviewScenarios, reviewZone, type ReviewScenario } from '../../verification/ui/design-review-fixtures';
import { alertPresentation, calendarDate, canAdjustAlert, deliveryExplanation, eventRange, ordinaryDue, repeatSummary, scheduleDateTime, stateIcon, stateLabel, stateTone } from '../domain/presentation';
import { civilAt } from '../domain/time';
import { changeDraftZone, moveDraftDue, moveDraftEvent } from '../domain/editor-draft';
import { reviewAlertLink, reviewContentAction, reviewDueLink, reviewDuplicate } from '../../verification/ui/review-actions';
import { reopenCompleted, restoreDeleted } from '../domain/actions';
import { Button, Choice, Copy, Disclosure, Field, Icon, IconButton, QueryState, SettingRow, Status, type IconName } from './components';
import { RepeatForm, repeatLabel } from './recurrence';
import { ReminderRow } from './reminder-row';
import { ScheduleDetails } from './schedule';
import { ReviewThemeProvider, useReviewFontScale, useTheme } from './theme';
import { engine } from './native';
import { TimeZoneField } from './time-zone';

type Approach = 'immersive' | 'layered' | 'hybrid';
type Screen = 'agenda' | 'lists' | 'completed' | 'trash' | 'create' | 'edit' | 'detail' | 'repeats' | 'settings' | 'appearance' | 'alarm' | 'notification' | 'branding';
type Overlay = 'menu' | 'filter' | 'list-menu' | 'date' | 'alert' | 'list' | 'appearance' | 'actions' | 'trash-confirm' | 'postpone' | 'discard' | 'create-list' | 'rename-list' | 'remove-list' | null;
type Collection = { id: string; name: string };
type ReviewModel = {
  screen: Screen; scenario: ReviewScenario; brightness: ReviewBrightness; palette: ReviewPaletteId; period: ReviewPeriodId;
  colorMode: 'fixed' | 'time'; smartColors: boolean; matchIcon: boolean; backgroundIcon: boolean;
  iconPalette: ReviewPaletteId; brightnessMode: 'system' | ReviewBrightness; includeSkipped: boolean;
  fontScale: number; reducedMotion: boolean; query: string; filter: 'all' | 'overdue' | 'problems';
  items: Occurrence[]; selectedId: string; overlay: Overlay; draft: Occurrence; repeat?: RecurrenceDraft;
  dateTarget: 'eventStartMs' | 'eventEndMs' | 'dueAtMs' | 'alarmAtMs';
  notesOpen: boolean; listId: string | null; origin: Screen; message: string; menuItemId: string | null;
  repeatState: 'Active' | 'Paused' | 'Ended'; lists: Collection[]; listName: string; error: string; dirty: boolean;
  alarmEnded: string[]; alarmSnoozed: string[]; manual: Record<string, ReviewPaletteId | 'auto'>;
  familyStates: Record<string, 'Active' | 'Paused' | 'Ended'>;
  undo: { itemId: string; revision: number; action: 'done' | 'trash' } | null;
  viewFilters: Record<string, { query: string; filter: ReviewModel['filter'] }>;
  retainedTargets: Record<string, number>;
};
type Update = (change: Partial<ReviewModel> | ((state: ReviewModel) => Partial<ReviewModel>)) => void;

const approaches: { id: Approach; name: string; summary: string }[] = [
  { id: 'immersive', name: 'A / Immersive', summary: 'Individual surfaces throughout' },
  { id: 'layered', name: 'B / Layered', summary: 'One atmosphere, small accents' },
  { id: 'hybrid', name: 'C / Hybrid', summary: 'Small accents, expressive details' },
];
const screens: { id: Screen; name: string }[] = [
  { id: 'agenda', name: 'Agenda' }, { id: 'lists', name: 'Lists' }, { id: 'completed', name: 'Completed' },
  { id: 'trash', name: 'Trash' }, { id: 'create', name: 'Create' }, { id: 'edit', name: 'Edit' },
  { id: 'detail', name: 'Detail' }, { id: 'repeats', name: 'Repeats' }, { id: 'settings', name: 'Settings' },
  { id: 'appearance', name: 'Appearance' }, { id: 'alarm', name: 'Alarm' },
  { id: 'notification', name: 'Notification' }, { id: 'branding', name: 'Branding' },
];
const landscape = require('../../assets/design-review/landscape.png') as ImageSourcePropType;
const botanical = require('../../assets/design-review/botanical.png') as ImageSourcePropType;
const iconAssets: Record<ReviewPaletteId, ImageSourcePropType> = {
  classic: require('../../assets/design-review/icon-classic.png'), sunrise: require('../../assets/design-review/icon-sunrise.png'),
  sky: require('../../assets/design-review/icon-sky.png'), meadow: require('../../assets/design-review/icon-meadow.png'),
  peach: require('../../assets/design-review/icon-peach.png'), rose: require('../../assets/design-review/icon-rose.png'),
  lavender: require('../../assets/design-review/icon-lavender.png'), mist: require('../../assets/design-review/icon-mist.png'),
};
function scenarioItems(scenario: ReviewScenario): Occurrence[] {
  if (scenario === 'empty' || scenario === 'loading') return reviewItems(scenario);
  return [...new Map([...reviewItems(scenario), ...reviewCollectionItems('completed'), ...reviewCollectionItems('trash')].map((item) => [item.id, item])).values()];
}

function initialDraft(): Occurrence {
  const seed = reviewItems('populated')[0];
  const event = reviewNowMs + 3_600_000;
  return { ...seed, id: 'new-review-item', title: '', notes: '', listId: null, listName: '', completed: false, deleted: false,
    skipped: false, overdue: false, allDay: false, deliveryState: 'Scheduled', alertAdjustment: null, segmentId: null,
    nominalSlot: null, repeatRule: undefined, repeatSummary: null, eventStartMs: event, eventEndMs: event + 1_800_000,
    dueAtMs: event, alarmAtMs: event, nextAlertMs: event, history: [], zoneId: reviewZone };
}
function initialModel(): ReviewModel {
  const items = scenarioItems('populated');
  return { screen: 'agenda', scenario: 'populated', brightness: 'light', palette: 'sunrise', period: 'morning',
    colorMode: 'time', smartColors: true, matchIcon: false, backgroundIcon: true, iconPalette: 'classic', brightnessMode: 'light', includeSkipped: false, fontScale: 1, reducedMotion: false,
    query: '', filter: 'all', items, selectedId: items[0].id, overlay: null, draft: initialDraft(), notesOpen: false,
    listId: null, origin: 'agenda', message: '', menuItemId: null, repeatState: 'Active', lists: reviewLists.map(({ id, name }) => ({ id, name })),
    listName: '', error: '', dirty: false, dateTarget: 'eventStartMs', alarmEnded: [], alarmSnoozed: [], manual: {}, familyStates: {}, undo: null, viewFilters: {}, retainedTargets: {} };
}
function viewKey(screen: Screen, listId: string | null) {
  return screen + ':' + (['agenda', 'completed', 'trash'].includes(screen) ? listId ?? '' : '');
}
function selectedItem(model: ReviewModel) {
  return model.items.find((item) => item.id === model.selectedId) ?? reviewItems('populated')[0];
}
function ambientPalette(model: ReviewModel) {
  return model.colorMode === 'time' ? reviewPeriods.find((period) => period.id === model.period)!.palette : model.palette;
}
function itemAppearance(item: Occurrence, model: ReviewModel) {
  const descriptor = reviewDescriptor(item);
  const manual = model.manual[item.id];
  return reviewReminderAppearance(item, { fixedPalette: model.palette, colorMode: model.colorMode,
    smartColors: model.smartColors, ambientPalette: ambientPalette(model), descriptor: manual ? { ...descriptor, manualPalette: manual === 'auto' ? undefined : manual } : descriptor });
}
function canvasColors(model: ReviewModel, approach: Approach) {
  const ambient = reviewPalette(ambientPalette(model), model.brightness);
  if (model.screen !== 'detail') return ambient;
  const identity = reviewPalette(itemAppearance(selectedItem(model), model).palette, model.brightness);
  return approach === 'immersive' ? identity : approach === 'hybrid' ? { ...ambient, accent: identity.accent, accentInk: identity.accentInk, soft: identity.soft } : ambient;
}
function openScreen(screen: Screen, model: ReviewModel, update: Update) {
  const change: Partial<ReviewModel> = { screen, overlay: null, message: '', error: '' };
  if (screen === 'create') {
    const list = model.lists.find((entry) => entry.id === model.listId);
    Object.assign(change, { draft: { ...initialDraft(), listId: list?.id ?? null, listName: list?.name ?? '' }, repeat: undefined, notesOpen: false, dirty: false, origin: model.screen });
  }
  if (screen === 'edit') {
    const item = selectedItem(model);
    Object.assign(change, { draft: { ...item }, repeat: item.repeatRule ?? undefined, notesOpen: !!item.notes, dirty: false, origin: model.screen === 'edit' ? 'detail' : model.screen });
  }
  update(change);
}
function reviewTime(model: ReviewModel) {
  const period = reviewPeriods.find((entry) => entry.id === model.period)!;
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: reviewZone }).format(reviewNowMs + (period.minute - 480) * 60_000);
}

/** Fixture-only workspace. Its entry is resolved only by the isolated preview command. */
export default function DesignReview() {
  const params = useLocalSearchParams<{ screen?: string; inspect?: string; approach?: string; brightness?: string; scenario?: string; scale?: string }>();
  const [model, setModel] = useState<ReviewModel>(() => {
    const initial = initialModel();
    const next: ReviewModel = { ...initial,
      ...(screens.some((entry) => entry.id === params.screen) ? { screen: params.screen as Screen } : {}),
      ...(params.brightness === 'dark' || params.brightness === 'light' ? { brightness: params.brightness as ReviewBrightness, brightnessMode: params.brightness as ReviewBrightness } : {}),
      ...(params.scale && [1, 1.25, 1.5, 1.75, 2].includes(Number(params.scale)) ? { fontScale: Number(params.scale) } : {}),
      ...(reviewScenarios.some((entry) => entry.id === params.scenario) ? { scenario: params.scenario as ReviewScenario,
        items: scenarioItems(params.scenario as ReviewScenario), selectedId: reviewItems(params.scenario as ReviewScenario)[0]?.id ?? initial.selectedId } : {}),
    };
    if (next.screen === 'edit') {
      const item = selectedItem(next);
      return { ...next, draft: { ...item }, repeat: item.repeatRule ?? undefined, notesOpen: !!item.notes, origin: 'detail' };
    }
    return next;
  }), [mode, setMode] = useState<'compare' | 'inspect'>('compare');
  const [approach, setApproach] = useState<Approach>(() => approaches.some((entry) => entry.id === params.approach) ? params.approach as Approach : 'hybrid');
  const [controlsOpen, setControlsOpen] = useState(false);
  const dimensions = useWindowDimensions(), narrow = dimensions.width < 740;
  const update: Update = (change) => setModel((current) => {
    const patch = typeof change === 'function' ? change(current) : change;
    const previous = viewKey(current.screen, current.listId), next = viewKey(patch.screen ?? current.screen, patch.listId === undefined ? current.listId : patch.listId);
    if (previous === next) return { ...current, ...patch };
    const viewFilters = { ...current.viewFilters, [previous]: { query: current.query, filter: current.filter } };
    return { ...current, ...(viewFilters[next] ?? { query: '', filter: 'all' }), ...patch, viewFilters };
  });
  const visible = narrow || mode === 'inspect' ? approaches.filter((entry) => entry.id === approach) : approaches;
  const selected = selectedItem(model);
  useEffect(() => {
    if (typeof document !== 'undefined') document.title = 'Remilo design review';
  }, []);
  useEffect(() => {
    if (!model.overlay || typeof document === 'undefined') return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const canvas = opener?.closest('[id^="review-canvas-"]')?.id.replace('review-canvas-', '');
    const dialogs = [...document.querySelectorAll<HTMLElement>('[data-review-sheet]')];
    const dialog = dialogs.find((element) => element.dataset.reviewSheet === canvas) ?? dialogs.find((element) => element.dataset.reviewSheet === approach) ?? dialogs[0];
    if (!dialog) return;
    dialogs.forEach((element) => { if (element !== dialog) { element.setAttribute('aria-hidden', 'true'); element.setAttribute('inert', ''); } });
    const controls = () => [...dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.offsetParent !== null && !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true' && !element.closest('[aria-hidden="true"]'));
    (controls()[0] ?? dialog).focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setModel((current) => ({ ...current, overlay: null, error: '', ...(current.screen === 'lists' ? { listId: null } : {}) }));
      } else if (event.key === 'Tab') {
        const elements = controls(), first = elements[0], last = elements.at(-1);
        if (!first) { event.preventDefault(); dialog.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      dialogs.forEach((element) => { element.removeAttribute('aria-hidden'); element.removeAttribute('inert'); });
      if (opener?.isConnected && (document.activeElement === document.body || dialog.contains(document.activeElement))) opener.focus();
    };
  }, [model.overlay, approach]);
  const reset = () => { setModel(initialModel()); };
  const selectScenario = (scenario: ReviewScenario) => {
    const items = scenarioItems(scenario);
    update({ scenario, items, selectedId: items[0]?.id ?? selected.id, message: '', overlay: null, alarmEnded: [], alarmSnoozed: [], manual: {}, dirty: false });
  };
  if (params.inspect === '1') return <ReviewThemeProvider colors={canvasColors(model, approach)} fontScale={model.fontScale} reducedMotion={model.reducedMotion}>
    <ReviewPhone approach={approach} model={model} update={update} narrow />
  </ReviewThemeProvider>;
  return <View style={styles.workspace}>
    <View style={styles.reviewHeader}>
      <View style={{ flex: 1, minWidth: 180 }}><Text style={styles.reviewTitle}>Remilo / Design Review</Text>
        <Text style={styles.reviewSubtitle}>Iteration 0 · Memory-only fixtures · Android acceptance pending</Text></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {narrow && <ReviewTool icon="filter_list" label="Toggle review controls" onPress={() => setControlsOpen(!controlsOpen)} />}
        <ReviewTool icon="refresh" label="Reset review fixtures" onPress={reset} />
        <ReviewTool icon="arrow_back" label="Open current app fixture" onPress={() => router.replace('/')} />
      </View>
    </View>
    {(!narrow || controlsOpen) && <View style={styles.toolbar}>
      <ReviewSelect label="Screen" value={model.screen} choices={screens} onChange={(value) => openScreen(value as Screen, model, update)} />
      <ReviewSelect label="Scenario" value={model.scenario} choices={reviewScenarios} onChange={(value) => selectScenario(value as ReviewScenario)} />
      <ReviewSelect label="Brightness" value={model.brightness} choices={[{ id: 'light', name: 'Light' }, { id: 'dark', name: 'Dark' }]} onChange={(value) => update({ brightness: value as ReviewBrightness, brightnessMode: value as ReviewBrightness })} />
      <ReviewSelect label="Atmosphere" value={model.colorMode === 'time' ? 'time' : model.palette} choices={[{ id: 'time', name: 'Time of day' }, ...reviewPalettes]}
        onChange={(value) => update(value === 'time' ? { colorMode: 'time' } : { colorMode: 'fixed', palette: value as ReviewPaletteId })} />
      <ReviewSelect label="Current Period" value={model.period} choices={reviewPeriods} onChange={(value) => {
        const period = value as ReviewPeriodId;
        update({ period });
      }} />
      <View style={styles.scaleControl}><Text style={styles.controlLabel}>Text {Math.round(model.fontScale * 100)}%</Text>
        <input aria-label="Text scale" type="range" min="1" max="2" step="0.25" value={model.fontScale}
          onChange={(event) => update({ fontScale: Number(event.target.value) })} style={{ width: 116, minHeight: 36, accentColor: '#245CD6' }} /></View>
      <View style={styles.toggleControl}><Text style={styles.controlLabel}>Reduced Motion</Text><Switch accessibilityLabel="Reduced motion review"
        value={model.reducedMotion} onValueChange={(reducedMotion) => update({ reducedMotion })} trackColor={{ true: '#245CD6', false: '#D7DEE8' }} /></View>
      {!narrow && <View style={styles.modeControl}>{(['compare', 'inspect'] as const).map((value) => <Pressable key={value} accessibilityRole="tab"
        accessibilityState={{ selected: mode === value }} onPress={() => setMode(value)} style={[styles.modeButton, mode === value && styles.modeSelected]}>
        <Text style={[styles.modeLabel, mode === value && styles.modeLabelSelected]}>{value === 'compare' ? 'Compare' : 'Inspect'}</Text></Pressable>)}</View>}
    </View>}
    {(narrow || mode === 'inspect') && <View style={styles.approachTabs}>{approaches.map((entry) => <Pressable key={entry.id}
      accessibilityRole="tab" accessibilityState={{ selected: approach === entry.id }} onPress={() => setApproach(entry.id)}
      style={[styles.approachTab, approach === entry.id && styles.approachTabSelected]}>
      <Text style={[styles.modeLabel, approach === entry.id && styles.approachLabelSelected]}>{entry.name}</Text></Pressable>)}</View>}
    <View style={styles.evidenceBar}>
      <Text style={styles.evidenceText}>{model.screen === 'alarm' || model.screen === 'notification'
        ? 'Browser representation only. Android owns notification layout; this view does not exercise alarm playback.'
        : 'Same content and controls in every option. Actions change these in-memory fixtures only.'}</Text>
      {(model.screen === 'alarm' || model.screen === 'notification') && <Text style={styles.evidenceText}>Native Compose fixture: separate host snapshots</Text>}
    </View>
    <ScrollView style={{ flex: 1 }}><ScrollView horizontal={!narrow && mode === 'compare'} style={{ flexGrow: 0 }} contentContainerStyle={[styles.comparisons,
      { minWidth: narrow ? undefined : mode === 'compare' ? 1184 : undefined, justifyContent: narrow ? 'flex-start' : 'center', paddingHorizontal: narrow ? 0 : 24 }]}>
      {visible.map((entry) => <View key={entry.id} style={{ width: narrow ? Math.min(dimensions.width, 360) : 360, alignSelf: 'center' }}>
        <View style={styles.approachHeading}><Text style={styles.approachTitle}>{entry.name}</Text><Text style={styles.approachSummary}>{entry.summary}</Text></View>
        <ReviewThemeProvider colors={canvasColors(model, entry.id)} fontScale={model.fontScale} reducedMotion={model.reducedMotion}>
          <ReviewPhone approach={entry.id} model={model} update={update} narrow={narrow} />
        </ReviewThemeProvider>
        <Text style={styles.canvasCaption}>360 × 800 dp · {model.brightness} · {Math.round(model.fontScale * 100)}% text</Text>
      </View>)}
    </ScrollView></ScrollView>
  </View>;
}

function ReviewSelect({ label, value, choices, onChange }: { label: string; value: string; choices: readonly { id: string; name: string }[]; onChange: (value: string) => void }) {
  return <View style={styles.selectControl}><Text style={styles.controlLabel}>{label}</Text>
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} style={{ minHeight: 36, padding: '6px 28px 6px 8px',
      border: '1px solid #CAD2DD', borderRadius: 4, fontSize: 14, color: '#18212F', background: '#FFFFFF', maxWidth: 180 }}>
      {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
    </select>
  </View>;
}
function ReviewTool({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return <ReviewThemeProvider colors={reviewPalette('classic', 'light')}><IconButton icon={icon} label={label} onPress={onPress} /></ReviewThemeProvider>;
}
function PreviewText({ children, size = 16, muted = false, weight, align }: { children: ReactNode; size?: number; muted?: boolean; weight?: '500' | '600' | '700'; align?: 'center' }) {
  const colors = useTheme(), scale = useReviewFontScale();
  return <Text style={{ color: muted ? colors.muted : colors.ink, fontSize: size * scale, lineHeight: size * scale * 1.4,
    fontWeight: weight, textAlign: align, flexShrink: 1 }}>{children}</Text>;
}
function ReviewPhone({ approach, model, update, narrow }: { approach: Approach; model: ReviewModel; update: Update; narrow: boolean }) {
  const scroll = useRef<ScrollView>(null), positions = useRef<Record<string, number>>({}), restored = useRef('');
  const destinationKey = viewKey(model.screen, model.listId);
  const colors = useTheme(), root = ['agenda', 'lists', 'repeats'].includes(model.screen), item = selectedItem(model);
  const identity = itemAppearance(item, model), single = ['detail', 'alarm'].includes(model.screen);
  const artPalette = single ? identity.palette : ambientPalette(model), art = approach !== 'layered' && artPalette === 'meadow' ? botanical : landscape;
  const artOpacity = model.fontScale >= 1.5 ? 0 : model.brightness === 'dark' ? 0.025 : approach === 'immersive' ? 0.12 : approach === 'hybrid' ? 0.1 : 0.06;
  const title = model.screen === 'agenda' ? model.listId ? model.lists.find((list) => list.id === model.listId)?.name ?? 'No list' : 'Remilo'
    : model.screen === 'detail' ? 'Reminder' : screens.find((entry) => entry.id === model.screen)?.name ?? 'Remilo';
  const back = () => {
    if ((model.screen === 'create' || model.screen === 'edit') && model.dirty) { update({ overlay: 'discard' }); return; }
    update({ screen: model.listId ? model.origin : root ? 'agenda' : model.screen === 'appearance' ? 'settings' : model.origin, listId: null, overlay: null, error: '' });
  };
  return <View nativeID={'review-canvas-' + approach} style={[styles.phone, { backgroundColor: colors.background, borderRadius: narrow ? 0 : 20, borderColor: colors.border }]}>
    <View aria-hidden={model.overlay ? true : undefined} accessibilityElementsHidden={!!model.overlay} importantForAccessibility={model.overlay ? 'no-hide-descendants' : 'auto'} style={{ flex: 1 }}>
    <Image accessible={false} source={art} resizeMode="contain" style={[styles.artwork, { opacity: artOpacity }]} />
    <View style={styles.statusBar}><PreviewText size={12} weight="600">{reviewTime(model)}</PreviewText><View style={{ flexDirection: 'row', gap: 5 }}>
      <View style={{ width: 12, height: 8, borderColor: colors.ink, borderWidth: 2, borderRadius: 2 }} /><View style={{ width: 6, height: 10, backgroundColor: colors.ink, borderRadius: 1 }} /></View></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingLeft: root && !model.listId ? 16 : 4, paddingRight: 4 }}>
      {(!root || !!model.listId) && <IconButton icon="arrow_back" label="Back" onPress={back} />}
      <View style={{ flex: 1 }}><PreviewText size={model.screen === 'agenda' ? 24 : 20} weight="700">{title === 'Create' ? 'Add Reminder' : title === 'Edit' ? 'Edit Reminder' : title}</PreviewText></View>
      {model.screen === 'agenda' && <IconButton icon="search" label="Search reminders" onPress={() => update({ overlay: 'filter' })} />}
      {(model.screen === 'create' || model.screen === 'edit') ? <Pressable accessibilityRole="button" accessibilityLabel="Save reminder draft"
        accessibilityState={{ disabled: !model.draft.title.trim() }} disabled={!model.draft.title.trim()} onPress={() => saveDraft(model, update)}
        style={{ minHeight: 48, minWidth: 64, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.accent, fontSize: 16 * model.fontScale, fontWeight: '600', opacity: model.draft.title.trim() ? 1 : 0.4 }}>Save</Text></Pressable>
        : model.screen === 'detail' ? <><IconButton icon="edit" label="Edit reminder" onPress={() => openScreen('edit', model, update)} />
          <IconButton icon="more_vert" label="Reminder actions" onPress={() => update({ overlay: 'actions', menuItemId: item.id })} /></>
          : <IconButton icon="more_vert" label="More destinations" onPress={() => update({ overlay: model.listId ? 'list-menu' : 'menu' })} />}
    </View>
    <ScrollView key={destinationKey} ref={scroll} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 112, gap: 16 }}
      onContentSizeChange={() => { if (restored.current !== destinationKey) { restored.current = destinationKey; scroll.current?.scrollTo({ y: positions.current[destinationKey] ?? 0, animated: false }); } }}
      onScroll={(event) => { positions.current[destinationKey] = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={32}>
      {!!model.message && <View accessibilityLiveRegion="polite" style={{ paddingHorizontal: 16, gap: 8 }}><Status label={model.message} tone="success" />
        {!!model.undo && <Button label="Undo" icon="undo" variant="secondary" onPress={() => {
          const captured = model.undo!, latest = model.items.find((entry) => entry.id === captured.itemId) ?? null;
          const valid = captured.action === 'done' ? reopenCompleted(latest, captured.revision, 'review-only-undo') : restoreDeleted(latest, captured.revision, 'review-only-undo');
          if (!valid) { update({ message: 'Reminder changed. This action can no longer be undone.', undo: null }); return; }
          updateOccurrence(captured.itemId, captured.action === 'done' ? 'reopen' : 'restore', model, update);
        }} />}</View>}
      {model.screen === 'agenda' || model.screen === 'completed' || model.screen === 'trash' ? <AgendaPreview approach={approach} model={model} update={update} />
        : model.screen === 'lists' ? <ListsPreview model={model} update={update} />
        : model.screen === 'create' || model.screen === 'edit' ? <EditorPreview model={model} update={update} />
        : model.screen === 'detail' ? <DetailPreview approach={approach} model={model} update={update} />
        : model.screen === 'repeats' ? <RepeatsPreview model={model} update={update} />
        : model.screen === 'settings' ? <SettingsPreview model={model} update={update} />
        : model.screen === 'appearance' ? <AppearancePreview model={model} update={update} />
        : model.screen === 'alarm' ? <AlarmPreview approach={approach} model={model} update={update} />
        : model.screen === 'notification' ? <NotificationPreview model={model} update={update} />
        : <BrandingPreview model={model} update={update} />}
    </ScrollView>
    {(root && !model.listId || model.screen === 'agenda' && !!model.listId) && <View style={{ minHeight: 80 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Add reminder" onPress={() => openScreen('create', model, update)}
        style={({ pressed }) => ({ position: 'absolute', right: 20, bottom: 12, minWidth: 56, minHeight: 56, borderRadius: 28,
          backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}><Icon name="add" color={colors.accentInk} size={28} /></Pressable>
    </View>}
    {root && !model.listId && <BottomNavigation model={model} update={update} />}
    {model.screen === 'detail' && <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      {item.deliveryState === 'Alerting' && <View style={{ gap: 8 }}><Copy muted size={14}>Alarm ringing</Copy><DeliveryButtons item={item} model={model} update={update} /></View>}
      <Button label={item.deleted ? 'Restore reminder' : item.completed ? 'Reopen reminder' : 'Done'} icon={item.deleted ? 'restore' : item.completed ? 'undo' : 'check'}
        onPress={() => updateOccurrence(item.id, item.deleted ? 'restore' : item.completed ? 'reopen' : 'done', model, update)} />
    </View>}
    </View>
    {model.overlay && <ReviewSheet approach={approach} model={model} update={update} />}
  </View>;
}

function BottomNavigation({ model, update }: { model: ReviewModel; update: Update }) {
  const colors = useTheme();
  return <View accessibilityRole="tablist" style={{ minHeight: 76, flexDirection: 'row', paddingTop: 6, paddingBottom: 8, borderTopWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface }}>{([{ screen: 'agenda', icon: 'event', name: 'Agenda' },
      { screen: 'lists', icon: 'checklist', name: 'Lists' }, { screen: 'repeats', icon: 'repeat', name: 'Repeats' }] as const).map((tab) =>
    <Pressable key={tab.screen} accessibilityRole="tab" accessibilityLabel={tab.name} accessibilityState={{ selected: model.screen === tab.screen }}
      onPress={() => update({ screen: tab.screen, overlay: null, message: '', listId: null })} style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <View style={{ minWidth: 56, alignItems: 'center', paddingVertical: 4, borderRadius: 8, backgroundColor: model.screen === tab.screen ? colors.soft : 'transparent' }}>
        <Icon name={tab.icon} color={model.screen === tab.screen ? colors.accent : colors.muted} /></View>
      <Text style={{ color: model.screen === tab.screen ? colors.accent : colors.muted, fontSize: 12 * model.fontScale, fontWeight: '600' }}>{tab.name}</Text>
    </Pressable>)}</View>;
}
function AgendaPreview({ approach, model, update }: { approach: Approach; model: ReviewModel; update: Update }) {
  const colors = useTheme();
  const all = model.items.filter((item) => model.screen === 'completed' ? !item.deleted && (item.completed || model.includeSkipped && item.skipped) : model.screen === 'trash' ? item.deleted : !item.completed && !item.skipped && !item.deleted);
  const rank = (item: Occurrence) => item.overdue ? 0 : civilAt(item.eventStartMs, reviewZone).slice(0, 10) < '2026-10-06' ? 1 : 2;
  const recordedAt = (item: Occurrence) => {
    const kind = model.screen === 'trash' ? 'Delete' : item.skipped ? 'Skip' : 'Done';
    const times = item.history?.filter((entry) => entry.kind === kind).map((entry) => entry.atMs) ?? [];
    return times.length ? Math.max(...times) : item.collectionAtMs ?? item.eventStartMs;
  };
  const items = all.filter((item) => (!model.listId || (model.listId === 'no-list' ? !item.listId : item.listId === model.listId)) && (!model.query || (item.title + ' ' + item.notes).toLocaleLowerCase().includes(model.query.toLocaleLowerCase())) &&
    (model.filter === 'all' || model.filter === 'overdue' ? model.filter === 'all' || item.overdue : ['Blocked', 'Failed', 'Missed', 'TimedOut', 'Interrupted'].includes(item.deliveryState)))
    .sort((a, b) => model.screen === 'completed' || model.screen === 'trash' ? recordedAt(b) - recordedAt(a) || b.eventStartMs - a.eventStartMs || a.id.localeCompare(b.id)
      : rank(a) - rank(b) || a.eventStartMs - b.eventStartMs || a.id.localeCompare(b.id));
  const grouped = useMemo(() => {
    const groups = new Map<string, Occurrence[]>();
    items.forEach((item) => {
      const date = civilAt(item.eventStartMs, reviewZone).slice(0, 10);
      const key = model.screen === 'completed' || model.screen === 'trash' ? 'Recent' : item.overdue ? 'Overdue' : date < '2026-10-06' ? 'Earlier' : date === '2026-10-06' ? 'Today' : date === '2026-10-07' ? 'Tomorrow' : date;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });
    return [...groups];
  }, [items, model.screen]);
  return <>
    <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1 }}><PreviewText size={14} muted>{model.query ? 'Search: ' + model.query : model.filter === 'all' ? 'Tuesday, October 6' : model.filter === 'overdue' ? 'Overdue' : 'Alert problems'}</PreviewText></View>
      <IconButton icon="filter_list" label="Filter reminders" onPress={() => update({ overlay: 'filter' })} />
    </View>
    {model.screen === 'completed' && <View style={{ paddingHorizontal: 16 }}><SettingRow label="Include skipped"><Switch accessibilityLabel="Include skipped occurrences" value={model.includeSkipped} onValueChange={(includeSkipped) => update({ includeSkipped })} /></SettingRow></View>}
    {model.scenario === 'loading' ? <View style={{ padding: 16 }}><QueryState loading error={null} empty={false} onRetry={() => {}} />{[0, 1, 2, 3].map((key) => <View key={key}
      style={{ height: 88, backgroundColor: colors.soft, borderRadius: 8, marginTop: 8, padding: 16 }}><View style={{ height: 14, width: '64%', backgroundColor: colors.border, borderRadius: 4 }} />
      <View style={{ height: 12, width: '40%', backgroundColor: colors.border, borderRadius: 4, marginTop: 12 }} /></View>)}</View>
      : <>
        {model.scenario === 'error' && <View style={{ paddingHorizontal: 16, gap: 8 }}><Status label="Could not refresh. Showing the last known reminders." tone="warning" />
          <Button label="Retry" icon="refresh" variant="secondary" onPress={() => update({ scenario: 'populated', message: 'Reminders refreshed.' })} /></View>}
        {!items.length && <View style={{ padding: 24, alignItems: 'center', gap: 12 }}><Icon name={model.screen === 'trash' ? 'delete' : 'event'} size={40} />
          <PreviewText size={18} weight="600">{model.query || model.filter !== 'all' ? 'No matching reminders' : model.screen === 'completed' ? 'No completed reminders' : model.screen === 'trash' ? 'Trash is empty' : 'A little room in your day'}</PreviewText>
          <PreviewText size={14} muted align="center">{model.query || model.filter !== 'all' ? 'Try another search or filter.' : 'Your reminders will appear here.'}</PreviewText>
          {(model.query || model.filter !== 'all') && <Button label="Clear filters" variant="secondary" onPress={() => update({ query: '', filter: 'all' })} />}
          {model.screen === 'agenda' && <Button label="Add reminder" icon="add" onPress={() => openScreen('create', model, update)} />}</View>}
        {grouped.map(([group, entries]) => <View key={group} style={{ gap: 8 }}><View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}><PreviewText size={14} weight="600">{group}</PreviewText></View><PreviewText size={14} muted>{entries.length}</PreviewText></View>
          {entries.map((item) => <ReviewReminder key={item.id} item={item} approach={approach} model={model} update={update} />)}</View>)}
      </>}
  </>;
}
function ReviewReminder({ item, approach, model, update }: { item: Occurrence; approach: Approach; model: ReviewModel; update: Update }) {
  const appearance = itemAppearance(item, model), itemColors = reviewPalette(appearance.palette, model.brightness), ambient = reviewPalette(ambientPalette(model), model.brightness);
  const colors = approach === 'immersive' ? { ...itemColors, surface: itemColors.soft } : { ...ambient, accent: itemColors.accent, accentInk: itemColors.accentInk };
  return <View style={{ marginHorizontal: 12, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: ambient.border }}>
    <ReviewThemeProvider colors={colors} fontScale={model.fontScale}>
      <View style={{ borderLeftWidth: 3, borderLeftColor: itemColors.accent }}>
        <ReminderRow item={item} reviewCompact reviewGlyph={appearance.glyph} reviewNow={reviewNowMs} onOpen={() => update({ selectedId: item.id, screen: 'detail', origin: model.screen, message: '' })}
          onDone={() => updateOccurrence(item.id, item.deleted ? 'restore' : item.completed || item.skipped ? 'reopen' : 'done', model, update)}
          onMore={() => update({ menuItemId: item.id, overlay: 'actions' })} restore={item.deleted} />
      </View>
    </ReviewThemeProvider>
  </View>;
}
function ListsPreview({ model, update }: { model: ReviewModel; update: Update }) {
  const colors = useTheme();
  return <View style={{ paddingHorizontal: 16, gap: 16 }}>
    <SettingRow label="No list" icon="folder" value={String(model.items.filter((item) => !item.listId && !item.completed && !item.deleted).length)}
      onPress={() => update({ screen: 'agenda', origin: 'lists', listId: 'no-list', message: '' })} />
    {model.lists.map((list) => <View key={list.id} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: colors.border }}>
      <View style={{ flex: 1 }}><SettingRow label={list.name} icon="checklist"
        description={model.items.some((item) => item.listId === list.id && item.overdue) ? model.items.filter((item) => item.listId === list.id && item.overdue).length + ' overdue' : undefined}
        onPress={() => update({ screen: 'agenda', origin: 'lists', listId: list.id, message: '' })} /></View>
      <IconButton icon="more_vert" label={'Manage ' + list.name} onPress={() => update({ overlay: 'list-menu', listId: list.id })} /></View>)}
    <Button label="Create list" icon="add" variant="secondary" onPress={() => update({ overlay: 'create-list', listName: '', error: '' })} />
  </View>;
}
function EditorPreview({ model, update }: { model: ReviewModel; update: Update }) {
  const draft = model.draft;
  const preview = useQuery({ queryKey: ['design-review-schedule', draft, model.repeat], queryFn: () => engine().previewSchedule({ ...draft, recurrence: model.repeat }) });
  const patch = (change: Partial<Occurrence>) => update({ draft: { ...draft, ...change }, dirty: true, error: '' });
  return <View style={{ paddingHorizontal: 16, gap: 12 }}>
    <Field label="Title" placeholder="What do you want to remember?" value={draft.title} onChangeText={(title) => patch({ title })} maxLength={200} />
    <View><SettingRow label="When" icon="event" value={draft.allDay ? calendarDate(preview.data?.eventStartMs ?? draft.eventStartMs, draft.zoneId, reviewNowMs) + ' · All day' : scheduleDateTime(draft.eventStartMs, draft.zoneId, reviewNowMs)} onPress={() => update({ overlay: 'date', dateTarget: 'eventStartMs' })} />
      <RepeatForm value={model.repeat} onChange={(repeat) => update({ repeat, dirty: true })} startMs={draft.eventStartMs} zoneId={draft.zoneId} />
      <SettingRow label="Alert" icon={draft.mode === 'Notification' ? 'notifications' : draft.mode === 'None' ? 'alarm_off' : 'alarm'}
        value={draft.mode === 'None' ? 'No alert' : draft.mode} onPress={() => update({ overlay: 'alert' })} />
      <SettingRow label="List" icon="folder" value={draft.listId ? model.lists.find((list) => list.id === draft.listId)?.name ?? 'Unavailable list' : 'No list'} onPress={() => update({ overlay: 'list' })} />
      <SettingRow label="Notes" icon="notes" description={!model.notesOpen ? draft.notes || undefined : undefined} onPress={() => update({ notesOpen: !model.notesOpen })} />
      {model.notesOpen && <Field label="Notes (optional)" value={draft.notes} multiline onChangeText={(notes) => patch({ notes })} />}
    </View>
    <Disclosure title="Schedule options">
      <SettingRow label="All day"><Switch accessibilityLabel="All day" value={draft.allDay} onValueChange={(allDay) => patch({ allDay, dueLinked: true, alarmLinked: true })} /></SettingRow>
      {!draft.allDay && <SettingRow label="Ends" icon="schedule" value={scheduleDateTime(draft.eventEndMs, draft.zoneId, reviewNowMs)} onPress={() => update({ overlay: 'date', dateTarget: 'eventEndMs' })} />}
      <SettingRow label="Due follows When"><Switch accessibilityLabel="Due follows When" value={draft.dueLinked} onValueChange={(dueLinked) => patch(reviewDueLink(draft, preview.data, dueLinked))} /></SettingRow>
      {!draft.dueLinked && <SettingRow label="Due" icon="schedule" value={scheduleDateTime(draft.dueAtMs, draft.zoneId, reviewNowMs)} onPress={() => update({ overlay: 'date', dateTarget: 'dueAtMs' })} />}
      {draft.mode !== 'None' && <SettingRow label={draft.allDay ? 'Alert at 9 AM' : 'Alert follows Due'}><Switch accessibilityLabel={draft.allDay ? 'Alert at 9 AM' : 'Alert follows Due'} value={draft.alarmLinked} onValueChange={(alarmLinked) =>
        patch(reviewAlertLink(draft, preview.data, alarmLinked))} /></SettingRow>}
      {!draft.alarmLinked && draft.mode !== 'None' && <SettingRow label="Alert time" icon="alarm" value={scheduleDateTime(draft.alarmAtMs, draft.zoneId, reviewNowMs)} onPress={() => update({ overlay: 'date', dateTarget: 'alarmAtMs' })} />}
      <TimeZoneField value={draft.zoneId} atMs={draft.eventStartMs} onChange={(zoneId) => {
        void changeDraftZone(draft, zoneId, (input) => engine().convertTime(input)).then((result) => patch({ ...result.draft })).catch(() => update({ error: 'Could not resolve the selected zone.' }));
      }} />
    </Disclosure>
    {draft.mode === 'Alarm' && <Disclosure title="Alarm options"><Choice label="Remilo tone" selected={draft.sound === 'remilo'} onPress={() => patch({ sound: 'remilo' })} />
      <Choice label="System alarm tone" selected={draft.sound === 'system'} onPress={() => patch({ sound: 'system' })} />
      <SettingRow label="Vibration"><Switch accessibilityLabel="Vibration" value={draft.vibration} onValueChange={(vibration) => patch({ vibration })} /></SettingRow></Disclosure>}
    <SettingRow label="Appearance" icon="palette" value="Auto" onPress={() => update({ overlay: 'appearance', menuItemId: draft.id })} />
    {!!model.repeat && <View style={{ gap: 8 }}><PreviewText size={14} weight="600">Next dates</PreviewText>{preview.data?.upcoming.map((slot) => <PreviewText key={slot.nominalSlot} size={14} muted>{scheduleDateTime(slot.eventStartMs, slot.zoneId, reviewNowMs)}</PreviewText>)}</View>}
    {!!model.error && <Status label={model.error} tone="danger" />}
  </View>;
}
function DetailPreview({ approach, model, update }: { approach: Approach; model: ReviewModel; update: Update }) {
  const item = selectedItem(model), appearance = itemAppearance(item, model), palette = reviewPalette(appearance.palette, model.brightness);
  const rich = approach === 'hybrid' || approach === 'immersive';
  return <View style={{ paddingHorizontal: 16, gap: 20 }}>
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View style={{ height: model.fontScale >= 1.5 ? 48 : 144, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        {rich && model.fontScale < 1.5 && <Image accessible={false} source={appearance.palette === 'meadow' ? botanical : landscape} resizeMode="contain"
          style={{ position: 'absolute', width: '100%', height: 144, opacity: approach === 'immersive' ? 0.85 : 0.72 }} />}
        <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
          backgroundColor: rich ? palette.soft : 'transparent', borderRadius: 24 }}><Icon name={appearance.glyph} color={palette.accent} size={32} /></View>
      </View>
      <PreviewText size={22} weight="700" align="center">{item.title}</PreviewText>
    </View>
    <PreviewText size={18} weight="600">{eventRange(item, reviewNowMs)}</PreviewText>
    {(!ordinaryDue(item) || item.overdue) && <Status label={item.overdue ? 'Overdue · still unfinished' : 'Due ' + scheduleDateTime(item.dueAtMs, item.zoneId, reviewNowMs)} tone={item.overdue ? 'danger' : 'muted'} />}
    <View style={{ gap: 8 }}><Status label={stateLabel(item) || alertPresentation(item, false, reviewNowMs).label} tone={stateTone(item)} icon={stateIcon(item)} />
      {!!deliveryExplanation(item) && <Copy muted size={14}>{deliveryExplanation(item)}</Copy>}
      {!!repeatSummary(item) && <Copy muted size={14}>{repeatSummary(item)}</Copy>}
      <ScheduleDetails item={item} />
    </View>
    {canAdjustAlert(item) && item.deliveryState !== 'Alerting' && <Button label="Postpone alert" icon="snooze" variant="secondary" onPress={() => update({ overlay: 'postpone' })} />}
    {!!item.notes && <Disclosure title="Notes" initial><Copy>{item.notes}</Copy></Disclosure>}
    <SettingRow label="List" icon="folder" value={item.listName || 'No list'} onPress={() => update({ listId: item.listId ?? 'no-list', screen: 'agenda', origin: 'detail' })} />
    <SettingRow label="Appearance" icon="palette" value={reviewPalettes.find((entry) => entry.id === appearance.palette)?.name ?? 'Classic'} onPress={() => update({ overlay: 'appearance', menuItemId: item.id })} />
  </View>;
}
function RepeatsPreview({ model, update }: { model: ReviewModel; update: Update }) {
  const colors = useTheme();
  const repeats = reviewRepeatFamilies().filter((family) => (model.familyStates[family.seriesId] ?? family.state) === model.repeatState);
  return <View style={{ paddingHorizontal: 16, gap: 16 }}>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{(['Active', 'Paused', 'Ended'] as const).map((state) => <Pressable key={state}
      accessibilityRole="tab" accessibilityState={{ selected: model.repeatState === state }} onPress={() => update({ repeatState: state })}
      style={{ minHeight: 48, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3,
        borderColor: model.repeatState === state ? colors.accent : 'transparent' }}><PreviewText size={14} weight="600">{state}</PreviewText></Pressable>)}</View>
    {!repeats.length && <View style={{ padding: 16, gap: 8 }}><PreviewText weight="600">No {model.repeatState.toLowerCase()} repeats</PreviewText>
      <PreviewText size={14} muted>Unfinished earlier occurrences remain in Agenda.</PreviewText></View>}
    {repeats.map((family) => <View key={family.seriesId} style={{ borderBottomWidth: 1, borderColor: colors.border }}><SettingRow label={family.current.template.title} icon="repeat"
      description={repeatLabel(family.current.rule) + ' · ' + (family.upcoming[0] ? (model.repeatState === 'Paused' ? 'Planned ' : 'Next ') + scheduleDateTime(family.upcoming[0].eventStartMs, family.current.template.zoneId, reviewNowMs) : 'No future dates') +
        (family.unfinishedCount ? ' · ' + family.unfinishedCount + ' unfinished' : '')}
      onPress={() => {
        const occurrence = model.items.find((entry) => entry.title === family.current.template.title) ?? { ...initialDraft(), ...family.current.template, id: family.seriesId,
          segmentId: family.current.id, nominalSlot: family.current.rule.anchor, repeatRule: family.current.rule, repeatSummary: repeatLabel(family.current.rule), seriesState: family.current.state };
        update({ screen: 'detail', selectedId: occurrence.id, origin: 'repeats', message: '', items: model.items.some((entry) => entry.id === occurrence.id) ? model.items : [...model.items, occurrence] });
      }} />
      {model.repeatState !== 'Ended' && <SettingRow label={model.repeatState === 'Paused' ? 'Resume repeat' : 'Pause repeat'} icon={model.repeatState === 'Paused' ? 'play_arrow' : 'pause'} onPress={() => {
        update({ familyStates: { ...model.familyStates, [family.seriesId]: model.repeatState === 'Paused' ? 'Active' : 'Paused' },
          message: model.repeatState === 'Paused' ? 'Repeat resumed in this fixture.' : 'Repeat paused in this fixture.' });
      }} />}</View>)}
  </View>;
}
function SettingsPreview({ model, update }: { model: ReviewModel; update: Update }) {
  return <View style={{ paddingHorizontal: 16, gap: 12 }}>
    <SettingRow label="Appearance" description={reviewPalettes.find((entry) => entry.id === ambientPalette(model))?.name + ' · ' + (model.brightness === 'dark' ? 'Dark' : 'Light')}
      icon="palette" onPress={() => update({ screen: 'appearance', origin: 'settings' })} />
    <Disclosure title="Alarms" initial><SettingRow label="Quick Snooze" icon="snooze" value="10 min" />
      <SettingRow label="Default tone" icon="volume_up" value="Remilo" /><SettingRow label="Vibration" icon="vibration"><Switch accessibilityLabel="Default vibration" value={model.draft.vibration}
        onValueChange={(vibration) => update({ draft: { ...model.draft, vibration } })} /></SettingRow></Disclosure>
    <SettingRow label="Permissions" icon="lock" description="Review exact alarms and notifications" />
    <SettingRow label="Postpone shortcuts" icon="schedule" value="10 AM / 2 PM / 5 PM" />
    <Disclosure title="Data"><SettingRow label="Export backup" icon="upload" /><SettingRow label="Restore backup" icon="download" /></Disclosure>
    <SettingRow label="Help" icon="info" />
  </View>;
}
function AppearancePreview({ model, update }: { model: ReviewModel; update: Update }) {
  const colors = useTheme();
  return <View style={{ paddingHorizontal: 16, gap: 20 }}>
    <View style={{ gap: 8 }}><PreviewText weight="600">Brightness</PreviewText><View style={{ flexDirection: model.fontScale > 1.25 ? 'column' : 'row', flexWrap: 'wrap' }}>
      {(['system', 'light', 'dark'] as const).map((brightness) => <View key={brightness} style={{ flex: model.fontScale > 1.25 ? undefined : 1, minWidth: 96 }}><Choice label={brightness === 'system' ? 'System' : brightness === 'light' ? 'Light' : 'Dark'} selected={model.brightnessMode === brightness}
        onPress={() => update({ brightnessMode: brightness, ...(brightness === 'system' ? {} : { brightness }) })} /></View>)}</View></View>
    <View style={{ gap: 8 }}><PreviewText weight="600">Color</PreviewText><Choice label="Fixed theme" selected={model.colorMode === 'fixed'} onPress={() => update({ colorMode: 'fixed' })} />
      <Choice label="By time of day" selected={model.colorMode === 'time'} onPress={() => update({ colorMode: 'time' })} />
      <PaletteSwatches model={model} onSelect={(palette) => { if (palette !== 'auto') update({ palette, colorMode: 'fixed' }); }} selected={model.colorMode === 'fixed' ? model.palette : undefined} />
      {model.colorMode === 'time' && reviewPeriods.map((period) => <View key={period.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: reviewPalette(period.palette, model.brightness).accent }} /><View style={{ flex: 1 }}><PreviewText size={14}>{period.name}</PreviewText></View>
        <PreviewText size={14} muted>{period.range}</PreviewText></View>)}
    </View>
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, gap: 8 }}>
      <PreviewText size={14} weight="600">Preview</PreviewText><PreviewText size={16}>Water plants</PreviewText><PreviewText size={14} muted>Today, 9:30 AM · Alarm</PreviewText>
      <View style={{ width: 100, height: 4, backgroundColor: colors.accent, borderRadius: 2 }} /></View>
    <SettingRow label="Smart reminder colors"><Switch accessibilityLabel="Smart reminder colors" value={model.smartColors} onValueChange={(smartColors) => update({ smartColors })} /></SettingRow>
    <View style={{ gap: 8 }}><PreviewText weight="600">App Icon</PreviewText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Image accessibilityLabel="Current launcher icon choice" source={iconAssets[model.matchIcon ? ambientPalette(model) : model.iconPalette]} style={{ width: 48, height: 48 }} />
        <PreviewText size={14}>{model.matchIcon ? 'Matches app theme' : reviewPalettes.find((entry) => entry.id === model.iconPalette)?.name}</PreviewText></View>
      <SettingRow label="Match app theme"><Switch accessibilityLabel="Match launcher icon to app theme" value={model.matchIcon} onValueChange={(matchIcon) => update({ matchIcon })} /></SettingRow>
      {!model.matchIcon && <PaletteSwatches model={model} selected={model.iconPalette} onSelect={(iconPalette) => { if (iconPalette !== 'auto') update({ iconPalette }); }} />}
      {model.matchIcon && <SettingRow label="Update while app is closed"><Switch accessibilityLabel="Allow background icon matching" value={model.backgroundIcon} onValueChange={(backgroundIcon) => update({ backgroundIcon })} /></SettingRow>}
      <PreviewText size={14} muted>Android and your launcher may delay visible icon changes.</PreviewText>
    </View>
  </View>;
}
function PaletteSwatches({ model, onSelect, selected, includeAuto = false }: { model: ReviewModel; onSelect: (value: ReviewPaletteId | 'auto') => void; selected?: ReviewPaletteId | 'auto'; includeAuto?: boolean }) {
  const colors = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{includeAuto && <Pressable accessibilityRole="radio" accessibilityLabel="Automatic appearance"
    accessibilityState={{ checked: selected === 'auto' }} onPress={() => onSelect('auto')} style={{ width: model.fontScale >= 1.5 ? '48%' : 72, minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name={selected === 'auto' ? 'check' : 'palette'} size={20} /></View>
    <PreviewText size={12}>Auto</PreviewText></Pressable>}
    {reviewPalettes.map((palette) => <Pressable key={palette.id} accessibilityRole="radio" accessibilityLabel={palette.name}
      accessibilityState={{ checked: selected === palette.id }} onPress={() => onSelect(palette.id)}
      style={{ width: model.fontScale >= 1.5 ? '48%' : 72, minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: selected === palette.id ? colors.ink : colors.border,
        backgroundColor: reviewPalette(palette.id, model.brightness).accent, alignItems: 'center', justifyContent: 'center' }}>
        {selected === palette.id && <Icon name="check" size={20} color={reviewPalette(palette.id, model.brightness).accentInk} />}</View>
      <PreviewText size={12}>{palette.name}</PreviewText>
    </Pressable>)}
  </View>;
}
function AlarmPreview({ approach, model, update }: { approach: Approach; model: ReviewModel; update: Update }) {
  const source = model.items.filter((item) => !item.completed && !item.deleted && !item.skipped).slice(0, model.scenario === 'overdue' ? 3 : 1);
  const active = source.filter((item) => !model.alarmEnded.includes(item.id) && !model.alarmSnoozed.includes(item.id));
  return <View style={{ paddingHorizontal: 20, gap: 20 }}>
    {!active.length && <View style={{ minHeight: 340, alignItems: 'center', justifyContent: 'center', gap: 12 }}><Icon name="alarm_off" size={48} />
      <PreviewText size={22} weight="600">Ringing ended</PreviewText><PreviewText size={14} muted>Reminders remain unfinished.</PreviewText>
      <Button label="Reset alarm representation" variant="secondary" onPress={() => update({ items: scenarioItems(model.scenario), alarmEnded: [], alarmSnoozed: [], message: '' })} /></View>}
    {active.map((item) => {
      const appearance = itemAppearance(item, model), palette = reviewPalette(appearance.palette, model.brightness);
      return <ReviewThemeProvider key={item.id} colors={approach === 'layered' ? { ...reviewPalette(ambientPalette(model), model.brightness), accent: palette.accent, accentInk: palette.accentInk } : palette} fontScale={model.fontScale}>
        <View style={{ gap: 12, minHeight: active.length > 1 ? 248 : 500, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ minHeight: active.length > 1 ? 60 : 150, alignItems: 'center', justifyContent: 'center' }}><Icon name={appearance.glyph} color={palette.accent} size={active.length > 1 ? 48 : 84} /></View>
          <PreviewText size={22} weight="700" align="center">{item.title}</PreviewText>
          <PreviewText size={14} muted>Current ringing delivery</PreviewText><PreviewText size={28} weight="600">{new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: item.zoneId }).format(item.nextAlertMs ?? item.alarmAtMs)}</PreviewText>
          {(item.nextAlertMs ?? item.alarmAtMs) !== item.eventStartMs && <PreviewText size={14} muted>Event {scheduleDateTime(item.eventStartMs, item.zoneId, reviewNowMs)}</PreviewText>}
          <Status label="Alarm ringing" tone="accent" icon="alarm" />
          <View style={{ width: '100%', gap: 8 }}><DeliveryButtons item={item} model={model} update={update} /></View>
        </View>
      </ReviewThemeProvider>;
    })}
    {active.length > 1 && <Button label="Stop all ringing" icon="stop" variant="secondary" onPress={() => {
      const ids = active.map((item) => item.id);
      update({ alarmEnded: [...model.alarmEnded, ...ids], items: model.items.map((item) => ids.includes(item.id) ? { ...item, deliveryState: 'Stopped', nextAlertMs: null,
        generation: item.generation + 1, history: [...(item.history ?? []), { kind: 'StopAll', atMs: reviewNowMs, targetMs: null }] } : item),
        retainedTargets: { ...model.retainedTargets, ...Object.fromEntries(active.map((item) => [item.id, item.nextAlertMs ?? item.alarmAtMs])) },
        message: 'Ringing stopped. All reminders remain unfinished.' });
    }} />}
  </View>;
}
function DeliveryButtons({ item, model, update }: { item: Occurrence; model: ReviewModel; update: Update }) {
  return <View style={{ gap: 8 }}><Button label="Stop" icon="stop" onPress={() => deliveryAction('stop', item, model, update)} />
    <Button label="Snooze · 10 min" icon="snooze" variant="secondary" onPress={() => deliveryAction('snooze', item, model, update)} /></View>;
}
function deliveryAction(action: 'stop' | 'snooze', item: Occurrence, model: ReviewModel, update: Update) {
  const target = action === 'snooze' ? reviewNowMs + 600_000 : item.nextAlertMs ?? model.retainedTargets[item.id] ?? item.alarmAtMs;
  update({ alarmEnded: action === 'stop' ? [...model.alarmEnded, item.id] : model.alarmEnded,
    alarmSnoozed: action === 'snooze' ? [...model.alarmSnoozed, item.id] : model.alarmSnoozed,
    retainedTargets: { ...model.retainedTargets, [item.id]: target },
    items: model.items.map((entry) => entry.id === item.id ? { ...entry, nextAlertMs: action === 'stop' ? null : target,
      deliveryState: action === 'stop' ? 'Stopped' : 'Scheduled', ...(action === 'snooze' ? { alertAdjustment: 'Snoozed' as const } : {}),
      generation: entry.generation + 1, history: [...(entry.history ?? []), { kind: action === 'stop' ? 'Stop' : 'Snooze', atMs: reviewNowMs, targetMs: action === 'stop' ? null : target }] } : entry),
    message: action === 'stop' ? 'Alarm stopped. Still unfinished.' : 'Alert snoozed 10 minutes. Still unfinished.' });
}
function NotificationPreview({ model, update }: { model: ReviewModel; update: Update }) {
  const colors = useTheme(), item = selectedItem(model), appearance = itemAppearance(item, model), palette = reviewPalette(appearance.palette, model.brightness);
  const finished = model.alarmEnded.includes(item.id) || model.alarmSnoozed.includes(item.id);
  return <View style={{ paddingHorizontal: 16, paddingTop: 80, gap: 20 }}>
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Icon name="notifications" color={palette.accent} size={18} /><PreviewText size={12} muted>Remilo · now</PreviewText></View>
      <PreviewText size={16} weight="600">{item.title}</PreviewText><PreviewText size={14} muted>{finished ? 'Ringing ended · still unfinished' : "It's time."}</PreviewText>
      {!finished && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 100 }}><Button label="Snooze" variant="secondary" icon="snooze" onPress={() => deliveryAction('snooze', item, model, update)} /></View>
        <View style={{ flex: 1, minWidth: 100 }}><Button label="Stop" variant="secondary" icon="stop" onPress={() => deliveryAction('stop', item, model, update)} /></View>
      </View>}
    </View>
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 16, gap: 8 }}>
      <PreviewText size={12} muted>Remilo · locked presentation</PreviewText><PreviewText size={16} weight="600">Reminder alarm</PreviewText>
      <PreviewText size={14} muted>Open Remilo for reminder controls.</PreviewText>
    </View>
  </View>;
}
function BrandingPreview({ model, update }: { model: ReviewModel; update: Update }) {
  return <View style={{ paddingHorizontal: 16, gap: 24 }}>
    <View style={{ alignItems: 'center', gap: 16, paddingTop: 32 }}><Image source={iconAssets.classic} accessibilityLabel="Requested Classic Remilo icon" style={{ width: 180, height: 180 }} />
      <PreviewText size={24} weight="700">Remilo</PreviewText></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>{reviewPalettes.map((palette) => <Pressable key={palette.id}
      accessibilityRole="radio" accessibilityLabel={palette.name + ' icon'} accessibilityState={{ checked: model.iconPalette === palette.id }}
      onPress={() => update({ iconPalette: palette.id })} style={{ width: model.fontScale >= 1.5 ? 144 : 88, minHeight: 112, alignItems: 'center', gap: 8 }}>
      <Image accessible={false} source={iconAssets[palette.id]} style={{ width: 72, height: 72 }} /><PreviewText size={12}>{palette.name}</PreviewText>
    </Pressable>)}</View>
  </View>;
}

function ReviewSheet({ approach, model, update }: { approach: Approach; model: ReviewModel; update: Update }) {
  const colors = useTheme(), selected = model.overlay === 'actions' || model.overlay === 'appearance' || model.overlay === 'trash-confirm'
    ? model.menuItemId === model.draft.id && ['create', 'edit'].includes(model.screen) ? model.draft : model.items.find((item) => item.id === model.menuItemId) ?? selectedItem(model)
    : selectedItem(model);
  const title = ({ menu: 'Remilo', filter: 'Find reminders', 'list-menu': model.lists.find((list) => list.id === model.listId)?.name ?? 'List', date: 'When',
    alert: 'Alert', list: 'List', appearance: 'Reminder appearance', actions: 'Reminder actions', 'trash-confirm': 'Move to Trash?', postpone: 'Postpone alert', discard: 'Discard changes?',
    'create-list': 'Create list', 'rename-list': 'Rename list', 'remove-list': 'Remove list?' } as Record<Exclude<Overlay, null>, string>)[model.overlay!];
  const close = () => update({ overlay: null, error: '', ...(model.screen === 'lists' ? { listId: null } : {}) });
  return <div data-review-sheet={approach} role="dialog" aria-label={title + ' / ' + approaches.find((entry) => entry.id === approach)?.name} aria-modal="true" tabIndex={-1}
    style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 10 }}>
    <Pressable aria-hidden accessible={false} focusable={false} onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: '#00000066' }]} />
    <View accessibilityViewIsModal style={{ maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }}>
      <View style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 }}><View style={{ flex: 1 }}><PreviewText size={20} weight="600">{title}</PreviewText></View>
        <IconButton icon="close" label={'Close ' + title} onPress={close} /></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}>
        {model.overlay === 'menu' && <>{([{ screen: 'completed', icon: 'task_alt', name: 'Completed' }, { screen: 'trash', icon: 'delete', name: 'Trash' },
          { screen: 'settings', icon: 'settings', name: 'Settings' }] as const).map((destination) => <SettingRow key={destination.screen} label={destination.name} icon={destination.icon}
          onPress={() => update({ screen: destination.screen, origin: model.screen, overlay: null, message: '' })} />)}</>}
        {model.overlay === 'filter' && <><Field label="Search" placeholder="Search titles and notes" value={model.query} onChangeText={(query) => update({ query })} />
          <Choice label="All reminders" selected={model.filter === 'all'} onPress={() => update({ filter: 'all' })} /><Choice label="Overdue" selected={model.filter === 'overdue'} onPress={() => update({ filter: 'overdue' })} />
          <Choice label="Alert problems" selected={model.filter === 'problems'} onPress={() => update({ filter: 'problems' })} /><Button label="Apply" onPress={close} />
          <Button label="Clear filters" variant="secondary" onPress={() => update({ query: '', filter: 'all', overlay: null })} /></>}
        {model.overlay === 'list-menu' && <>
          {model.screen === 'lists' && <><SettingRow label="Rename list" icon="edit" onPress={() => update({ overlay: 'rename-list', listName: model.lists.find((list) => list.id === model.listId)?.name ?? '' })} />
            <SettingRow label="Remove list" icon="delete" onPress={() => update({ overlay: 'remove-list' })} /></>}
          <SettingRow label="Completed" icon="task_alt" onPress={() => update({ screen: 'completed', origin: 'lists', overlay: null })} />
          <SettingRow label="Trash" icon="delete" onPress={() => update({ screen: 'trash', origin: 'lists', overlay: null })} />
        </>}
        {(model.overlay === 'create-list' || model.overlay === 'rename-list') && <><Field label="List name" value={model.listName} maxLength={100} onChangeText={(listName) => update({ listName, error: '' })} />
          {!!model.error && <Status label={model.error} tone="danger" />}<Button label="Save" onPress={() => {
            const name = model.listName.trim(), duplicate = model.lists.some((list) => list.name.toLowerCase() === name.toLowerCase() && (model.overlay === 'create-list' || list.id !== model.listId));
            if (!name || duplicate) { update({ error: !name ? 'Enter a list name.' : 'A list with this name already exists.' }); return; }
            const id = model.overlay === 'create-list' ? 'review-list-' + model.lists.length : model.listId!;
            update({ lists: model.overlay === 'create-list' ? [...model.lists, { id, name }] : model.lists.map((list) => list.id === id ? { ...list, name } : list),
              items: model.items.map((item) => item.listId === id ? { ...item, listName: name } : item), overlay: null, listId: null, message: 'List saved in this fixture.' });
          }} /></>}
        {model.overlay === 'remove-list' && <><Copy>Reminders move to No list. Their event and alert times stay the same.</Copy><Button label="Remove list" variant="danger" icon="delete" onPress={() => update({
          lists: model.lists.filter((list) => list.id !== model.listId), items: model.items.map((item) => item.listId === model.listId ? { ...item, listId: null, listName: '' } : item),
          overlay: null, listId: null, message: 'List removed in this fixture.' })} /></>}
        {model.overlay === 'date' && <DraftDate model={model} update={update} />}
        {model.overlay === 'alert' && <>{(['Alarm', 'Notification', 'None'] as const).map((mode) => <Choice key={mode} label={mode === 'None' ? 'No alert' : mode}
          selected={model.draft.mode === mode} onPress={() => update({ draft: { ...model.draft, mode }, overlay: null, dirty: true })} />)}</>}
        {model.overlay === 'list' && <><Choice label="No list" selected={!model.draft.listId} onPress={() => update({ draft: { ...model.draft, listId: null, listName: '' }, overlay: null, dirty: true })} />
          {model.lists.map((list) => <Choice key={list.id} label={list.name} selected={model.draft.listId === list.id} onPress={() => update({ draft: { ...model.draft, listId: list.id, listName: list.name }, overlay: null, dirty: true })} />)}</>}
        {model.overlay === 'appearance' && <><PaletteSwatches model={model} includeAuto selected={model.manual[model.menuItemId ?? selected.id] ?? 'auto'} onSelect={(palette) =>
          update({ manual: { ...model.manual, [model.menuItemId ?? selected.id]: palette }, overlay: null, message: 'Appearance updated in this fixture.' })} />
          <Copy muted size={14}>{itemAppearance(selected, model).explanation}</Copy></>}
        {model.overlay === 'actions' && <><SettingRow label="Edit" icon="edit" onPress={() => {
          update({ screen: 'edit', draft: { ...selected }, repeat: selected.repeatRule ?? undefined, selectedId: selected.id, origin: model.screen, overlay: null, dirty: false, notesOpen: !!selected.notes });
        }} /><SettingRow label="Activity" icon="history" onPress={() => update({ message: selected.history?.length ? selected.history.map((entry) => entry.kind).join(' · ') : 'No recorded activity', overlay: null })} />
          <SettingRow label="Duplicate" icon="content_copy" onPress={() => update({ screen: 'create', draft: reviewDuplicate(selected), repeat: undefined,
            overlay: null, dirty: true, origin: model.screen, notesOpen: !!selected.notes })} />
          <SettingRow label={selected.deleted ? 'Restore' : 'Move to Trash'} icon={selected.deleted ? 'restore' : 'delete'} onPress={() => {
            if (!selected.deleted && !selected.completed && !selected.skipped) update({ overlay: 'trash-confirm' });
            else updateOccurrence(selected.id, selected.deleted ? 'restore' : 'trash', model, update);
          }} /></>}
        {model.overlay === 'trash-confirm' && <><Copy>Its alert will be cancelled. You can restore the reminder from Trash.</Copy>
          <Button label="Keep reminder" variant="secondary" onPress={close} /><Button label="Move to Trash" variant="danger" icon="delete" onPress={() => updateOccurrence(selected.id, 'trash', model, update)} /></>}
        {model.overlay === 'postpone' && <><Copy muted size={14}>Choose the next alert. Event and Due stay unchanged.</Copy>{[15, 30, 60].map((minutes) =>
          <SettingRow key={minutes} label={minutes + ' minutes'} icon="schedule" value={scheduleDateTime(reviewNowMs + minutes * 60_000, reviewZone, reviewNowMs)} onPress={() => update({
            items: model.items.map((item) => item.id === selected.id ? { ...item, nextAlertMs: reviewNowMs + minutes * 60_000, deliveryState: 'Scheduled', alertAdjustment: 'Postponed', generation: item.generation + 1, revision: item.revision + 1 } : item),
            overlay: null, message: 'Alert postponed. Event and Due stay unchanged.' })} />)}</>}
        {model.overlay === 'discard' && <><Copy>Your reminder has unsaved changes.</Copy><Button label="Keep editing" onPress={close} />
          <Button label="Discard changes" variant="danger" onPress={() => update({ screen: model.origin, overlay: null, dirty: false })} /></>}
      </ScrollView>
    </View>
  </div>;
}
function DraftDate({ model, update }: { model: ReviewModel; update: Update }) {
  const [local, setLocal] = useState(civilAt(model.draft[model.dateTarget], model.draft.zoneId).slice(0, 16));
  const [message, setMessage] = useState('');
  const colors = useTheme();
  return <View style={{ gap: 12 }}><PreviewText size={14} muted>{model.draft.zoneId.replaceAll('_', ' ')}</PreviewText>
    <input aria-label="Reminder date and time" type="datetime-local" value={local} onChange={(event) => setLocal(event.target.value)}
      style={{ minHeight: 48, width: '100%', border: '1px solid ' + colors.border, borderRadius: 4, background: colors.background,
        color: colors.ink, padding: 8, fontSize: 16 * model.fontScale, boxSizing: 'border-box' }} />
    {!!message && <Status label={message} tone="danger" />}<Button label="Apply time" onPress={() => {
      void engine().convertTime({ local: local.length === 16 ? local + ':00' : local, zoneId: model.draft.zoneId }).then(async (resolved) => {
        const draft = model.draft;
        const result = model.dateTarget === 'eventStartMs' ? await moveDraftEvent(draft, resolved.instantMs, (input) => engine().convertTime(input))
          : model.dateTarget === 'dueAtMs' ? await moveDraftDue(draft, resolved.instantMs, (input) => engine().convertTime(input))
            : { draft: { ...draft, [model.dateTarget]: resolved.instantMs }, warnings: [] };
        update({ draft: { ...draft, ...result.draft }, overlay: null, dirty: true });
      }).catch(() => setMessage('Choose a valid local date and time.'));
    }} /></View>;
}
async function saveDraft(model: ReviewModel, update: Update) {
  if (!model.draft.title.trim()) { update({ error: 'Enter a title.' }); return; }
  try {
    const resolved = await engine().previewSchedule({ ...model.draft, recurrence: model.repeat });
    if (resolved.eventEndMs <= resolved.eventStartMs) { update({ error: 'Choose an end after the event starts.' }); return; }
    const previous = model.screen === 'edit' ? model.items.find((item) => item.id === model.draft.id) : undefined;
    const changedDefinition = !previous || previous.alarmAtMs !== resolved.alarmAtMs || previous.mode !== model.draft.mode;
    if (changedDefinition && model.draft.mode !== 'None' && !model.draft.completed && resolved.alarmAtMs <= reviewNowMs) {
      update({ error: 'Choose an alert time in the future.' }); return;
    }
    const target = changedDefinition ? resolved.alarmAtMs : previous?.nextAlertMs;
    const state = previous && !changedDefinition ? previous.deliveryState : model.draft.completed ? 'Completed' : model.draft.skipped ? 'Skipped'
      : model.draft.mode === 'None' ? 'NoAlert' : resolved.alarmAtMs <= reviewNowMs ? 'Missed' : 'Scheduled';
    const draft = { ...model.draft, eventStartMs: resolved.eventStartMs, eventEndMs: resolved.eventEndMs, dueAtMs: resolved.dueAtMs,
      alarmAtMs: resolved.alarmAtMs, nextAlertMs: state === 'Scheduled' ? target ?? resolved.alarmAtMs : null, deliveryState: state,
      title: model.draft.title.trim(), repeatRule: model.repeat, repeatSummary: model.repeat ? repeatLabel(model.repeat) : null,
      id: model.screen === 'edit' ? model.draft.id : 'review-created-' + model.items.length, revision: model.draft.revision + 1,
      agendaGroup: civilAt(resolved.eventStartMs, model.draft.zoneId).slice(0, 10), overdue: !model.draft.completed && !model.draft.skipped && resolved.dueAtMs < reviewNowMs,
    };
    update({ items: model.screen === 'edit' ? model.items.map((item) => item.id === draft.id ? draft : item) : [...model.items, draft], screen: 'agenda',
      overlay: null, dirty: false, selectedId: draft.id, message: 'Reminder saved in this fixture.', error: '',
      manual: model.manual[model.draft.id] ? { ...model.manual, [draft.id]: model.manual[model.draft.id] } : model.manual });
  } catch { update({ error: 'Could not resolve this fixture. Review the date and repeat fields.' }); }
}
function updateOccurrence(id: string, action: 'done' | 'reopen' | 'trash' | 'restore', model: ReviewModel, update: Update) {
  const selected = model.items.find((item) => item.id === id);
  if (!selected) return;
  const { item, retainedTarget: target } = reviewContentAction(selected, action, reviewNowMs, model.retainedTargets[id]);
  update({ items: model.items.map((entry) => entry.id === id ? item : entry), retainedTargets: { ...model.retainedTargets, [id]: target },
    overlay: null, undo: action === 'done' || action === 'trash' ? { itemId: id, revision: item.revision, action } : null,
    message: action === 'done' ? 'Reminder completed.' : action === 'reopen' && item.skipped ? 'This occurrence remains skipped.'
      : action === 'reopen' ? 'Reminder reopened.' : action === 'trash' ? 'Moved to Trash in this fixture.' : 'Restored in this fixture.' });
}

const styles = StyleSheet.create({
  workspace: { flex: 1, backgroundColor: '#F3F5F8' },
  reviewHeader: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#D7DEE8', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  reviewTitle: { fontSize: 20, lineHeight: 28, fontWeight: '600', color: '#18212F' },
  reviewSubtitle: { fontSize: 12, lineHeight: 18, color: '#596475', marginTop: 4 },
  toolbar: { paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#D7DEE8' },
  selectControl: { gap: 4 }, controlLabel: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#596475' },
  scaleControl: { gap: 4, minHeight: 58 }, toggleControl: { gap: 4, minHeight: 58, alignItems: 'flex-start' },
  modeControl: { flexDirection: 'row', borderWidth: 1, borderColor: '#CAD2DD', borderRadius: 4, overflow: 'hidden' },
  modeButton: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center' }, modeSelected: { backgroundColor: '#245CD6' },
  modeLabel: { fontSize: 14, color: '#18212F', fontWeight: '500' }, modeLabelSelected: { color: '#FFFFFF' },
  approachTabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#D7DEE8' },
  approachTab: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  approachTabSelected: { borderBottomColor: '#245CD6' }, approachLabelSelected: { color: '#245CD6', fontWeight: '600' },
  evidenceBar: { minHeight: 44, paddingHorizontal: 24, paddingVertical: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  evidenceText: { fontSize: 12, lineHeight: 18, color: '#596475', flex: 1, minWidth: 200 },
  comparisons: { paddingTop: 8, paddingBottom: 24, gap: 28, alignItems: 'flex-start' },
  approachHeading: { gap: 4, marginBottom: 12, paddingHorizontal: 4 }, approachTitle: { fontSize: 16, fontWeight: '600', color: '#18212F' },
  approachSummary: { fontSize: 12, lineHeight: 18, color: '#596475' },
  phone: { height: 800, width: '100%', overflow: 'hidden', borderWidth: 1 },
  statusBar: { minHeight: 28, paddingTop: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  artwork: { position: 'absolute', bottom: 64, left: 0, right: 0, width: '100%', height: 220 },
  canvasCaption: { fontSize: 12, lineHeight: 18, color: '#596475', marginTop: 12, textAlign: 'center' },
});
