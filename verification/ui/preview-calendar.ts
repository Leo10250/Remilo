/** Synthetic Calendar adapter: memory only, with no native authorization or HTTP capability. */
import type { CalendarCommand, CalendarConnection, CalendarLegacyCommand, CalendarPublication, CalendarPublicationPreview, ManagedCalendarCommand, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { deviceZone } from '../../src/domain/time';
import { previewCalendarLinks } from './preview-calendar-links';
import { previewManagedCalendar } from './preview-calendar-managed';
import type { CalendarFields, CalendarImportChoices, CalendarOperationStatus, CalendarSyncResult } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export function previewCalendar(review: URLSearchParams, find: (id: string) => Occurrence | undefined, changed: () => void,
  save?: (fields: CalendarFields, choices: CalendarImportChoices, operationId: string, id?: string) => Occurrence) {
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  const state = review.get('reviewCalendar') || 'connected';
  let connection: CalendarConnection = { revision: 1, connected: state !== 'disconnected', available: state !== 'unavailable', email: 'calendar-tester@example.test',
    calendarId: ['disconnected', 'no-calendar'].includes(state) ? '' : 'fixture-calendar',
    calendarName: ['disconnected', 'no-calendar'].includes(state) ? '' : 'Synthetic owned calendar / 测试日历', message: 'Synthetic preview. No Google requests can be sent.' };
  const jobs = new Map<string, CalendarPublication>(), captures = new Map<string, CalendarCommand>();
  const authorizations = new Map<string, { target: string | null; status: CalendarOperationStatus['stage'] }>();
  const syncRequests = new Map<string, { input: string; revision: number; status: CalendarOperationStatus }>();
  const latestSync = (id?: string) => [...syncRequests.values()].reverse().find(value => value.revision === connection.revision &&
    value.status.currentScope &&
    (value.status.syncResult?.scope?.kind === 'Association' ? value.status.syncResult.scope.occurrenceId === id : !id))?.status.operationId;
  const syncOutcomes: readonly CalendarSyncResult['outcome'][] = ['Checking', 'NoChanges', 'Synced', 'Pending', 'NeedsReview', 'AccessRequired', 'Unconfirmed', 'Paused', 'Failed', 'ScopeChanged', 'NotChecked'];
  const captureSync = (command: Extract<CalendarCommand, { kind: 'RequestCalendarSync' }>, outcome: CalendarSyncResult['outcome'], atMs: number) => {
    const stages: Partial<Record<CalendarSyncResult['outcome'], CalendarOperationStatus['stage']>> = { Checking: 'CheckingEvents', Pending: 'Waiting', AccessRequired: 'NeedsAccess', NeedsReview: 'NeedsReview', Unconfirmed: 'Unconfirmed', Paused: 'Paused', Failed: 'Failed', ScopeChanged: 'Cancelled' };
    const confirmed = outcome === 'NoChanges' || outcome === 'Synced';
    const status: CalendarOperationStatus = { operationId: command.operationId, kind: 'Sync', stage: stages[outcome] || 'Confirmed', reason: outcome === 'Pending' ? 'NETWORK' : '',
      action: outcome === 'AccessRequired' ? 'Connect' : outcome === 'NeedsReview' || outcome === 'Unconfirmed' ? 'ReviewItems' : 'None', currentScope: outcome !== 'ScopeChanged', children: [],
      confirmed: confirmed ? 1 : 0, pending: outcome === 'Pending' ? 1 : 0, review: outcome === 'NeedsReview' ? 1 : 0, held: 0,
      syncResult: { scope: command.scope, outcome, checked: confirmed ? 1 : 0, changed: outcome === 'Synced' ? 1 : 0, imported: 0, published: 0,
        startedAtMs: atMs, finishedAtMs: outcome === 'Checking' ? null : atMs } };
    syncRequests.set(command.operationId, { input: JSON.stringify(command), revision: connection.revision, status });
  };
  // A saved native result can be inspected on page entry, independently of a new Sync now action.
  // This fixture never dispatches a command, emits a change notification or accesses Google.
  const savedOutcome = review.get('reviewSyncSaved');
  if (syncOutcomes.includes(savedOutcome as CalendarSyncResult['outcome'])) {
    captureSync({ kind: 'RequestCalendarSync', operationId: 'synthetic-saved-calendar-sync', scope: { kind: 'AllAuthorized' } },
      savedOutcome as CalendarSyncResult['outcome'], Date.UTC(2026, 9, 29, 17, 24));
  }
  const linked = previewCalendarLinks(review, find, changed, save, () => connection.revision, () => connection.connected);
  const adoptionPreviewIds = new Set<string>();
  const managed = previewManagedCalendar(review, find, changed, () => connection.revision, () => connection.connected,
    async (candidateId, choices) => {
      const preview = review.get('reviewManaged') === 'adoption' ? await linked.previewCalendarLink('review') : await linked.previewCalendarImport({ calendarId: 'fixture-managed-calendar', eventId: 'personal' }, choices);
      if (preview.local) adoptionPreviewIds.add(preview.previewId);
      return { ...preview, candidateId, candidateRevision: 1 };
    },
    async (previewId, operationId, selections) => { try { return await linked.applyCalendarLinked({ kind: adoptionPreviewIds.has(previewId) ? 'EnableCalendarLink' : 'ImportCalendarEvent', previewId, operationId, automaticSync: true,
      ...(selections ? { selections } : {}) }); }
      catch (error) { const captured = (await linked.getCalendarOperations()).find(item => item.operationId === operationId); if (captured) return captured; throw error; } });
  const error = (code: string): never => { throw Object.assign(new Error('Synthetic Calendar: ' + code), { code }); };
  const preview = (id: string): CalendarPublicationPreview => {
    const item = find(id);
    if (!item) return error('NOT_FOUND');
    if (item.completed || item.deleted || item.skipped || item.segmentId) return error('INELIGIBLE');
    if ([...jobs.values()].some((job) => job.occurrenceId === id)) return error('ALREADY_PUBLISHED');
    if (!connection.connected || !connection.calendarId) return error('NEEDS_CONNECTION');
    return { occurrenceId: id, reminderRevision: item.revision, connectionRevision: connection.revision,
      fingerprint: `fixture-${item.revision}-${connection.revision}`, zoneId: item.zoneId || deviceZone(), pinsZone: !item.zoneId,
      title: item.title, notes: item.notes, eventStartMs: item.eventStartMs, eventEndMs: item.eventEndMs, allDay: item.allDay,
      email: connection.email, calendarName: connection.calendarName };
  };
  if (['Published', 'Unconfirmed', 'NeedsAccess', 'Failed', 'Conflict', 'Cancelled', 'Publishing'].includes(state)) {
    jobs.set('fixture-publication', { operationId: 'fixture-publication', occurrenceId: 'review', email: connection.email,
      calendarName: connection.calendarName, state: state as CalendarPublication['state'], message: 'Synthetic saved publication. No remote writes.',
      htmlLink: '', publishedAtMs: state === 'Published' ? Date.now() : null, differs: review.get('reviewCalendarDiffers') === '1', readOnly: false });
  }
  return {
    ...linked,
    ...managed,
    getCalendarLinks: async () => (await linked.getCalendarLinks()).map(link => ({ ...link, syncRequestId: latestSync(link.occurrenceId) })),
    getCalendarSyncSummary: async () => {
      const summary = await linked.getCalendarSyncSummary(), extras = managed.getManagedCalendarIssues();
      const reviewCounts = { reminders: summary.reviewCount, candidates: extras.filter(issue => issue.kind === 'Candidate').length,
        setup: extras.filter(issue => issue.kind === 'Setup').length, total: summary.reviewCount + extras.length };
      const blocking = extras.filter(issue => ['NEEDS_ACCESS', 'AccessRequired', 'AUTH'].includes(issue.reason)).length;
      return { ...summary, reviewCount: reviewCounts.total, reviewCounts, attention: { blocking, tone: blocking ? 'danger' as const : 'warning' as const }, syncRequestId: latestSync() };
    },
    getCalendarReviewIssues: async (cursor: string | null) => {
      const page = await linked.getCalendarReviewIssues(cursor), items = [...page.items, ...managed.getManagedCalendarIssues()];
      return { ...page, items, count: items.length, counts: { reminders: items.filter(issue => issue.kind === 'Association').length,
        candidates: items.filter(issue => issue.kind === 'Candidate').length, setup: items.filter(issue => issue.kind === 'Setup').length, total: items.length } };
    },
    getCalendarConnection: async () => clone(connection),
    beginCalendarAuthorization: async (requestId: string, operationId: string | null) => {
      const prior = authorizations.get(requestId); if (prior) { if (prior.target !== operationId) return error('OPERATION_REUSED'); return { operationId: requestId, launched: false }; }
      const status = review.get('reviewCalendarConsent') === 'cancel' ? 'Cancelled' : review.get('reviewCalendarConsent') === 'denied' ? 'Failed' : review.get('reviewCalendarConsent') === 'waiting' ? 'AwaitingAuthorization' : 'Authorized';
      authorizations.set(requestId, { target: operationId, status });
      if (status === 'Authorized') connection = { ...connection, connected: true, revision: connection.revision + 1 };
      changed(); return { operationId: requestId, launched: true };
    },
    getCalendarOperationStatus: async (operationId: string): Promise<CalendarOperationStatus | null> => {
      const request = syncRequests.get(operationId);
      if (request) return clone(request.revision === connection.revision ? request.status : { ...request.status, stage: 'Cancelled', currentScope: false, syncResult: { ...request.status.syncResult!, outcome: 'ScopeChanged' } });
      const auth = authorizations.get(operationId);
      if (auth) return { operationId, kind: 'Authorization', stage: auth.status, reason: '', action: auth.status === 'Failed' ? 'Connect' : 'None', confirmed: 0, pending: 0, review: 0, held: 0, children: [], currentScope: true };
      const children = linked.getCalendarLinkedBatchChildren(operationId);
      if (children) {
        const jobs = (await linked.getCalendarOperations()).filter(job => children.includes(job.operationId));
        const confirmed = jobs.filter(job => job.state === 'Confirmed').length, remaining = jobs.length - confirmed;
        return { operationId, kind: 'Activation', stage: remaining ? 'NeedsReview' : 'Confirmed', reason: '', action: remaining ? 'ReviewItems' : 'None', confirmed, pending: 0, review: remaining, held: 0, children, currentScope: true };
      }
      return managed.getManagedCalendarOperationStatus(operationId);
    },
    getCalendarPublications: async () => clone([...jobs.values()]),
    previewCalendarPublication: async (id: string) => clone(preview(id)),
    authorizeCalendar: async (_publicationId: string | null) => {
      // Deliberately no real authorization, even when a fixture action is pressed.
      if (review.get('reviewCalendarConsent') === 'cancel') return;
      if (review.get('reviewCalendarConsent') === 'denied') return error('AUTH');
      connection = { ...connection, connected: true, revision: connection.revision + 1 }; changed();
    },
    listOwnedCalendars: async (cursor: string | null) => ({ connectionRevision: connection.revision,
      items: state === 'empty' ? [] : [{ id: cursor ? 'fixture-calendar-2' : 'fixture-calendar', name: cursor ? 'Another owned calendar' : 'Synthetic owned calendar / 测试日历', zoneId: 'America/Los_Angeles' }],
      nextCursor: !cursor && state !== 'empty' ? 'fixture-page-2' : null }),
    applyCalendarCommand: async (command: CalendarCommand): Promise<unknown> => {
      if (command.kind === 'RequestCalendarSync') {
        const previous = syncRequests.get(command.operationId), input = JSON.stringify(command);
        if (previous) { if (previous.input !== input) return error('OPERATION_REUSED'); return { operationId: command.operationId }; }
        const outcome = (review.get('reviewSyncOutcome') || (review.get('reviewCalendarOffline') === '1' ? 'Pending' : review.get('reviewCalendarSync') === 'conflict' ? 'NeedsReview' : 'NoChanges')) as CalendarSyncResult['outcome'];
        captureSync(command, outcome, Date.now());
        changed();
        if (review.get('reviewLostReply') === '1') throw new Error('Synthetic sync reply lost after capture.');
        return { operationId: command.operationId };
      }
      if (['ConfirmManagedCalendarSetup', 'ApplyManagedCalendarPolicy', 'ResumeManagedCalendar', 'EnableRecoveredCalendarAlerts', 'PauseManagedCalendar', 'DisableManagedCalendar', 'SetCalendarReminderDisposition', 'ImportManagedCalendarCandidate', 'IgnoreManagedCalendarCandidate', 'RetryManagedCalendarOperation'].includes(command.kind)) return managed.applyManagedCalendarCommand(command as ManagedCalendarCommand);
      if (!['PublishOneOff', 'RetryPublication', 'SelectCalendar', 'DisconnectCalendar'].includes(command.kind)) return linked.applyCalendarLinked(command as CalendarLegacyCommand);
      if (command.kind === 'RetryPublication') {
        const job = jobs.get(command.operationId); if (!job) return error('NOT_FOUND');
        if (review.get('reviewCalendarOffline') !== '1') jobs.set(job.operationId, { ...job, state: 'Published', message: 'Synthetic publication confirmed.' });
        changed(); return clone(jobs.get(job.operationId));
      }
      const prior = captures.get(command.operationId);
      if (prior) { if (JSON.stringify(prior) !== JSON.stringify(command)) return error('OPERATION_REUSED'); return clone(jobs.get(command.operationId) ?? connection); }
      if (command.kind === 'PublishOneOff') {
        const value = preview(command.occurrenceId);
        if (command.expectedRevision !== value.reminderRevision || command.expectedConnectionRevision !== value.connectionRevision || command.fingerprint !== value.fingerprint) return error('STALE_PREVIEW');
        jobs.set(command.operationId, { operationId: command.operationId, occurrenceId: command.occurrenceId, email: value.email,
          calendarName: value.calendarName, state: review.get('reviewCalendarOffline') === '1' ? 'Unconfirmed' : 'Published',
          message: 'Synthetic captured publication. No Google requests.', htmlLink: '', publishedAtMs: null, differs: false, readOnly: false });
      } else if (command.kind === 'SelectCalendar' || command.kind === 'DisconnectCalendar') {
        if (command.expectedConnectionRevision !== connection.revision) return error('STALE_CONNECTION');
        connection = { ...connection, revision: connection.revision + 1, ...(command.kind === 'DisconnectCalendar' ? { connected: false } : { calendarId: command.calendarId, calendarName: command.calendarId === 'fixture-calendar-2' ? 'Another owned calendar' : 'Synthetic owned calendar / 测试日历' }) };
      }
      captures.set(command.operationId, clone(command)); changed();
      if (review.get('reviewLostReply') === '1') throw new Error('Synthetic Calendar reply lost after capture.');
      return clone(jobs.get(command.operationId) ?? connection);
    },
  };
}
