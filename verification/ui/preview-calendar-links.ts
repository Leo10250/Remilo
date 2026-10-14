/** Memory-only Calendar fixtures. No authorization, HTTPS, durable storage or native scheduler. */
import type { CalendarLegacyCommand, CalendarFields, CalendarImportChoices, CalendarLink, CalendarLinkedOperation, CalendarLinkPreview, CalendarEventQuery, CalendarEventRef, CalendarSelections, Occurrence, CalendarActivationReview, CalendarReviewPage } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { resolvedCalendarFields } from '../../src/domain/calendar-link';

export function previewCalendarLinks(review: URLSearchParams, find: (id: string) => Occurrence | undefined, changed: () => void,
  save?: (fields: CalendarFields, choices: CalendarImportChoices, operationId: string, id?: string) => Occurrence,
  connectionRevision: () => number = () => 1, connected: () => boolean = () => true) {
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  const error = (code: string): never => { throw Object.assign(new Error('Synthetic link: ' + code), { code }); };
  const syncScenario = review.get('reviewCalendarSync');
  const scenario = review.get('reviewCalendarLink') ?? (syncScenario === 'conflict' ? 'conflict' : syncScenario ? 'linked' : null);
  let notificationPreference = { enabled: true, revision: 1 };
  const previews = new Map<string, CalendarLinkPreview>(), links = new Map<string, CalendarLink>(), jobs = new Map<string, CalendarLinkedOperation>();
  const receipts = new Map<string, string>(), sources = new Map<string, CalendarEventRef>(), batches = new Map<string, string[]>(); let count = 0;
  const fields = (item?: Occurrence): CalendarFields => ({ title: item?.title || 'A personal Calendar event / 私人日程',
    notes: item?.notes || 'Synthetic notes. No Google requests.', schedule: { eventStartMs: item?.eventStartMs || Date.now() + 3_600_000,
      eventEndMs: item?.eventEndMs || Date.now() + 5_400_000, allDay: item?.allDay || false, zoneId: item?.zoneId || 'America/Los_Angeles' } });
  const remote = fields();
  const metadata = (): Pick<CalendarLink, 'accountEmail' | 'availability' | 'availabilityReason' | 'observedAtMs' | 'lastCheckAttemptAtMs' | 'lastCheckErrorCode' | 'remoteDiffers' | 'requiresReview'> => ({
    accountEmail: 'calendar-tester@example.test', availability: 'Available', availabilityReason: '', observedAtMs: Date.now(), lastCheckAttemptAtMs: Date.now(), lastCheckErrorCode: '', remoteDiffers: false, requiresReview: false,
  });
  if (review.get('reviewText') === 'long') {
    remote.title = 'Review the complete project proposal and supporting materials / 审阅完整项目计划与支持材料';
    remote.notes = 'Preserve these personal notes exactly. 请保留完整的个人备注。\n'.repeat(20);
  }
  if (scenario === 'all-day') { const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + 1); remote.schedule = { ...remote.schedule, eventStartMs: day.getTime(), eventEndMs: day.getTime() + 86_400_000, allDay: true }; }
  if (['conflict', 'linked', 'deleted', 'unavailable', 'unsupported', 'detached', 'restored', 'terminal', 'partial-status', 'blocked-status'].includes(scenario || '')) links.set('review', {
    ...metadata(), occurrenceId: 'review', revision: 1, calendarName: 'Synthetic source / 测试日历', state: scenario === 'detached' ? 'Detached' : ['deleted', 'unavailable', 'unsupported', 'restored'].includes(scenario!) ? 'Suspended' : 'Linked',
    availability: scenario === 'deleted' ? 'Deleted' : scenario === 'unavailable' ? 'Unavailable' : scenario === 'unsupported' ? 'Unsupported' : 'Available',
    availabilityReason: scenario === 'deleted' ? 'REMOTE_DELETED' : scenario === 'unavailable' ? 'NOT_FOUND' : scenario === 'unsupported' ? 'MEETING_EVENT' : '',
    requiresReview: ['deleted', 'unavailable', 'unsupported', 'restored'].includes(scenario!),
    checkedAtMs: Date.now(), message: 'Synthetic connection. No Google requests.', htmlLink: '', readOnly: false, differs: scenario === 'conflict', source: { calendarId: 'fixture-calendar', eventId: 'personal' },
    syncMode: syncScenario && syncScenario !== 'manual' ? 'Automatic' : 'Manual', syncStatus: syncScenario === 'pending' ? 'UpdatePending' : syncScenario === 'paused' ? 'Paused' : syncScenario === 'conflict' ? 'Review' : syncScenario === 'unknown' ? 'Unconfirmed' : 'Confirmed',
    pauseReason: syncScenario === 'paused' ? 'AccessRequired' : syncScenario === 'conflict' ? 'ChangesNeedReview' : syncScenario === 'unknown' ? 'UnconfirmedWrite' : '', successfulAtMs: Date.now() - 300_000,
  });
  if (scenario === 'partial-status' || scenario === 'blocked-status') jobs.set('synthetic-operation', {
    operationId: 'synthetic-operation', occurrenceId: 'review', kind: 'ApplyCalendarResolution', calendarName: 'Synthetic source / 测试日历',
    state: scenario === 'partial-status' ? 'Unconfirmed' : 'Blocked', recoveryMode: 'Retry', localApplied: true, localStatus: scenario === 'partial-status' ? 'Scheduled' : 'Blocked',
    remoteAttempted: scenario === 'partial-status', readOnly: false, message: scenario === 'partial-status' ? 'Local changes saved. Google outcome unconfirmed. Retry the same operation.' : 'Google reminders remain. Resolve alert readiness, then retry.',
  });
  const preview = (id: string | null, choices: CalendarImportChoices = {}, source?: CalendarEventRef): CalendarLinkPreview => {
    const item = id ? find(id) : undefined;
    if (id && (!item || item.completed || item.deleted || item.skipped || item.segmentId)) return error('INELIGIBLE');
    const local = id ? fields(item) : null, google = id ? fields(item) : clone(remote);
    if (source && [...links.values()].some(link => link.source?.calendarId === source.calendarId && link.source.eventId === source.eventId)) return error('ALREADY_IMPORTED');
    if (source && source.eventId !== 'personal') google.title += ' · ' + source.eventId;
    if (id && scenario === 'conflict') { google.title = 'Google changed title / 新标题'; google.notes = 'Google changed notes'; }
    const defaults: CalendarSelections = { title: 'remilo', notes: 'remilo', schedule: 'remilo' };
    if (id && scenario === 'conflict') { defaults.title = null; defaults.notes = null; }
    const defaultAlarm = google.schedule.allDay ? google.schedule.eventStartMs + 9 * 3_600_000 : google.schedule.eventStartMs;
    const result: CalendarLinkPreview = { previewId: 'synthetic-review-' + ++count, occurrenceId: id || '', calendarName: 'Synthetic source / 测试日历',
      email: 'calendar-tester@example.test', remote: google, local, baseline: local ? { ...clone(local), title: 'Last confirmed title', notes: 'Last confirmed notes' } : null,
      selections: id ? defaults : null, choices: { automaticSync: choices.automaticSync ?? (!id || links.get(id)?.syncMode === 'Automatic'), ...choices, mode: choices.mode || 'Alarm', title: choices.title ?? google.title,
        alarmAtMs: choices.alarmAtMs ?? defaultAlarm, dueAtMs: google.schedule.allDay ? google.schedule.eventEndMs : google.schedule.eventStartMs },
      googleReminders: true, checkedAtMs: Date.now(), nextAlertMs: item?.alertAdjustment ? item.nextAlertMs : null,
      timings: item ? { remilo: { mode: item.mode, dueAtMs: item.dueAtMs, alarmAtMs: item.alarmAtMs }, google: { mode: item.mode, dueAtMs: item.dueAtMs, alarmAtMs: item.alarmAtMs } } : null };
    previews.set(result.previewId, clone(result)); if (source) sources.set(result.previewId, clone(source)); return clone(result);
  };
  return {
    getCalendarSyncSummary: async () => ({ connected: connected(), automaticCount: [...links.values()].filter(link => link.syncMode === 'Automatic').length,
      pendingCount: syncScenario === 'pending' ? 1 : 0, reviewCount: [...links.values()].filter(link => ['Review', 'Paused', 'Unconfirmed'].includes(link.syncStatus || '') && link.state !== 'Detached' && syncScenario !== 'read-only' && !find(link.occurrenceId)?.completed && !find(link.occurrenceId)?.deleted && !find(link.occurrenceId)?.skipped).length,
      notifications: clone(notificationPreference) }),
    getCalendarReviewIssues: async (_cursor: string | null): Promise<CalendarReviewPage> => {
      const items = [...links.values()].filter(link => ['Review', 'Paused', 'Unconfirmed'].includes(link.syncStatus || '') && link.state !== 'Detached' && !link.readOnly && syncScenario !== 'read-only' && !find(link.occurrenceId)?.completed && !find(link.occurrenceId)?.deleted && !find(link.occurrenceId)?.skipped).map(link => ({ kind: 'Association' as const, issueId: 'association:' + link.occurrenceId, occurrenceId: link.occurrenceId,
        seriesId: link.seriesId ?? null, title: find(link.occurrenceId)?.title || 'Synthetic reminder', reason: link.pauseReason || 'ReviewRequired' as const, discoveredAtMs: Date.now() }));
      return clone({ items, count: items.length, nextCursor: null });
    },
    previewCalendarActivation: async (ids: string[]): Promise<CalendarActivationReview> => ({ items: ids.map(id => {
      const p = preview(id, { automaticSync: true }); return { occurrenceId: id, excludedReason: p.selections && Object.values(p.selections).some(value => value === null) ? 'ChangesNeedReview' : null,
        preview: { ...p, automaticSync: true, activation: true, equal: scenario !== 'conflict', transfers: { inbound: scenario === 'conflict' ? ['title'] : [], outbound: [] } } };
    }) }),
    syncCalendarNow: async (_id: string | null) => { changed(); return { pages: 1, attempted: 1, confirmed: syncScenario === 'conflict' ? 0 : 1, continuation: false }; },
    getCalendarLinks: async () => clone([...links.values()].map(link => {
      const item = find(link.occurrenceId);
      if ((item?.deleted || item?.completed || item?.skipped) && !link.requiresReview) { link = { ...link, state: link.state === 'Detached' ? 'Detached' : 'Suspended', requiresReview: true }; links.set(link.occurrenceId, link); }
      return { ...link, readOnly: syncScenario === 'read-only' || !!item?.deleted || !!item?.completed || !!item?.skipped, source: connected() ? link.source : null };
    })),
    checkCalendarLink: async (id: string) => {
      const old = links.get(id); if (!old || !find(id)) return error('NOT_FOUND');
      const checkedAtMs = Date.now(), offline = review.get('reviewCalendarOffline') === '1';
      const next = { ...old, lastCheckAttemptAtMs: checkedAtMs, lastCheckErrorCode: offline ? 'NETWORK' : '',
        ...(offline ? {} : { observedAtMs: checkedAtMs, availability: scenario === 'deleted' ? 'Deleted' as const : scenario === 'unavailable' ? 'Unavailable' as const : scenario === 'unsupported' ? 'Unsupported' as const : 'Available' as const }) };
      links.set(id, next); changed(); return clone(next);
    },
    getCalendarOperations: async () => clone([...jobs.values()].map(job => ({ ...job, source: connected() ? job.source : null }))),
    listCalendarEvents: async (query: CalendarEventQuery) => {
      const days = (Date.parse(query.until) - Date.parse(query.from)) / 86_400_000;
      if (!(days > 0 && days <= 366)) return error('INVALID_RANGE');
      const bulk = review.get('reviewCalendarBulk') === '1';
      const eventId = bulk && query.cursor ? query.cursor === 'synthetic-next' ? 'personal-2' : 'personal-3' : 'personal';
      return { connectionRevision: connectionRevision(), calendarName: 'Synthetic source / 测试日历',
        items: [{ eventId, title: remote.title + (eventId === 'personal' ? '' : ' · ' + eventId), fields: clone(remote), unsupportedReason: null,
          occurrenceId: [...links.values()].find(link => link.source?.calendarId === query.calendarId && link.source.eventId === eventId)?.occurrenceId || null, erased: false },
          { eventId: 'meeting', title: 'Meeting with attendees', fields: null, unsupportedReason: 'MEETING_EVENT', occurrenceId: null, erased: false },
          { eventId: 'repeat', title: 'Recurring event', fields: null, unsupportedReason: 'RECURRING_EVENT', occurrenceId: null, erased: false }],
        nextCursor: bulk && query.cursor === 'synthetic-next' ? 'synthetic-next-2' : query.cursor ? null : 'synthetic-next' };
    },
    previewCalendarImport: async (event: CalendarEventRef, choices: CalendarImportChoices) => preview(null, choices, event),
    previewCalendarLink: async (id: string) => preview(id),
    previewCalendarUpdate: async (id: string) => preview(id),
    applyCalendarLinked: async function applyLinked(command: CalendarLegacyCommand): Promise<unknown> {
      if (command.kind === 'SetCalendarReviewNotifications') {
        if (command.expectedRevision !== notificationPreference.revision) return error('STALE_REVISION');
        notificationPreference = { enabled: command.enabled, revision: notificationPreference.revision + 1 }; changed(); return clone(notificationPreference);
      }
      if (command.kind === 'ActivateCalendarLinks') {
        const input = JSON.stringify(command), prior = receipts.get(command.operationId);
        if (prior) { if (prior !== input) return error('OPERATION_REUSED'); return clone({ operationId: command.operationId, operations: (batches.get(command.operationId) || []).map(id => jobs.get(id)) }); }
        const children: string[] = [];
        for (const previewId of command.previewIds) { const p = previews.get(previewId); if (!p) return error('STALE_PREVIEW');
          const id = 'synthetic-activation-' + ++count; await applyLinked({ kind: 'EnableAutomaticCalendarSync', operationId: id, previewId, selections: p.selections! }); children.push(id); }
        receipts.set(command.operationId, input); batches.set(command.operationId, children); return clone({ operationId: command.operationId, operations: children.map(id => jobs.get(id)) });
      }
      if (command.kind === 'ImportCalendarEvents') {
        const input = JSON.stringify(command), prior = receipts.get(command.operationId);
        if (prior) {
          if (prior !== input || !batches.has(command.operationId)) return error('OPERATION_REUSED');
          return clone({ operationId: command.operationId, operations: batches.get(command.operationId)!.map(id => jobs.get(id)) });
        }
        if (!command.items.length || command.items.length > 500) return error('IMPORT_LIMIT');
        const keys = new Set<string>();
        for (const item of command.items) {
          const p = previews.get(item.previewId), source = sources.get(item.previewId);
          if (!p || p.local || !source) return error('STALE_PREVIEW');
          const key = JSON.stringify(source); if (keys.has(key)) return error('ALREADY_IMPORTED'); keys.add(key);
          if (!(item.choices.title ?? p.choices.title)?.trim()) return error('TITLE_REQUIRED');
          if ((item.choices.mode || p.choices.mode) !== 'None' && (item.choices.alarmAtMs ?? p.choices.alarmAtMs) <= Date.now()) return error('ELAPSED_ALERT');
        }
        const children: string[] = [];
        for (const item of command.items) {
          const p = previews.get(item.previewId)!, id = 'synthetic-batch-child-' + ++count, previewId = 'synthetic-batch-preview-' + ++count;
          previews.set(previewId, { ...clone(p), previewId, choices: { ...p.choices, ...item.choices } }); sources.set(previewId, sources.get(item.previewId)!);
          try { await applyLinked({ kind: 'ImportCalendarEvent', operationId: id, previewId }); }
          catch (e) { if (!jobs.has(id)) throw e; } // Synthetic lost reply occurs after its in-memory save.
          children.push(id);
        }
        receipts.set(command.operationId, input); batches.set(command.operationId, children);
        if (review.get('reviewLostReply') === '1') throw new Error('Synthetic batch reply lost after captured imports.');
        return clone({ operationId: command.operationId, operations: children.map(id => jobs.get(id)) });
      }
      if (command.kind === 'RetryCalendarOperation') {
        const job = jobs.get(command.operationId); if (!job) return error('NOT_FOUND');
        if (review.get('reviewCalendarOffline') !== '1') jobs.set(job.operationId, { ...job, state: 'Confirmed', recoveryMode: 'None', message: 'Synthetic outcome confirmed. No Google write.' });
        changed(); return clone(jobs.get(job.operationId));
      }
      const input = JSON.stringify(command), prior = receipts.get(command.operationId);
      if (prior) { if (prior !== input) return error('OPERATION_REUSED'); return clone(jobs.get(command.operationId) || { unlinked: true }); }
      if (command.kind === 'UnlinkCalendar') {
        const old = links.get(command.occurrenceId); if (!old || old.revision !== command.expectedLinkRevision) return error('STALE_PREVIEW');
        links.set(old.occurrenceId, { ...old, revision: old.revision + 1, state: 'Detached', message: 'Unlinked. Both copies retained.' });
        receipts.set(command.operationId, input); changed(); return { unlinked: true };
      }
      if (!('previewId' in command)) return error('INVALID_INPUT');
      const p = previews.get(command.previewId); if (!p) return error('STALE_PREVIEW');
      const source = sources.get(command.previewId) ?? links.get(p.occurrenceId)?.source ?? undefined;
      const values = p.local ? resolvedCalendarFields(p.local, p.remote, command.selections || { title: null, notes: null, schedule: null }) : p.remote;
      if (!values) return error('RESOLUTION_REQUIRED');
      const item = save?.(p.local ? values : { ...values, title: p.choices.title || values.title }, p.choices, command.operationId, p.occurrenceId || undefined);
      const id = item?.id || p.occurrenceId || 'synthetic-import-' + ++count;
      const blocked = scenario === 'blocked', partial = scenario === 'partial' || review.get('reviewCalendarOffline') === '1';
      const automatic = command.kind === 'EnableAutomaticCalendarSync' || (command.automaticSync ?? p.choices.automaticSync ?? false);
      links.set(id, { ...metadata(), occurrenceId: id, revision: 1, calendarName: p.calendarName, state: 'Linked', checkedAtMs: Date.now(), message: 'Synthetic linked reminder.', htmlLink: '', readOnly: false, differs: false, source,
        syncMode: automatic ? partial || blocked ? 'Pending' : 'Automatic' : 'Manual', syncStatus: partial ? 'Unconfirmed' : blocked ? 'UpdatePending' : 'Confirmed', successfulAtMs: partial || blocked ? null : Date.now() });
      if (item && automatic && !partial && !blocked) item.history = [...item.history || [], { kind: 'CalendarActivated', atMs: Date.now(), targetMs: null }];
      const job: CalendarLinkedOperation = { operationId: command.operationId, occurrenceId: id, kind: command.kind, calendarName: p.calendarName, title: item?.title || p.choices.title || values.title,
        state: blocked ? 'Blocked' : partial ? 'Unconfirmed' : 'Confirmed', source, localApplied: true, localStatus: blocked ? 'Blocked' : (item?.mode || p.choices.mode) === 'None' ? 'Applied' : 'Scheduled',
        remoteAttempted: partial, readOnly: false, recoveryMode: blocked || partial ? 'Retry' : 'None', message: blocked ? 'Google reminders remain. Resolve alert readiness, then retry.' : partial ? 'Local changes saved. Google outcome unconfirmed. Retry the same operation.' : 'Local and Google outcomes confirmed in memory only.' };
      jobs.set(command.operationId, job); receipts.set(command.operationId, input); changed();
      if (review.get('reviewLostReply') === '1') throw new Error('Synthetic reply lost after durable-capture substitute.');
      return clone(job);
    },
  };
}
