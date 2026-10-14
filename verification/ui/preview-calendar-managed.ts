/** Synthetic managed Calendar adapter: memory only, without platform access or remote capabilities. */
import type { CalendarCreationDisposition, CalendarImportChoices, CalendarReminderDisposition, CalendarReviewIssue, ManagedCalendarCandidatePreview, ManagedCalendarCommand,
  CalendarSelections, ManagedCalendarPolicy, ManagedCalendarPolicyChoices, ManagedCalendarPreview, ManagedCalendarSetupChoices, ManagedCalendarState, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export function previewManagedCalendar(review: URLSearchParams, find: (id: string) => Occurrence | undefined, changed: () => void, connectionRevision: () => number, connected: () => boolean,
  importPreview: (candidateId: string, choices: CalendarImportChoices) => Promise<ManagedCalendarCandidatePreview>, importCandidate: (previewId: string, operationId: string, selections?: CalendarSelections) => Promise<unknown>) {
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  const error = (code: string): never => { throw Object.assign(new Error('Synthetic managed Calendar: ' + code), { code }); };
  const scenario = review.get('reviewManaged') || 'unconfigured', fresh = ['fresh', 'recovered'].includes(scenario);
  const configured = ['enabled', 'paused', 'recovered', 'candidate', 'unsupported', 'local-only', 'waiting', 'unknown', 'access', 'unavailable', 'ownership', 'initial-import', 'partial', 'copied', 'adoption'].includes(scenario);
  let state: ManagedCalendarState = { revision: 1, authEpoch: 1, mode: scenario === 'paused' ? 'Paused' : configured ? 'Enabled' : 'Disabled',
    phase: scenario === 'unknown' ? 'CreationUnconfirmed' : scenario === 'access' ? 'AccessRequired' : scenario === 'unavailable' ? 'CalendarUnavailable' : scenario === 'ownership' ? 'OwnershipUnknown' : scenario === 'initial-import' ? 'InitialImport' : configured ? 'Ready' : 'NotConfigured',
    subject: 'synthetic-account', calendarId: configured ? 'fixture-managed-calendar' : '', calendarName: configured ? 'Remilo / 测试日历' : '', calendarZone: 'America/Los_Angeles',
    policy: { revision: 1, automaticImport: true, exportNewReminders: true, importMode: 'Alarm', allDayAlarmMinutes: 540, disableGoogleReminders: false }, initialMode: fresh ? 'None' : 'Alarm',
    bootstrapGeneration: 1, initialRecoveryComplete: configured && !['unknown', 'initial-import'].includes(scenario), candidateCount: ['candidate', 'unsupported', 'copied'].includes(scenario) ? 1 : scenario === 'initial-import' ? 450 : 0, pendingExportCount: scenario === 'waiting' || scenario === 'partial' ? 1 : 0,
    heldExportCount: scenario === 'paused' ? 2 : 0, reviewCount: ['candidate', 'unsupported', 'unknown', 'access', 'unavailable'].includes(scenario) ? 1 : 0, lastObservedAtMs: configured ? Date.now() - 60_000 : null,
    message: 'Synthetic setup and policy. No external operations can run.', operationId: scenario === 'unknown' ? 'synthetic-calendar-creation' : null };
  const previews = new Map<string, ManagedCalendarPreview>(), receipts = new Map<string, { input: string; result: unknown }>(), dispositions = new Map<string, CalendarReminderDisposition>();
  let counter = 0, ignored = false;
  const savedDisposition = (id: string, disposition: CalendarCreationDisposition, status: CalendarReminderDisposition['state']) => {
    const item = find(id);
    dispositions.set(id, { occurrenceId: id, seriesId: item?.seriesId ?? null, revision: 1, disposition, state: status, calendarName: state.calendarName,
      message: status === 'Held' ? 'Local alerts continue. This family waits for reviewed resume.' : status === 'LocalOnly' ? 'Automatic import will not re-adopt this local work.' : 'Local saving and alerts do not wait for Calendar.' });
  };
  if (scenario === 'local-only') savedDisposition('review', 'LocalOnly', 'LocalOnly');
  if (scenario === 'waiting' || scenario === 'paused') savedDisposition('review', 'Managed', scenario === 'paused' ? 'Held' : 'WaitingToPublish');
  if (scenario === 'partial') savedDisposition('review', 'Managed', 'Publishing');
  const basePreview = (kind: ManagedCalendarPreview['kind'], choices?: ManagedCalendarSetupChoices | ManagedCalendarPolicyChoices): ManagedCalendarPreview => {
    if (!connected()) return error('NEEDS_ACCESS');
    const calendarCandidates = scenario === 'create' ? [] : [{ id: 'fixture-managed-calendar', name: scenario === 'renamed' ? 'My renamed reminders / 已更名日历' : 'Remilo / 测试日历', zoneId: state.calendarZone,
      recognition: scenario === 'renamed' ? 'Bound' as const : scenario === 'recognized' ? 'Recognized' as const : 'NameOnly' as const },
      ...(scenario === 'multiple' ? [{ id: 'fixture-managed-calendar-2', name: 'Remilo · Older calendar / 旧日历', zoneId: 'Asia/Shanghai', recognition: 'NameOnly' as const }] : [])];
    const selectedCalendarId = choices && 'selectedCalendarId' in choices ? choices.selectedCalendarId || (calendarCandidates.length === 1 ? calendarCandidates[0].id : '') : state.calendarId || (calendarCandidates.length === 1 ? calendarCandidates[0].id : '');
    const patch = choices && 'expectedRevision' in choices ? { automaticImport: choices.automaticImport ?? state.policy.automaticImport,
      exportNewReminders: choices.exportNewReminders ?? state.policy.exportNewReminders, importMode: choices.importMode ?? state.policy.importMode,
      allDayAlarmMinutes: choices.allDayAlarmMinutes ?? state.policy.allDayAlarmMinutes, disableGoogleReminders: choices.disableGoogleReminders ?? state.policy.disableGoogleReminders } : choices && 'policy' in choices ? choices.policy : {};
    const policy: ManagedCalendarPolicy = { ...state.policy, ...patch };
    const result: ManagedCalendarPreview = { previewId: 'synthetic-managed-preview-' + ++counter, kind, expectedRevision: state.revision, expectedConnectionRevision: connectionRevision(), expiresAtMs: Date.now() + 600_000,
      policy, initialMode: fresh && scenario !== 'create' ? 'None' : policy.importMode, calendarCandidates, selectedCalendarId,
      calendarZone: choices && 'calendarZone' in choices ? choices.calendarZone || state.calendarZone : state.calendarZone,
      createCalendar: calendarCandidates.length === 0, items: [], warnings: [], complete: scenario !== 'incomplete' && (scenario !== 'multiple' || !!selectedCalendarId) };
    if (kind === 'Setup') {
      if (selectedCalendarId) result.sample = { inspectedCount: 100, complete: false, items: [
        { title: 'Upcoming Google event / 即将到来的日历事项', description: 'Ongoing or upcoming event · alert timing is checked before import' },
        { title: 'Repeating Calendar reminder', description: 'Repeating event · native validation follows confirmation' }] };
      result.items = [{ itemId: 'incoming-future', kind: 'Import', candidateId: 'synthetic-incoming', title: 'A future Calendar reminder / 即将到来的提醒', calendarName: 'Remilo', ready: true,
        alertMode: result.initialMode, alertAtMs: Date.now() + 3_600_000 },
      { itemId: 'incoming-elapsed', kind: 'Import', candidateId: 'synthetic-elapsed', title: 'An ongoing event with an elapsed alert', calendarName: 'Remilo', ready: result.initialMode === 'None', reason: 'ElapsedAlert', alertMode: result.initialMode }];
      if (find('review')) result.items.push({ itemId: 'adopt-review', kind: 'Adopt', occurrenceId: 'review', title: find('review')!.title, ready: true, scope: 'Entire repeating family or reminder' });
    }
    if (kind === 'Resume') result.items = [...[...dispositions.values()].filter(value => value.state === 'Held').map(value => ({ itemId: 'export:' + value.occurrenceId, kind: 'Publish' as const, occurrenceId: value.occurrenceId,
      title: find(value.occurrenceId)?.title || 'Queued local reminder', ready: true, outbound: ['title', 'notes', 'schedule'] })),
      { itemId: 'transfer-review', kind: 'Transfer', occurrenceId: 'review', title: 'Both copies changed', ready: false, reason: 'ChangesNeedReview' }];
    if (kind === 'RecoveredAlerts') result.items = [{ itemId: 'recovered-review', kind: 'RecoveredAlert', occurrenceId: 'review', title: find('review')?.title || 'Recovered reminder / 恢复的提醒', ready: true, alertMode: 'Alarm', alertAtMs: Date.now() + 3_600_000 },
      { itemId: 'recovered-elapsed', kind: 'RecoveredAlert', title: 'Elapsed recovered alert', ready: false, reason: 'ElapsedAlert' }];
    if (kind === 'Policy') result.warnings.push('New defaults apply to newly captured imports. Existing reminders and captured work retain their choices.');
    previews.set(result.previewId, clone(result)); return clone(result);
  };
  const reviewIssues = (): CalendarReviewIssue[] => {
    const issues: CalendarReviewIssue[] = [];
    if (['candidate', 'unsupported', 'copied', 'adoption'].includes(scenario) && !ignored) issues.push({ kind: 'Candidate', issueId: 'synthetic-candidate-issue', candidateId: 'synthetic-incoming', revision: 1,
      title: scenario === 'unsupported' ? 'Unsupported meeting / 不支持的会议' : scenario === 'copied' ? 'Copied Calendar identity needs review' : scenario === 'adoption' ? 'Existing published copy needs linking review' : 'Incoming event needs a future alert',
      reason: scenario === 'unsupported' ? 'Unsupported' : ['copied', 'adoption'].includes(scenario) ? 'ReviewRequired' : 'ElapsedAlert', calendarName: state.calendarName, discoveredAtMs: Date.now() });
    if (['CreationUnconfirmed', 'AccessRequired', 'CalendarUnavailable', 'OwnershipUnknown'].includes(state.phase)) issues.push({ kind: 'Setup', issueId: 'synthetic-setup-issue', title: 'Remilo calendar setup',
      reason: state.phase === 'AccessRequired' ? 'AccessRequired' : state.phase === 'CreationUnconfirmed' ? 'UnconfirmedWrite' : state.phase === 'OwnershipUnknown' ? 'OwnershipUnknown' : 'RemoteUnavailable', discoveredAtMs: Date.now() });
    return issues;
  };
  return {
    getManagedCalendarState: async () => clone(state),
    getCalendarReminderDisposition: async (id: string) => clone(dispositions.get(id) ?? null),
    previewManagedCalendarSetup: async (choices: ManagedCalendarSetupChoices) => basePreview('Setup', choices),
    previewManagedCalendarPolicyChange: async (choices: ManagedCalendarPolicyChoices) => { if (choices.expectedRevision !== state.policy.revision) return error('STALE_REVISION'); return basePreview('Policy', choices); },
    previewManagedCalendarResume: async () => basePreview('Resume'),
    previewManagedCalendarRecoveredAlerts: async (_ids: string[]) => basePreview('RecoveredAlerts'),
    previewManagedCalendarCandidate: async (candidateId: string, choices: CalendarImportChoices) => { if (ignored) return error('NOT_FOUND'); if (scenario === 'unsupported') return error('UNSUPPORTED_RECURRENCE'); return importPreview(candidateId, choices); },
    captureCalendarCreation: (id: string, disposition: CalendarCreationDisposition = 'Default') => {
      if (disposition === 'LocalOnly') savedDisposition(id, disposition, 'LocalOnly');
      else if (state.mode !== 'Disabled' && state.calendarId && (disposition === 'Managed' || state.policy.exportNewReminders)) {
        savedDisposition(id, disposition, state.mode === 'Paused' ? 'Held' : 'WaitingToPublish');
        if (state.mode === 'Paused') state.heldExportCount++; else state.pendingExportCount++;
      }
    },
    getManagedCalendarIssues: reviewIssues,
    applyManagedCalendarCommand: async (command: ManagedCalendarCommand): Promise<unknown> => {
      const input = JSON.stringify(command), prior = receipts.get(command.operationId);
      if (prior) { if (prior.input !== input) return error('OPERATION_REUSED'); return clone(prior.result); }
      let result: unknown;
      if (command.kind === 'ImportManagedCalendarCandidate') { result = await importCandidate(command.previewId, command.operationId, command.selections); ignored = true; state.reviewCount = 0; }
      else if (command.kind === 'IgnoreManagedCalendarCandidate') { if (command.expectedRevision !== 1) return error('STALE_REVISION'); ignored = true; state.reviewCount = 0; result = { ignored: true }; }
      else if (command.kind === 'PauseManagedCalendar' || command.kind === 'DisableManagedCalendar') {
        if (command.expectedRevision !== state.revision) return error('STALE_REVISION');
        state = { ...state, revision: state.revision + 1, authEpoch: state.authEpoch + 1, mode: command.kind === 'PauseManagedCalendar' ? 'Paused' : 'Disabled' };
        for (const [id, value] of dispositions) if (['WaitingToPublish', 'Held'].includes(value.state)) dispositions.set(id, { ...value, state: state.mode === 'Disabled' ? 'LocalOnly' : 'Held' });
        result = state;
      }
      else if (command.kind === 'SetCalendarReminderDisposition') {
        const old = dispositions.get(command.occurrenceId); if (!old || old.revision !== command.expectedRevision) return error('STALE_REVISION');
        const next: CalendarReminderDisposition = { ...old, revision: old.revision + 1, disposition: command.disposition, state: command.disposition === 'LocalOnly' ? 'LocalOnly' : state.mode === 'Paused' ? 'Held' : 'WaitingToPublish' };
        dispositions.set(next.occurrenceId, next); result = next;
      } else if (command.kind === 'RetryManagedCalendarOperation') { state = { ...state, phase: 'Ready', mode: 'Enabled', operationId: null }; result = state; }
      else if ('previewId' in command) {
        const preview = previews.get(command.previewId); if (!preview || preview.expectedRevision !== state.revision || preview.expectedConnectionRevision !== connectionRevision() || preview.expiresAtMs <= Date.now()) return error('STALE_PREVIEW');
        if (!preview.complete || command.selectedItemIds.some(id => !preview.items.some(item => item.itemId === id && item.ready))) return error('INVALID_INPUT');
        if (command.kind === 'ConfirmManagedCalendarSetup' && command.selectedCalendarId !== preview.selectedCalendarId) return error('STALE_PREVIEW');
        state = { ...state, revision: state.revision + 1, policy: { ...preview.policy, revision: state.policy.revision + 1 },
          ...(command.kind === 'ConfirmManagedCalendarSetup' ? { mode: 'Enabled', phase: 'Ready', calendarId: preview.selectedCalendarId || 'fixture-created-calendar', calendarName: 'Remilo', initialMode: preview.initialMode, initialRecoveryComplete: true } : {}),
          ...(command.kind === 'ResumeManagedCalendar' ? { mode: 'Enabled', phase: 'Ready' } : {}) };
        if (command.kind === 'ResumeManagedCalendar') for (const [id, disposition] of dispositions) if (disposition.state === 'Held' && command.selectedItemIds.includes('export:' + id)) dispositions.set(id, { ...disposition, state: 'WaitingToPublish' });
        state.heldExportCount = [...dispositions.values()].filter(value => value.state === 'Held').length;
        result = state;
      } else return error('INVALID_INPUT');
      receipts.set(command.operationId, { input, result: clone(result) }); changed();
      if (review.get('reviewLostReply') === '1') throw new Error('Synthetic managed reply lost after capture.');
      return clone(result);
    },
  };
}
