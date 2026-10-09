import { describe, expect, it } from 'vitest';
import { collectionKey, creationOrigin, destinationRoute, familyBackRoute, familyOriginParams, listOriginParams, originParams, readRootSnapshot, reminderListRoute, rootKey, rootRoute, secondaryOriginRoute, writeRootSnapshot } from './navigation';
describe('root navigation and creation context', () => {
  it('keeps global collections separate even though they share a route', () => {
    expect(rootKey({ kind: 'completed' })).not.toBe(rootKey({ kind: 'trash' }));
    expect(rootRoute({ kind: 'trash' })).toEqual({ pathname: '/records', params: { view: 'deleted' } });
    writeRootSnapshot('test-completed', { search: 'bill' });
    expect(readRootSnapshot('test-trash', { search: '' })).toEqual({ search: '' });
  });
  it('retains every root and fixed-list secondary origin', () => {
    for (const kind of ['agenda', 'lists', 'completed', 'trash', 'repeats'] as const) expect(creationOrigin(originParams({ kind }))).toEqual({ kind });
    expect(rootRoute({ kind: 'lists' })).toEqual({ pathname: '/lists' });
    expect(creationOrigin(originParams({ kind: 'list', listId: 'work' }))).toEqual({ kind: 'list', listId: 'work' });
    expect(collectionKey('completed')).not.toBe(collectionKey('deleted'));
    expect(collectionKey('completed', null)).not.toBe(collectionKey('completed', 'none'));
  });
  it('returns nested pages to occurrence, family, and scoped collection fallbacks in order', () => {
    const params = { originRoot: 'lists', originListId: 'work', originCollection: 'deleted', originFamily: 'family', originSegmentId: 'segment', originReminderId: 'reminder' };
    expect(secondaryOriginRoute(params)).toEqual({ pathname: '/reminder/[id]', params: { id: 'reminder', originRoot: 'lists', originListId: 'work', originCollection: 'deleted', originFamily: 'family', originSegmentId: 'segment' } });
    expect(secondaryOriginRoute({ ...params, originReminderId: undefined }).pathname).toBe('/series/[id]');
    expect(secondaryOriginRoute({ originListId: 'work', originCollection: 'deleted' })).toEqual({ pathname: '/records', params: { view: 'deleted', originListId: 'work' } });
    expect(secondaryOriginRoute({ ...params, id: 'current-route', action: 'postpone' } as typeof params)).toEqual(secondaryOriginRoute(params));
  });
  it('returns a stackless family child through the family to its retained collection and membership', () => {
    for (const view of ['completed', 'deleted'] as const) for (const membership of [{ originRoot: 'agenda' }, { originListId: 'work' }, { originNoList: 'true' }]) {
      const origin = { ...membership, originCollection: view, originReminderId: 'prior-reminder' };
      const child = familyOriginParams(origin, 'family', 'segment');
      expect(secondaryOriginRoute(child)).toEqual({ pathname: '/series/[id]', params: { id: 'segment', seriesId: 'family', ...membership, originCollection: view } });
      expect(familyBackRoute(child)).toEqual({ pathname: '/records', params: { view, ...membership } });
      expect(origin.originReminderId).toBe('prior-reminder');
    }
  });
  it('consumes a family context without leaking current-route IDs into the previous reminder fallback', () => {
    const family = { originFamily: 'family', originSegmentId: 'segment', originReminderId: 'source-reminder', originCollection: 'deleted', originNoList: 'true', id: 'current-family-route' };
    expect(familyBackRoute(family)).toEqual({ pathname: '/reminder/[id]', params: { id: 'source-reminder', originCollection: 'deleted', originNoList: 'true', originFamily: undefined, originSegmentId: undefined } });
  });
  it('returns a stackless membership link to its reminder, then the original collection without a self-return', () => {
    for (const target of ['current-list', 'none', null]) for (const view of ['completed', 'deleted'] as const) {
      const origin = { originListId: 'source-list', originCollection: view, originReminderId: 'predecessor-reminder', id: 'current-route', action: 'postpone' };
      const list = reminderListRoute(target, 'invoking-reminder', origin);
      expect(list).toEqual({ pathname: '/lists/[id]', params: { id: target ?? 'none', ...(target === null ? { noList: 'true' } : {}), originListId: 'source-list', originCollection: view, originReminderId: 'invoking-reminder' } });
      const reminder = secondaryOriginRoute(list.params);
      expect(reminder).toEqual({ pathname: '/reminder/[id]', params: { id: 'invoking-reminder', originListId: 'source-list', originCollection: view, originFamily: undefined, originSegmentId: undefined } });
      if (reminder.pathname !== '/reminder/[id]') throw new Error('Membership fallback must return the invoking reminder.');
      expect(secondaryOriginRoute(reminder.params)).toEqual({ pathname: '/records', params: { view, originListId: 'source-list' } });
    }
  });
  it('distinguishes No list creation from ordinary Agenda creation', () => {
    expect(creationOrigin({})).toEqual({ kind: 'agenda' });
    expect(creationOrigin(listOriginParams(null))).toEqual({ kind: 'list', listId: null });
    expect(destinationRoute(creationOrigin({ originListId: 'work' }))).toEqual({ pathname: '/lists/[id]', params: { id: 'work' } });
  });
  it('keeps a named list ID of none distinct from No list', () => {
    expect(creationOrigin(listOriginParams('none'))).toEqual({ kind: 'list', listId: 'none' });
    expect(rootKey({ kind: 'list', listId: 'none' })).not.toBe(rootKey({ kind: 'list', listId: null }));
    expect(destinationRoute({ kind: 'list', listId: 'none' })).toEqual({ pathname: '/lists/[id]', params: { id: 'none' } });
    expect(destinationRoute({ kind: 'list', listId: null })).toEqual({ pathname: '/lists/[id]', params: { id: 'none', noList: 'true' } });
  });
  it('retains an explicit No list filter in destination snapshots', () => {
    writeRootSnapshot('test-null-membership', null);
    expect(readRootSnapshot('test-null-membership', undefined)).toBeNull();
  });
  it('retains secondary Repeats through family and occurrence fallback and accepts legacy links', () => {
    const origin = originParams({kind:'repeats'});
    expect(origin).toEqual({originRoot:'lists',originView:'repeats'});
    expect(creationOrigin({originRoot:'repeats'})).toEqual({kind:'repeats'});
    const family = familyOriginParams(origin,'family','segment');
    expect(secondaryOriginRoute(family).pathname).toBe('/series/[id]');
    expect(familyBackRoute(family)).toEqual({pathname:'/series'});
    for(const kind of ['completed','trash'] as const)expect(creationOrigin(originParams({kind}))).toEqual({kind});
  });
});
