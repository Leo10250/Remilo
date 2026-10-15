import { t } from '../localization';
import type { CalendarEventPage, CalendarEventQuery, CalendarLink, CalendarLinkedOperation } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { civilAt } from './time';

/** Inclusive labels at the UI boundary; Google retains its exclusive upper bound. */
export function calendarImportRange(start: number, end: number, zoneId: string) {
  const from = civilAt(start, zoneId).slice(0, 10), through = civilAt(end, zoneId).slice(0, 10);
  const last = new Date(through + 'T00:00:00Z'); last.setUTCDate(last.getUTCDate() + 1);
  const until = last.toISOString().slice(0, 10);
  const days = (Date.parse(until) - Date.parse(from)) / 86_400_000;
  return { from, until, days, valid: days >= 1 && days <= 366 };
}
export function orderedCalendarImportDates(start: number, end: number, changed: 'start' | 'end', value: number) {
  return changed === 'start' ? { start: value, end: Math.max(value, end) } : { start: Math.min(start, value), end: value };
}
export function excludedCalendarImports(calendarId: string, links: CalendarLink[], operations: CalendarLinkedOperation[]) {
  const ids = new Set<string>();
  for (const link of links) if (link.source?.calendarId === calendarId) ids.add(link.source.eventId);
  for (const job of operations) if (job.source?.calendarId === calendarId && (job.localApplied || ['Waiting', 'Sending', 'Unconfirmed', 'NeedsAccess', 'Blocked'].includes(job.state))) ids.add(job.source.eventId);
  return ids;
}
export function remainingCalendarImports(items: CalendarEventPage['items'], excluded: Set<string>) {
  return items.filter(item => !item.occurrenceId && !item.erased && !excluded.has(item.eventId));
}

/** Add all covers every page, including pages with no supported entries. */
export async function collectCalendarImports(query: CalendarEventQuery, revision: number,
  list: (query: CalendarEventQuery) => Promise<CalendarEventPage>, excluded: Set<string>,
  active: () => boolean, progress: (count: number) => void) {
  const events = new Map<string, CalendarEventPage['items'][number]>(), cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    if (!active()) throw Object.assign(new Error(t('m_519921d54110')), { code: 'CANCELLED' });
    const page = await list({ ...query, cursor });
    if (!active()) throw Object.assign(new Error(t('m_519921d54110')), { code: 'CANCELLED' });
    if (page.connectionRevision !== revision) throw Object.assign(new Error(t('m_ee6c6ad65095')), { code: 'STALE_CONNECTION' });
    for (const event of remainingCalendarImports(page.items, excluded)) if (!event.unsupportedReason) events.set(event.eventId, event);
    if (events.size > 500) throw Object.assign(new Error(t('m_5177d17292cf')), { code: 'IMPORT_LIMIT' });
    progress(events.size);
    cursor = page.nextCursor;
    if (cursor) {
      if (cursors.has(cursor) || cursors.size >= 1000) throw Object.assign(new Error(t('m_8a9efb1c03d6')), { code: 'STALE_CURSOR' });
      cursors.add(cursor);
    }
  } while (cursor);
  return [...events.values()];
}
