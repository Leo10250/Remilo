import { describe, expect, it } from 'vitest';
import { HandoffScope } from './handoff';

describe('read-only platform handoff lifetime', () => {
  it('does not launch for a page that has left and returned', () => {
    const scope = new HandoffScope(true); scope.focus(true);
    const ticket = scope.capture(); expect(scope.canLaunch(ticket)).toBe(true);
    scope.focus(false); scope.focus(true);
    expect(scope.canLaunch(ticket)).toBe(false); expect(scope.canPublish(ticket)).toBe(false);
    expect(scope.canLaunch(scope.capture())).toBe(true);
  });
  it('does not launch after backgrounding during asynchronous preparation', () => {
    const scope = new HandoffScope(true); scope.focus(true);
    const ticket = scope.capture();
    scope.foregroundChanged(false); scope.foregroundChanged(true);
    expect(scope.canLaunch(ticket)).toBe(false); expect(scope.markOpened(ticket)).toBe(false);
  });
  it('keeps an already-opened captured share for foreground return', () => {
    const scope = new HandoffScope(true); scope.focus(true);
    const ticket = scope.capture(); expect(scope.markOpened(ticket)).toBe(true);
    scope.foregroundChanged(false);
    expect(scope.current(ticket)).toBe(true); expect(scope.canPublish(ticket)).toBe(false);
    scope.foregroundChanged(true); expect(scope.canPublish(ticket)).toBe(true);
  });
  it('invalidates even an opened share after its page has left', () => {
    const scope = new HandoffScope(true); scope.focus(true);
    const ticket = scope.capture(); scope.markOpened(ticket);
    scope.focus(false); scope.focus(true);
    expect(scope.current(ticket)).toBe(false);
  });
  it('requires both focus and foreground before opening UI', () => {
    const scope = new HandoffScope(false);
    const ticket = scope.capture(); expect(scope.canLaunch(ticket)).toBe(false);
    scope.focus(true); expect(scope.canLaunch(ticket)).toBe(false);
    scope.foregroundChanged(true); expect(scope.canLaunch(ticket)).toBe(false);
    expect(scope.canLaunch(scope.capture())).toBe(true);
  });
});
