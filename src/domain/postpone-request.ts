import type { SessionActionMember } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export type PostponeRequest =
  | { kind: 'Single'; occurrenceId: string; expectedGeneration: number }
  | { kind: 'Group'; expectedSessionId: string; members: SessionActionMember[] };
type ParsedRequest = { kind: 'valid'; request: PostponeRequest } | { kind: 'invalid' } | { kind: 'absent' };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).length === allowed.length && allowed.every(key => Object.hasOwn(value, key));
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256 && value.trim() === value && !/[\u0000-\u001f]/.test(value);
const generation = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
/** Routes carry operational identities only, never authored content or a time target. */
export function parsePostponeRequest(value: string | string[] | undefined): ParsedRequest {
  if (value === undefined) return { kind: 'absent' };
  if (typeof value !== 'string') return { kind: 'invalid' };
  try {
    const item: unknown = JSON.parse(value);
    if (!record(item)) return { kind: 'invalid' };
    if (item.kind === 'Single' && keys(item, ['kind', 'occurrenceId', 'expectedGeneration']) && identifier(item.occurrenceId) && generation(item.expectedGeneration))
      return { kind: 'valid', request: { kind: 'Single', occurrenceId: item.occurrenceId, expectedGeneration: item.expectedGeneration } };
    if (item.kind !== 'Group' || !keys(item, ['kind', 'expectedSessionId', 'members']) || !identifier(item.expectedSessionId) || !Array.isArray(item.members) || !item.members.length) return { kind: 'invalid' };
    const members: SessionActionMember[] = [];
    for (const member of item.members) {
      if (!record(member) || !keys(member, ['occurrenceId', 'expectedGeneration']) || !identifier(member.occurrenceId) || !generation(member.expectedGeneration) || members.some(previous => previous.occurrenceId === member.occurrenceId)) return { kind: 'invalid' };
      members.push({ occurrenceId: member.occurrenceId, expectedGeneration: member.expectedGeneration });
    }
    return { kind: 'valid', request: { kind: 'Group', expectedSessionId: item.expectedSessionId, members } };
  } catch { return { kind: 'invalid' }; }
}
export function copyPostponeRequest(request: PostponeRequest): PostponeRequest {
  return request.kind === 'Single' ? { ...request } : { ...request, members: request.members.map(member => ({ ...member })) };
}
export function postponeRequestIdentity(request: PostponeRequest) {
  return JSON.stringify(request.kind === 'Single' ? request : { ...request, members: [...request.members].sort((a, b) => a.occurrenceId.localeCompare(b.occurrenceId)) });
}
/** Expo invokes native-intent for cold links and every warm event, including an identical URL. */
export function redirectPostponeSystemPath(path: string, eventKey: string): string {
  try {
    const url = new URL(path, 'remilo:///');
    if (url.protocol !== 'remilo:' || url.hostname || !['', '/'].includes(url.pathname) || !url.searchParams.has('postponeRequest')) return path;
    url.searchParams.set('postponeRequestKey', eventKey);
    return '/?' + url.searchParams.toString();
  } catch { return path; }
}


type PostponeLinkEvent = { value: string | string[]; key: string };
let incoming: PostponeLinkEvent | null = null;
const linkListeners = new Set<() => void>();
export function postPostponeLink(value: string | string[], key: string) {
  incoming = { value, key }; linkListeners.forEach(listener => listener());
}
export function takePostponeLink() { const value = incoming; incoming = null; return value; }
export function subscribePostponeLinks(listener: () => void) { linkListeners.add(listener); return () => { linkListeners.delete(listener); }; }
