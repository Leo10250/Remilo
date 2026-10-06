export type RootDestination = { kind: 'agenda' | 'repeats' | 'completed' | 'trash' } | { kind: 'list'; listId: string | null };
export function rootKey(destination: RootDestination): string {
  return destination.kind === 'list' ? `list:${JSON.stringify(destination.listId)}` : destination.kind;
}
export function rootRoute(destination: RootDestination) {
  if (destination.kind === 'list') return { pathname: '/lists/[id]' as const, params: { id: destination.listId ?? 'none', ...(destination.listId === null ? { noList: 'true' } : {}) } };
  if (destination.kind === 'repeats') return { pathname: '/series' as const };
  if (destination.kind === 'completed' || destination.kind === 'trash') return { pathname: '/records' as const, params: { view: destination.kind === 'trash' ? 'deleted' : 'completed' } };
  return { pathname: '/' as const };
}
export function listOriginParams(listId: string | null) {
  return listId === null ? { originNoList: 'true' } : { originListId: listId };
}
export function creationOrigin(params: { originListId?: string; originNoList?: string }): RootDestination {
  return params.originNoList === 'true' ? { kind: 'list', listId: null } : params.originListId === undefined ? { kind: 'agenda' } : { kind: 'list', listId: params.originListId };
}
// Foreground presentation snapshots only: never persistence or scheduling authority.
const snapshots = new Map<string, unknown>();
export function readRootSnapshot<T>(key: string, fallback: T): T { return snapshots.has(key) ? snapshots.get(key) as T : fallback; }
export function writeRootSnapshot<T>(key: string, value: T) { snapshots.set(key, value); }
