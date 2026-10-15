import { t, ownedMessage, currentLanguage, type SupportedLanguage } from '../localization';
import { displayClock, type TimeDisplayOptions } from './time-display';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from './actions';
import { repeatLabel } from './repeat';
import { civilAt, deviceZone } from './time';
export function repeatSummary(item: Pick<Occurrence, 'repeatRule' | 'repeatSummary'>) {
  return item.repeatRule ? repeatLabel(item.repeatRule) : item.repeatSummary ? ownedMessage(item.repeatSummary) : item.repeatSummary;
}
export function stateTone(item: Pick<Occurrence, 'deliveryState' | 'completed' | 'skipped'> & { mode?: Occurrence['mode'] }): Tone {
  if (item.completed) return 'success';
  if (item.skipped || item.mode === 'None') return 'muted';
  if (['Blocked', 'Failed'].includes(item.deliveryState)) return 'danger';
  if (['Missed', 'TimedOut', 'Interrupted'].includes(item.deliveryState)) return 'warning';
  return item.deliveryState === 'Alerting' ? 'accent' : 'muted';
}
export function nextAlertTime(item: Occurrence) {
  return !item.completed && !item.deleted && !item.skipped && item.mode !== 'None' && item.deliveryState === 'Scheduled'
    ? item.nextAlertMs : null;
}
export function stateLabel(item: Pick<Occurrence, 'deliveryState' | 'nextAlertMs' | 'alarmAtMs' | 'completed' | 'skipped' | 'alertAdjustment'> & { mode?: Occurrence['mode'] }) {
  if (item.completed) return t('m_22a970d2e5b1');
  if (item.skipped) return t('m_12698ce1ea5c');
  if (item.mode === 'None') return t('m_d1af410eb4d0');
  if (item.deliveryState === 'Scheduled') return (item.alertAdjustment ? ownedMessage(item.alertAdjustment) : undefined) ?? (item.nextAlertMs != null && item.nextAlertMs !== item.alarmAtMs ? t('m_0eb42cd9606b') : '');
  if (item.mode === 'Notification' && item.deliveryState === 'Missed') return t('m_e634611aa858');
  return ({ Alerting: t('m_426a858eacbb'), Stopped: t('m_f36a51f323bf'), Missed: t('m_5c12863b4f4d'), TimedOut: t('m_ba0c9f7afee3'),
    Interrupted: t('m_a48a8f6a3fa3'), Blocked: t('m_4bf68dddf882'), Failed: item.mode === 'Notification' ? t('m_8d3fa6513897') : t('m_c7102925c08a'), Paused: t('m_e159b06187d3'),
    Changing: t('m_379738c9c123'), SeriesChanging: t('m_176ac00b6f0e'), Pending: t('m_ed5c58303a98'), Notified: t('m_02e87bf90c4c'), NoAlert: t('m_d1af410eb4d0') } as Record<string, string>)[item.deliveryState] ?? '';
}

export type ScheduleItem = Pick<Occurrence, 'eventStartMs' | 'eventEndMs' | 'dueAtMs' | 'alarmAtMs'> &
  Partial<Pick<Occurrence, 'allDay' | 'dueLinked' | 'alarmLinked' | 'mode' | 'zoneId' | 'nextAlertMs' | 'deliveryState' |
  'alertAdjustment' | 'completed' | 'deleted' | 'skipped' | 'repeatRule' | 'exception' | 'overdue' | 'overdueAtMs'>>;
