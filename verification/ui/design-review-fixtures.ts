/** Frozen, synthetic content shared by every design direction; no persisted appearance state. */
import type { ListRecord, Occurrence, RepeatFamily, Series } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { ReviewDescriptor, ReviewPeriodId } from '../../src/ui/review-appearance';
import { civilAt } from '../../src/domain/time';

export const reviewNowMs = Date.parse('2026-10-06T08:00:00-07:00');
export const reviewZone = 'America/Los_Angeles';
export type ReviewScenario = 'populated' | 'overdue' | 'completed' | 'empty' | 'loading' | 'error' | 'long-titles' | 'all-day' | 'independent' | 'multilingual' | 'p01-long-english' | 'p01-long-chinese';
export const reviewScenarios: readonly { id: ReviewScenario; name: string }[] = [
  { id: 'populated', name: 'Everyday' }, { id: 'overdue', name: 'Delivery outcomes' }, { id: 'completed', name: 'Completed' },
  { id: 'long-titles', name: 'Long titles' }, { id: 'multilingual', name: 'English and Chinese' },
  { id: 'all-day', name: 'All-day' }, { id: 'independent', name: 'Independent timing' },
  { id: 'empty', name: 'Empty' }, { id: 'loading', name: 'Loading' }, { id: 'error', name: 'Refresh error' },
  { id: 'p01-long-english', name: 'P01 · Long English' }, { id: 'p01-long-chinese', name: 'P01 · Long Chinese' },
];

const minuteMs = 60_000;
const dayMs = 86_400_000;
const at = (minute: number, day = 0) => reviewNowMs - 480 * minuteMs + minute * minuteMs + day * dayMs;
const make = (id: string, title: string, minute: number, changes: Partial<Occurrence> = {}, day = 0): Occurrence => {
  const event = at(minute, day);
  return { id, title, eventStartMs: event, eventEndMs: event + 30 * minuteMs, dueAtMs: event,
    alarmAtMs: event, nextAlertMs: event, mode: 'Alarm', notes: '', listName: '', listId: null,
    allDay: false, zoneId: reviewZone, dueLinked: true, alarmLinked: true, sound: 'remilo', vibration: true,
    completed: false, deleted: false, revision: 7, generation: 4, deliveryState: 'Scheduled',
    overdue: event < reviewNowMs, history: [{ kind: 'Create', atMs: event - dayMs, targetMs: event }],
    segmentId: null, nominalSlot: null, exception: false, skipped: false, seriesState: null,
    repeatSummary: null, agendaGroup: day === 0 ? '2026-10-06' : '2026-10-07', ...changes };
};

const water = make('water', 'Water plants', 480, { listId: 'personal', listName: 'Personal' });
const medicine = make('medicine', 'Take medicine', 480, { listId: 'health', listName: 'Health' });
const read = make('read', 'Read', 1380, { listId: 'personal', listName: 'Personal' });
const lunch = make('lunch', 'Lunch with Alex', 780, { mode: 'Notification', listId: 'personal', listName: 'Personal' });
const focus = make('focus', 'Review the project proposal', 960, { listId: 'work', listName: 'Work',
  notes: 'Check the draft and the budget before the meeting.' });
const groceries = make('groceries', 'Grocery shopping', 600, { listId: 'personal', listName: 'Personal' }, 1);
const stopped = make('stopped', 'Pick up the parcel', 1080, { deliveryState: 'Stopped', nextAlertMs: null,
  overdue: true, agendaGroup: 'overdue', listId: 'personal', listName: 'Personal',
  history: [{ kind: 'Create', atMs: at(720, -2), targetMs: at(1080, -1) }, { kind: 'Stop', atMs: at(1081, -1), targetMs: null }] }, -1);
const postponed = make('postponed', 'Call dentist', 660, { nextAlertMs: at(1080), alertAdjustment: 'Postponed',
  overdue: true, agendaGroup: 'overdue', history: [{ kind: 'Create', atMs: at(720, -2), targetMs: at(660, -1) },
    { kind: 'Postpone', atMs: at(420), targetMs: at(1080) }] }, -1);
