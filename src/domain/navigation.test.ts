import { describe, expect, it } from 'vitest';
import { creationOrigin, listOriginParams, readRootSnapshot, rootKey, rootRoute, writeRootSnapshot } from './navigation';
describe('root navigation and creation context', () => {
  it('keeps historical roots separate even though they share a route', () => {
    expect(rootKey({ kind: 'completed' })).not.toBe(rootKey({ kind: 'trash' }));
    expect(rootRoute({ kind: 'trash' })).toEqual({ pathname: '/records', params: { view: 'deleted' } });
    writeRootSnapshot('test-completed', { search: 'bill' });
    expect(readRootSnapshot('test-trash', { search: '' })).toEqual({ search: '' });
  });
  it('distinguishes No list creation from ordinary Agenda creation', () => {
    expect(creationOrigin({})).toEqual({ kind: 'agenda' });
    expect(creationOrigin(listOriginParams(null))).toEqual({ kind: 'list', listId: null });
    expect(rootRoute(creationOrigin({ originListId: 'work' }))).toEqual({ pathname: '/lists/[id]', params: { id: 'work' } });
  });
  it('keeps a named list ID of none distinct from No list', () => {
    expect(creationOrigin(listOriginParams('none'))).toEqual({ kind: 'list', listId: 'none' });
    expect(rootKey({ kind: 'list', listId: 'none' })).not.toBe(rootKey({ kind: 'list', listId: null }));
    expect(rootRoute({ kind: 'list', listId: 'none' })).toEqual({ pathname: '/lists/[id]', params: { id: 'none' } });
    expect(rootRoute({ kind: 'list', listId: null })).toEqual({ pathname: '/lists/[id]', params: { id: 'none', noList: 'true' } });
  });
  it('retains an explicit No list filter in destination snapshots', () => {
    writeRootSnapshot('test-null-membership', null);
    expect(readRootSnapshot('test-null-membership', undefined)).toBeNull();
  });
});