export function modeLabel(mode: ScheduleItem['mode'], language: SupportedLanguage = currentLanguage()) { return mode === 'Notification' ? t('m_7d31b8331399', undefined, language) : mode === 'None' ? t('m_d1af410eb4d0', undefined, language) : t('m_f3b679573579', undefined, language); }
export function ordinaryDue(item: ScheduleItem) {
  return item.dueLinked !== false && item.dueAtMs === (item.allDay ? item.eventEndMs : item.eventStartMs);
}
export function scheduleNeedsDetails(item: ScheduleItem, displayZone = deviceZone()) {
  return !ordinaryDue(item) || item.mode !== 'None' && item.alarmLinked === false ||
    item.mode !== 'None' && item.nextAlertMs != null && item.nextAlertMs !== item.alarmAtMs ||
    item.exception === true || item.repeatRule?.zoneMode === 'pinned' || !!item.zoneId && item.zoneId !== displayZone;
}
export function stateIcon(item: Pick<Occurrence, 'deliveryState' | 'completed' | 'deleted' | 'skipped'>) {
  if (item.deleted) return 'delete' as const;
  if (item.completed) return 'check_circle' as const;
  if (item.skipped) return 'cancel' as const;
  if (item.deliveryState === 'NoAlert') return 'alarm_off' as const;
  if (['Blocked', 'Failed'].includes(item.deliveryState)) return 'error' as const;
  if (['Missed', 'TimedOut', 'Interrupted'].includes(item.deliveryState)) return 'warning' as const;
  const icons = { Alerting: 'alarm', Stopped: 'stop', Notified: 'notifications', Paused: 'pause',
    Scheduled: 'schedule', Pending: 'schedule', Changing: 'schedule', SeriesChanging: 'repeat' } as const;
  return icons[item.deliveryState as keyof typeof icons] ?? 'info';
}