const timedOut = make('timed-out', 'Morning stretches', 420, { deliveryState: 'TimedOut', nextAlertMs: null,
  overdue: true, agendaGroup: 'overdue', history: [{ kind: 'TimedOut', atMs: at(425), targetMs: null }] });
const blocked = make('blocked', 'Gym', 1050, { deliveryState: 'Blocked', nextAlertMs: null,
  history: [{ kind: 'Blocked', atMs: at(470), targetMs: at(1050) }] });
const completed = make('completed', 'Pay the electricity bill', 1080, { completed: true, deliveryState: 'Completed',
  nextAlertMs: null, overdue: false, agendaGroup: 'completed', collectionAtMs: at(450),
  history: [{ kind: 'Done', atMs: at(450), targetMs: null }] }, -1);
const skipped = make('skipped', 'Evening walk', 1140, { skipped: true, deliveryState: 'Skipped', nextAlertMs: null,
  overdue: false, agendaGroup: 'completed', collectionAtMs: at(430), segmentId: 'walk-series',
  nominalSlot: '2026-10-05T19:00:00', seriesState: 'Active', repeatSummary: 'Every day',
  history: [{ kind: 'Skip', atMs: at(430), targetMs: null }] }, -1);
const trashed = make('trashed', 'Replace the desk lamp', 1080, { deleted: true, deliveryState: 'Deleted',
  nextAlertMs: null, overdue: false, agendaGroup: 'deleted', collectionAtMs: at(460),
  listId: 'personal', listName: 'Personal', history: [{ kind: 'Create', atMs: at(720, -2), targetMs: at(1080, -1) },
    { kind: 'Delete', atMs: at(460), targetMs: null }] }, -1);
const paused = make('paused', 'Practice the piano', 1020, { segmentId: 'piano-series', nominalSlot: '2026-10-06T17:00:00',
  seriesState: 'Paused', deliveryState: 'Paused', nextAlertMs: null, repeatSummary: 'Every Tuesday and Thursday',
  repeatRule: { frequency: 'weekly', interval: 1, weekdays: [2, 4], zoneMode: 'floating' }, listId: 'personal', listName: 'Personal' });
const ended = make('ended', 'Prepare for the project review', 960, { segmentId: 'ended-series', nominalSlot: '2026-10-05T16:00:00',
  seriesState: 'Archived', deliveryState: 'Missed', nextAlertMs: null, overdue: true, agendaGroup: 'overdue',
  repeatSummary: 'Every weekday, until Oct 5, 2026', repeatRule: { frequency: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5],
    until: '2026-10-05', zoneMode: 'pinned' }, listId: 'work', listName: 'Work' }, -1);
const longEnglish = make('long-english', 'Prepare the complete presentation and supporting notes for the upcoming project review with the regional team', 900,
  { listId: 'work', listName: 'Work', notes: 'Include the customer feedback, budget changes, and the next milestones.' });
const longChinese = make('long-chinese', '\u6574\u7406\u9879\u76ee\u8bc4\u5ba1\u9700\u8981\u7684\u6f14\u793a\u6587\u7a3f\u3001\u5ba2\u6237\u53cd\u9988\u548c\u4e0b\u4e00\u9636\u6bb5\u7684\u8be6\u7ec6\u8ba1\u5212', 930,
  { listId: 'work', listName: 'Work', notes: '\u4fdd\u7559\u72ec\u7acb\u7684\u4e8b\u4ef6\u3001\u622a\u6b62\u65f6\u95f4\u548c\u63d0\u9192\u65f6\u95f4\u3002' });
const allDay = make('all-day', 'Submit the form', 0, { allDay: true, eventEndMs: at(0, 1), dueAtMs: at(0, 1),
  alarmAtMs: at(540), nextAlertMs: at(540), overdue: false, listId: 'work', listName: 'Work' });
const independent = make('independent', 'Prepare the meeting packet', 840, { dueAtMs: at(720), alarmAtMs: at(660),
  nextAlertMs: at(660), dueLinked: false, alarmLinked: false, listId: 'work', listName: 'Work',
  notes: 'The packet is due at noon. The meeting begins at 2 PM.' });
const allDayIndependent = make('all-day-independent', 'Birthday preparations', 0, { allDay: true, eventEndMs: at(0, 1),
  dueAtMs: at(1080), alarmAtMs: at(960), nextAlertMs: at(960), dueLinked: false, alarmLinked: false, overdue: false });
