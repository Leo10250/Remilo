import { describe, expect, it } from 'vitest';
import { parsePostponeRequest, postPostponeLink, redirectPostponeSystemPath, subscribePostponeLinks, takePostponeLink } from './postpone-request';

const single = { kind: 'Single', occurrenceId: 'one', expectedGeneration: 7 };
const group = { kind: 'Group', expectedSessionId: 'session', members: [{ occurrenceId: 'one', expectedGeneration: 7 }, { occurrenceId: 'two', expectedGeneration: 3 }] };
describe('notification Postpone operational routes', () => {
  it('parses copied single and captured group identities without a time target', () => {
    expect(parsePostponeRequest(JSON.stringify(single))).toEqual({ kind: 'valid', request: single });
    expect(parsePostponeRequest(JSON.stringify(group))).toEqual({ kind: 'valid', request: group });
    expect(parsePostponeRequest(undefined)).toEqual({ kind: 'absent' });
  });
  it.each([null, true, [], {}, { ...single, title: 'private content' }, { ...single, alarmAtMs: 1 }, { ...single, expectedGeneration: -1 }, { ...single, expectedGeneration: 1.5 }, { ...single, expectedGeneration: Number.MAX_SAFE_INTEGER + 1 }, { ...single, occurrenceId: ' ' }, { ...group, members: [] }, { ...group, expectedSessionId: '' }, { ...group, members: [group.members[0], group.members[0]] }, { ...group, members: [{ ...group.members[0], title: 'private' }] }])('rejects malformed or broadened requests: %j', item => {
    expect(parsePostponeRequest(JSON.stringify(item))).toEqual({ kind: 'invalid' });
  });
  it('rejects malformed JSON and duplicate query values', () => {
    expect(parsePostponeRequest('{')).toEqual({ kind: 'invalid' });
    expect(parsePostponeRequest([JSON.stringify(single)])).toEqual({ kind: 'invalid' });
    expect(parsePostponeRequest(' '.repeat(65537))).toEqual({ kind: 'invalid' });
    const largeGroup = { ...group, members: Array.from({ length: 513 }, (_, index) => ({ occurrenceId: 'occurrence-' + index + '-'.repeat(128), expectedGeneration: 1 })) };
    expect(parsePostponeRequest(JSON.stringify(largeGroup))).toEqual({ kind: 'valid', request: largeGroup });
  });
  it('routes cold/warm and identical repeated events to Home with independent presentation keys', () => {
    const uri = 'remilo:///?postponeRequest=' + encodeURIComponent(JSON.stringify(group));
    const first = redirectPostponeSystemPath(uri, 'cold-1'), second = redirectPostponeSystemPath(uri, 'warm-2');
    expect(first).not.toBe(second);
    for (const route of [first, second]) {
      const value = new URL(route, 'remilo:///');
      expect(value.pathname).toBe('/');
      expect(parsePostponeRequest(value.searchParams.get('postponeRequest')!)).toEqual({ kind: 'valid', request: group });
    }
    expect(new URL(second, 'remilo:///').searchParams.get('postponeRequestKey')).toBe('warm-2');
  });
  it('keeps invalid Home requests available for localized feedback and preserves unrelated routes', () => {
    const invalid = redirectPostponeSystemPath('remilo:///?postponeRequest=%7B&originRoot=agenda', 'event');
    expect(new URL(invalid, 'remilo:///').searchParams.get('postponeRequest')).toBe('{');
    expect(invalid).toContain('originRoot=agenda');
    for (const route of ['remilo:///routine-session?id=r', 'remilo://routine-session?id=r', 'https://example.test/?postponeRequest=x', 'remilo:///']) expect(redirectPostponeSystemPath(route, 'event')).toBe(route);
  });
});


describe('pre-navigation Postpone link inbox', () => {
  it('retains a cold event until the owner mounts and consumes it only once', () => {
    postPostponeLink(JSON.stringify(single), 'cold');
    expect(takePostponeLink()).toEqual({ value: JSON.stringify(single), key: 'cold' });
    expect(takePostponeLink()).toBeNull();
  });
  it('delivers a warm event before navigation and keeps identical taps as independent events', () => {
    const received: string[] = [];
    const stop = subscribePostponeLinks(() => { const event = takePostponeLink(); if (event) received.push(event.key); });
    postPostponeLink(JSON.stringify(single), 'first'); postPostponeLink(JSON.stringify(single), 'second'); stop();
    expect(received).toEqual(['first', 'second']); expect(takePostponeLink()).toBeNull();
  });
});