/** Intended targets are distinct from confirmed upcoming delivery. Terminal states have no future promise. */
export function alertPresentation(item: ScheduleItem, draft = false, now = Date.now(), options: TimeDisplayOptions = {}) {
  const zone = item.zoneId || deviceZone(), mode = modeLabel(item.mode, options.resolvedLanguage);
  const inactive = item.completed || item.deleted || item.skipped;
  const eligible = ['Scheduled', 'Pending', 'Changing', 'SeriesChanging', 'Blocked'].includes(item.deliveryState ?? 'Scheduled');
  const target = item.mode === 'None' ? null : draft || !item.deliveryState ? item.alarmAtMs : !inactive && eligible ? item.nextAlertMs ?? item.alarmAtMs : null;
  const changed = target != null && target !== item.alarmAtMs;
  const targetZone = changed && !draft ? deviceZone() : zone;
  const time = target == null ? '' : scheduleDateTime(target, targetZone, now, options);
  const state = item.deliveryState;
  const label = item.mode === 'None' ? t('m_d1af410eb4d0', undefined, options.resolvedLanguage) : inactive ? t('m_ae294290d499', { arg0: String(mode), arg1: String(scheduleDateTime(item.alarmAtMs, zone, now, options)) }, options.resolvedLanguage) :
    state === 'Blocked' ? t('m_aac19a9e45b5', { arg0: String(time) }, options.resolvedLanguage) : state === 'Pending' ? t('m_f4debfd9e50b', { arg0: String(time) }, options.resolvedLanguage) :
    state === 'Changing' || state === 'SeriesChanging' ? t('m_1d625ffc7eed', { arg0: String(time) }, options.resolvedLanguage) :
    state === 'Alerting' ? t('m_1ce1890d9f80', undefined, options.resolvedLanguage) : target != null ? changed ?
      item.alertAdjustment === 'Snoozed' ? t('m_d6a93f2fda82', { arg0: String(mode), arg1: String(time) }, options.resolvedLanguage) : item.alertAdjustment === 'Postponed' ? t('m_24aa76b87f0f', { arg0: String(mode), arg1: String(time) }, options.resolvedLanguage) : t('m_1244b7419a69', { arg0: String(time) }, options.resolvedLanguage) :
      t('m_430655ba4ce1', { arg0: String(mode), arg1: String(time) }, options.resolvedLanguage) : t('m_8a988cf37188', undefined, options.resolvedLanguage);
  return { label, target, targetZone, changed, confirmed: !inactive && state === 'Scheduled' && item.mode !== 'None' };
}
/** Active browsing uses the phone zone so the time agrees with native date groups. */
export function agendaAlertPresentation(item: ScheduleItem & { agendaAtMs?: number }, now = Date.now(), options: TimeDisplayOptions = {}) {
  const zone = deviceZone(), mode = modeLabel(item.mode, options.resolvedLanguage);
  if (item.mode === 'None') return t('m_d1af410eb4d0', undefined, options.resolvedLanguage);
  if (item.deliveryState === 'Alerting') return t('m_1ce1890d9f80', undefined, options.resolvedLanguage);
  const instant = item.agendaAtMs ?? item.nextAlertMs ?? item.alarmAtMs;
  const time = scheduleDateTime(instant, zone, now, options);
  if (item.deliveryState === 'Blocked') return t('m_aac19a9e45b5', { arg0: String(time) }, options.resolvedLanguage);
  if (item.deliveryState === 'Pending') return t('m_f4debfd9e50b', { arg0: String(time) }, options.resolvedLanguage);
  if (['Changing', 'SeriesChanging'].includes(item.deliveryState ?? '')) return t('m_1d625ffc7eed', { arg0: String(time) }, options.resolvedLanguage);
  if (item.deliveryState !== 'Scheduled' || item.completed || item.deleted || item.skipped)
    return t('m_ae294290d499', { arg0: String(mode), arg1: String(time) }, options.resolvedLanguage);
  return item.alertAdjustment === 'Snoozed' ? t('m_d6a93f2fda82', { arg0: String(mode), arg1: String(time) }, options.resolvedLanguage) :
    item.alertAdjustment === 'Postponed' ? t('m_24aa76b87f0f', { arg0: String(mode), arg1: String(time) }, options.resolvedLanguage) : t('m_430655ba4ce1', { arg0: String(mode), arg1: String(time) }, options.resolvedLanguage);
}
export type CardContext = { groupKey: string };
/** A date may be omitted only when this row has an actual matching date heading. */
export function cardTimingPresentation(item: ScheduleItem & { agendaAtMs?: number }, now = Date.now(), context?: CardContext, options: TimeDisplayOptions = {}) {
  const terminal = !!(item.completed || item.deleted || item.skipped), mode = modeLabel(item.mode, options.resolvedLanguage);
  const zone = terminal || item.mode === 'None' && item.allDay ? item.zoneId || deviceZone() : deviceZone();
  const instant = terminal ? item.alarmAtMs : item.agendaAtMs ?? item.nextAlertMs ?? item.alarmAtMs;
  const event = item.mode === 'None';
  const dateInstant = event ? item.eventStartMs : instant;
  const crossDay = !item.allDay && civilAt(item.eventStartMs, zone).slice(0, 10) !== civilAt(item.eventEndMs, zone).slice(0, 10);
  const omitDate = !terminal && !crossDay && (!item.zoneId || item.zoneId === zone) && !!context && /^\d{4}-\d{2}-\d{2}$/.test(context.groupKey) &&
    civilAt(dateInstant, zone).slice(0, 10) === context.groupKey;
  const time = omitDate ? displayClock(instant, zone, options) : scheduleDateTime(instant, zone, now, options);
  const fullTime = spokenDateTime(instant, zone, options);
  if (event) {
    const timing = t('m_d80384069941', undefined, options.resolvedLanguage) + eventRange({ ...item, zoneId: zone }, now, omitDate, options);
    return { timing, spokenTiming: t('m_d970f7c6264c', undefined, options.resolvedLanguage) + spokenEventRange({ ...item, zoneId: zone }, options) };
  }
  const changed = instant !== item.alarmAtMs;
  const intendedState = item.deliveryState === 'Blocked' ? 'Blocked' : item.deliveryState === 'Pending' ? 'Scheduling' :
    item.deliveryState === 'Changing' || item.deliveryState === 'SeriesChanging' ? 'Updating' : null;
  const label = terminal ? t('m_9feb5fc02300', undefined, options.resolvedLanguage) + mode.toLowerCase() : intendedState ? t('m_c2a30a838189', undefined, options.resolvedLanguage) + mode.toLowerCase() :
    item.deliveryState === 'Scheduled' ? changed ? t('m_cd447acb4270', undefined, options.resolvedLanguage) + mode.toLowerCase() : mode : mode + t('m_4a8f540240f1');
  const adjustment = !terminal && item.deliveryState === 'Scheduled' && changed ? item.alertAdjustment : null;
  const support = (intendedState ?? adjustment) ? ownedMessage((intendedState ?? adjustment)!, options.resolvedLanguage) : null;
  return { timing: [label, time, support].filter(Boolean).join(' · '),
    spokenTiming: [label, fullTime, support].filter(Boolean).join('. ') };
}