const chineseMedicine = make('chinese-medicine', '\u5403\u836f', 480, { listId: 'health', listName: 'Health' });
const chineseWater = make('chinese-water', '\u7ed9\u690d\u7269\u6d47\u6c34', 540, { listId: 'personal', listName: 'Personal' });
const emojiWater = make('emoji-water', '\ud83c\udf31 Water the balcony plants', 600);
const ambiguous = make('ambiguous', 'Read about running and take medicine', 1020);
const unsupported = make('unsupported', '\u8a08\u753b\u3092\u78ba\u8a8d\u3059\u308b', 1080);
const manual = make('manual', 'Take medicine before dinner', 1080);

const descriptors: Readonly<Record<string, ReviewDescriptor>> = {
  water: { category: 'nature', confidence: 'confident', explanation: 'The fixture expects Nature for "Water plants".' },
  medicine: { category: 'health', confidence: 'confident', explanation: 'The fixture expects Health for "Take medicine".' },
  read: { category: 'focus', confidence: 'confident', explanation: 'The fixture expects Focus for "Read".' },
  lunch: { category: 'food', confidence: 'confident', explanation: 'The fixture expects Food for "Lunch".' },
  focus: { category: 'focus', confidence: 'confident', explanation: 'The fixture expects Focus for project review.' },
  groceries: { category: 'home', confidence: 'confident', explanation: 'The fixture expects Home and errands for groceries.' },
  stopped: { category: 'home', confidence: 'confident', explanation: 'The fixture expects Home and errands for a parcel.' },
  postponed: { category: 'health', confidence: 'confident', explanation: 'The fixture expects Health for a dentist visit.' },
  'timed-out': { category: 'fitness', confidence: 'confident', explanation: 'The fixture expects Fitness for stretches.' },
  blocked: { category: 'fitness', confidence: 'confident', explanation: 'The fixture expects Fitness for "Gym".' },
  completed: { category: 'home', confidence: 'confident', explanation: 'The fixture expects Home and errands for a bill.' },
  skipped: { category: 'fitness', confidence: 'confident', explanation: 'The fixture expects Fitness for a walk.' },
  trashed: { category: 'home', confidence: 'confident', explanation: 'The fixture expects Home and errands for a desk lamp.' },
  paused: { category: 'focus', confidence: 'confident', explanation: 'The fixture expects Focus for piano practice.' },
  ended: { category: 'focus', confidence: 'confident', explanation: 'The fixture expects Focus for project review.' },
  'long-english': { category: 'focus', confidence: 'confident', explanation: 'The fixture expects Focus for project review.' },
  'long-chinese': { category: 'focus', confidence: 'confident', explanation: 'The fixture expects Focus for a Simplified Chinese project-review phrase.' },
  'all-day': { category: 'general', confidence: 'general', explanation: 'This fixture has no confident category.' },
  independent: { category: 'focus', confidence: 'confident', explanation: 'The fixture expects Focus for meeting preparation.' },
  'all-day-independent': { category: 'social', confidence: 'confident', explanation: 'The fixture expects Celebration and social for a birthday.' },
  'chinese-medicine': { category: 'health', confidence: 'confident', explanation: 'The fixture expects Health for the Simplified Chinese medicine phrase.' },
  'chinese-water': { category: 'nature', confidence: 'confident', explanation: 'The fixture expects Nature for the Simplified Chinese watering phrase.' },
  'emoji-water': { category: 'nature', confidence: 'confident', explanation: 'The fixture expects Nature for the plant emoji and watering phrase.' },
  ambiguous: { category: 'general', confidence: 'general', explanation: 'This fixture has conflicting category signals.' },
  unsupported: { category: 'general', confidence: 'general', explanation: 'This fixture uses unsupported classifier content.' },
  manual: { category: 'health', confidence: 'confident', manualPalette: 'rose', explanation: 'A manual Rose choice takes precedence in this fixture.' },
};

const everyday = [water, medicine, lunch, focus, read, groceries];
const scenarios: Readonly<Record<ReviewScenario, readonly Occurrence[]>> = {
  populated: everyday,
  'p01-long-english': everyday.map((item) => item.id === 'focus' ? { ...item, title: longEnglish.title } : item),
  'p01-long-chinese': everyday.map((item) => item.id === 'focus' ? { ...item, title: longChinese.title } : item),
  overdue: [stopped, postponed, timedOut, ended, blocked],
  completed: [completed, skipped],
  empty: [], loading: [], error: everyday,
  'long-titles': [longEnglish, longChinese, allDayIndependent, independent],
  'all-day': [allDay, allDayIndependent],
  independent: [independent, allDayIndependent, postponed],
  multilingual: [chineseMedicine, chineseWater, emojiWater, ambiguous, unsupported, manual],
};

/** Ambient-period controls never rewrite the shared event, due, alert, or state fixtures. */
export function reviewItems(scenario: ReviewScenario, _currentPeriod?: ReviewPeriodId): Occurrence[] {
  return structuredClone([...scenarios[scenario]]);
}
export function reviewDescriptor(item: Pick<Occurrence, 'id'>): ReviewDescriptor {
  return { ...(descriptors[item.id] ?? { category: 'general', confidence: 'general', explanation: 'No fixture category is assigned.' }) };
}
export function reviewScenarioState(scenario: ReviewScenario): { loading: boolean; error: boolean; empty: boolean } {
  return { loading: scenario === 'loading', error: scenario === 'error', empty: scenario === 'empty' };
}
export function reviewCollectionItems(view: 'completed' | 'trash'): Occurrence[] {
  return structuredClone(view === 'trash' ? [trashed] : [completed, skipped]);
}

export const reviewLists: readonly ListRecord[] = [
  { id: 'personal', name: 'Personal', revision: 3, overdueCount: 1 },
  { id: 'work', name: 'Work', revision: 2, overdueCount: 1 },
  { id: 'health', name: 'Health', revision: 1, overdueCount: 0 },
  { id: 'reading', name: 'Reading', revision: 1, overdueCount: 0 },
];

function family(item: Occurrence, state: RepeatFamily['state'], rule: Series['rule'], daysAhead = [1, 2, 3]): RepeatFamily {
  const id = item.segmentId ?? 'daily-medicine';
  const { id: _id, completed: _completed, deleted: _deleted, revision: _revision, generation: _generation, deliveryState: _delivery,
    overdue: _overdue, history: _history, segmentId: _segment, nominalSlot: _nominal, exception: _exception, skipped: _skipped,
    seriesState: _state, repeatSummary: _summary, agendaGroup: _group, nextAlertMs: _next, repeatRule: _rule,
    alertAdjustment: _adjustment, collectionAtMs: _collection, ...template } = item;
  const upcoming = state === 'Ended' ? [] : daysAhead.map((days) => ({ nominalSlot: civilAt(item.eventStartMs + days * dayMs, reviewZone),
    eventStartMs: item.eventStartMs + days * dayMs, alarmAtMs: item.alarmAtMs + days * dayMs }));
  const current: Series = { id, seriesId: id, revision: 5, state: state === 'Ended' ? 'Archived' : state,
    exhausted: state === 'Ended', template, rule, registered: state === 'Active' ? upcoming.length : 0, pending: 0, upcoming };
  return { seriesId: id, current, state, unfinishedCount: state === 'Ended' ? 1 : 0,
    upcoming: upcoming.map((slot) => ({ ...slot, segmentId: id, zoneId: reviewZone, state: state === 'Paused' ? 'Paused' : 'Active' })) };
}

export function reviewRepeatFamilies(): RepeatFamily[] {
  return structuredClone([
    family(medicine, 'Active', { frequency: 'daily', interval: 1, zoneMode: 'floating', anchor: '2026-10-06T08:00:00', zoneId: null, endExclusive: null }),
    family(paused, 'Paused', { frequency: 'weekly', interval: 1, weekdays: [2, 4], zoneMode: 'floating', anchor: '2026-10-06T17:00:00', zoneId: null, endExclusive: null }, [2, 7, 9]),
    family(ended, 'Ended', { frequency: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5], until: '2026-10-05', zoneMode: 'pinned',
      anchor: '2026-09-28T16:00:00', zoneId: reviewZone, endExclusive: null }),
  ]);
}