/** Occurrence Details uses existing native eligibility and retains independent timing. */
export function detailSchedulePresentation(item: ScheduleItem, now = Date.now(), hasPublication = false, options: TimeDisplayOptions = {}) {
  const delivery = alertPresentation(item, false, now, options), zone = item.zoneId || deviceZone(), mode = modeLabel(item.mode, options.resolvedLanguage);
  const terminal = !!(item.completed || item.deleted || item.skipped);
  const instant = terminal ? item.alarmAtMs : delivery.target ?? item.nextAlertMs ?? item.alarmAtMs;
  const primaryZone = terminal ? zone : delivery.target == null && instant !== item.alarmAtMs ? deviceZone() : delivery.targetZone;
  const intended = ['Blocked', 'Pending', 'Changing', 'SeriesChanging'].includes(item.deliveryState ?? '');
  const label = item.mode === 'None' ? t('m_75ba69e3a8b7', undefined, options.resolvedLanguage) : terminal ? t('m_9feb5fc02300', undefined, options.resolvedLanguage) + mode.toLowerCase() :
    intended ? t('m_c2a30a838189', undefined, options.resolvedLanguage) + mode.toLowerCase() : delivery.confirmed ? delivery.changed ? t('m_cd447acb4270', undefined, options.resolvedLanguage) + mode.toLowerCase() : mode : mode + t('m_4a8f540240f1');
  const support = item.mode === 'None' ? t('m_d1af410eb4d0', undefined, options.resolvedLanguage) : intended ? item.deliveryState === 'Blocked' ? 'Blocked' : item.deliveryState === 'Pending' ? 'Scheduling' : 'Updating' : delivery.changed ? item.alertAdjustment ?? t('m_0eb42cd9606b', undefined, options.resolvedLanguage) : undefined;
  return { label, value: item.mode === 'None' ? eventRange(item, now, false, options) : scheduleDateTime(instant, primaryZone, now, options), supporting: support ? ownedMessage(support, options.resolvedLanguage) : support,
    showEvent: item.mode !== 'None' && hasPublication,
    showDue: !ordinaryDue(item), changed: delivery.changed, target: instant, targetZone: primaryZone };
}
/** Relative age uses the native original scheduling reference, never the next delivery. */
export function overduePresentation(item: ScheduleItem, now = Date.now(), language: SupportedLanguage = currentLanguage()) {
  if (item.completed || item.deleted || item.skipped || !item.overdue || item.overdueAtMs == null ||
      !Number.isFinite(item.overdueAtMs) || item.overdueAtMs >= now) return null;
  const minutes = Math.floor((now - item.overdueAtMs) / 60_000);
  const amount = minutes < 60 ? minutes : minutes < 1_440 ? Math.floor(minutes / 60) : Math.floor(minutes / 1_440);
  const key = minutes < 60 ? 'overdue_minutes' : minutes < 1_440 ? 'overdue_hours' : 'overdue_days';
  const short = minutes < 1 ? t('m_1903a435f2a5', undefined, language) : t(minutes < 60 ? 'overdue_short_minutes' : minutes < 1_440 ? 'overdue_short_hours' : key, { count: amount }, language);
  const spoken = minutes < 1 ? t('m_f38da2c1a0d7', undefined, language) : t(key, { count: amount }, language);
  return { label: t('m_a116c6c034c9', undefined, language) + short, spokenLabel: t('m_c81f58f9df63', undefined, language) + spoken };
}
type BrowsingStatus = { label: string; spokenLabel: string; tone: Tone; icon: ReturnType<typeof stateIcon> };
/** Browsing chooses useful work state; detailed delivery diagnostics stay available separately. */
export function reminderBrowsingPresentation(item: ScheduleItem & { agendaAtMs?: number }, now = Date.now(), context?: CardContext, options: TimeDisplayOptions = {}) {
  const terminal = !!(item.completed || item.deleted || item.skipped), overdue = overduePresentation(item, now, options.resolvedLanguage);
  const ringing = !terminal && item.mode !== 'None' && item.deliveryState === 'Alerting';
  const { timing, spokenTiming } = cardTimingPresentation(item, now, context, options);
  let status: BrowsingStatus | null = null;
  if (terminal) {
    const label = item.deleted ? t('m_aa145420c39e', undefined, options.resolvedLanguage) + (item.completed ? t('m_22a970d2e5b1', undefined, options.resolvedLanguage).toLowerCase() : item.skipped ? t('m_12698ce1ea5c', undefined, options.resolvedLanguage).toLowerCase() : t('m_9b569cd06235')) : item.skipped ? t('m_12698ce1ea5c', undefined, options.resolvedLanguage) : t('m_22a970d2e5b1', undefined, options.resolvedLanguage);
    status = { label, spokenLabel: label, tone: item.completed && !item.deleted ? 'success' : 'muted', icon: item.deleted ? 'delete' : item.skipped ? 'cancel' : 'check_circle' };
  } else if (ringing) status = { label: t('m_426a858eacbb', undefined, options.resolvedLanguage), spokenLabel: t('m_1ce1890d9f80', undefined, options.resolvedLanguage), tone: 'accent', icon: 'alarm' };
  else if (overdue) status = { ...overdue, tone: 'warning', icon: 'warning' };
  else if (item.mode !== 'None' && item.deliveryState === 'Failed') {
    const label = item.mode === 'Notification' ? t('m_8d3fa6513897', undefined, options.resolvedLanguage) : t('m_c7102925c08a', undefined, options.resolvedLanguage);
    status = { label, spokenLabel: label, tone: 'danger', icon: 'error' };
  } else if (item.mode !== 'None' && item.deliveryState === 'Paused') status = { label: t('m_e159b06187d3', undefined, options.resolvedLanguage), spokenLabel: t('m_6b65c366111c', undefined, options.resolvedLanguage), tone: 'muted', icon: 'pause' };
  // A future snoozed/postponed target or blocked/intended target is already explicit
  // in timing. Missed/timeout/interruption/notified labels add no useful work state.
  const warning = !terminal && overdue && !ringing && item.mode !== 'None' && item.deliveryState === 'Failed' ?
    item.mode === 'Notification' ? t('m_8d3fa6513897', undefined, options.resolvedLanguage) : t('m_c7102925c08a', undefined, options.resolvedLanguage) : null;
  const spokenLabel = [spokenTiming, status?.spokenLabel, ringing ? overdue?.spokenLabel : null, warning,
    terminal && item.mode !== 'None' ? t('m_133a152e6e79', undefined, options.resolvedLanguage) + spokenEventRange(item, options) : null].filter(Boolean).join('. ');
  return { timing, status, warning, overdue, spokenLabel };
}
export function canAdjustAlert(item: Pick<Occurrence, 'completed' | 'deleted' | 'skipped' | 'mode' | 'deliveryState'>) {
  return !item.completed && !item.deleted && !item.skipped && item.mode !== 'None' &&
    !['Completed', 'Deleted', 'Skipped', 'Replaced', 'Paused', 'Changing', 'SeriesChanging'].includes(item.deliveryState);
}
export function recordedCompletionTime(history: Occurrence['history']) {
  const completed = history?.filter((entry) => entry.kind === 'Done');
  return completed?.length ? Math.max(...completed.map((entry) => entry.atMs)) : null;
}
export function deliveryExplanation(item: Pick<Occurrence, 'completed' | 'deleted' | 'skipped' | 'deliveryState' | 'mode'>) {
  if (item.deleted) return t('m_9d801125babd');
  if (item.completed || item.skipped || item.mode === 'None') return null;
  return ({ Stopped: t('m_338098a7f260'),
    TimedOut: t('m_924e555dae94'),
    Interrupted: t('m_ef5760a8696b'),
    Missed: item.mode === 'Notification' ? t('m_5addb2cc98e3') : t('m_7a1c0208d64c'),
    Failed: item.mode === 'Notification' ? t('m_aad2e0c9b999') : t('m_52d6e9a1b6a6'),
    Blocked: t('m_8b1a1b58116c'),
    Pending: t('m_45c31e9e2406'), Changing: t('m_3285f214daaa'), SeriesChanging: t('m_acce95b7bcf2') } as Record<string, string>)[item.deliveryState] ?? null;
}
export function calendarDate(value: number, zoneId = deviceZone(), now = Date.now(), options: TimeDisplayOptions = {}) {
  const date = civilAt(value, zoneId).slice(0, 10), today = civilAt(now, zoneId).slice(0, 10);
  if (date === today) return t('m_2b065c7c9ce4', undefined, options.resolvedLanguage);
  const tomorrow = new Date(today + 'T12:00:00Z'); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (date === tomorrow.toISOString().slice(0, 10)) return t('m_456a73bbcefb', undefined, options.resolvedLanguage);
  return new Date(value).toLocaleDateString(options.localeTag ?? currentLanguage(), { month: 'short', day: 'numeric', timeZone: zoneId,
    ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}) });
}
export function scheduleDateTime(value: number, zoneId = deviceZone(), now = Date.now(), options: TimeDisplayOptions = {}) {
  return calendarDate(value, zoneId, now, options) + ' · ' + displayClock(value, zoneId, options);
}
/** Screen readers retain absolute dates even when visible group context is concise. */
export function spokenDateTime(value: number, zoneId = deviceZone(), options: TimeDisplayOptions = {}) {
  return new Date(value).toLocaleDateString(options.localeTag ?? currentLanguage(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: zoneId }) + ', ' +
    displayClock(value, zoneId, options);
}
function spokenEventRange(item: ScheduleItem, options: TimeDisplayOptions = {}) {
  const zone = item.zoneId || deviceZone();
  return item.allDay ? new Date(item.eventStartMs).toLocaleDateString(options.localeTag ?? currentLanguage(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: zone }) + t('m_55181ae28147', undefined, options.resolvedLanguage) :
    spokenDateTime(item.eventStartMs, zone, options) + t('m_87721689ee42', undefined, options.resolvedLanguage) + spokenDateTime(item.eventEndMs, zone, options);
}
export function eventRange(item: ScheduleItem, now = Date.now(), omitDate = false, options: TimeDisplayOptions = {}) {
  const zone = item.zoneId || deviceZone();
  if (item.allDay) return (omitDate ? '' : calendarDate(item.eventStartMs, zone, now, options) + ' · ') + t('m_34233e542b7b', undefined, options.resolvedLanguage);
  const time = (value: number) => displayClock(value, zone, options);
  return civilAt(item.eventStartMs, zone).slice(0, 10) === civilAt(item.eventEndMs, zone).slice(0, 10)
    ? (omitDate ? '' : calendarDate(item.eventStartMs, zone, now, options) + ' · ') + time(item.eventStartMs) + '–' + time(item.eventEndMs)
    : scheduleDateTime(item.eventStartMs, zone, now, options) + ' – ' + scheduleDateTime(item.eventEndMs, zone, now, options);
}
export function groupTitle(group: string, now = new Date()) {
  if (group === 'overdue') return t('m_d660945bc299');
  if (group === 'earlier') return t('m_e10ae9907401');
  if (group === 'completed') return t('m_22a970d2e5b1');
  const date = new Date(group + 'T12:00:00');
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return t('m_2b065c7c9ce4');
  if (date.toDateString() === tomorrow.toDateString()) return t('m_456a73bbcefb');
  return date.toLocaleDateString(currentLanguage(), { weekday: 'short', month: 'short', day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}
