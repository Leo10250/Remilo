export type RootDestination = { kind: 'agenda' | 'lists' | 'repeats' };
export type DestinationOrigin = RootDestination | { kind: 'list'; listId: string | null };
export type Destination = DestinationOrigin | { kind: 'completed' | 'trash' };
export type OriginParams = { originRoot?: string; originListId?: string; originNoList?: string; originCollection?: string; originFamily?: string; originSegmentId?: string; originReminderId?: string };
export function rootKey(destination: Destination): string {
  return destination.kind === 'list' ? `list:${JSON.stringify(destination.listId)}` : destination.kind;
}
export function rootRoute(destination: Destination) {
  if (destination.kind === 'list') return { pathname: '/lists/[id]' as const, params: { id: destination.listId ?? 'none', ...(destination.listId === null ? { noList: 'true' } : {}) } };
  if (destination.kind === 'repeats') return { pathname: '/series' as const };
  if (destination.kind === 'lists') return { pathname: '/lists' as const };
  if (destination.kind === 'completed' || destination.kind === 'trash') return { pathname: '/records' as const, params: { view: destination.kind === 'trash' ? 'deleted' : 'completed' } };
  return { pathname: '/' as const };
}
export function listOriginParams(listId: string | null) {
  return listId === null ? { originNoList: 'true' } : { originListId: listId };
}
/** List membership is a secondary link whose fallback returns to this reminder. */
export function reminderListRoute(listId: string | null, reminderId: string, params: OriginParams) {
  return { pathname: '/lists/[id]' as const, params: { id: listId ?? 'none', ...(listId === null ? { noList: 'true' } : {}),
    ...retainedOriginParams(params), originReminderId: reminderId } };
}
export function creationOrigin(params: OriginParams): DestinationOrigin {
  if (params.originNoList === 'true') return { kind: 'list', listId: null };
  if (params.originListId !== undefined) return { kind: 'list', listId: params.originListId };
  return { kind: params.originRoot === 'lists' || params.originRoot === 'repeats' ? params.originRoot : 'agenda' };
}
export function originParams(origin: DestinationOrigin): OriginParams {
  return origin.kind === 'list' ? listOriginParams(origin.listId) : { originRoot: origin.kind };
}
export function retainedOriginParams(params: OriginParams): OriginParams {
  const retained: OriginParams = {};
  for (const key of ['originRoot', 'originListId', 'originNoList', 'originCollection', 'originFamily', 'originSegmentId', 'originReminderId'] as const)
    if (typeof params[key] === 'string') retained[key] = params[key];
  return retained;
}
/** Stack Back is preferred; these explicit params give nested pages an honest fallback. */
export function secondaryOriginRoute(params: OriginParams) {
  const { originReminderId, originFamily, originSegmentId, originCollection, ...rootParams } = retainedOriginParams(params);
  if (originReminderId) return { pathname: '/reminder/[id]' as const, params: { id: originReminderId, ...rootParams, originFamily, originSegmentId, originCollection } };
  if (originFamily && originSegmentId) return { pathname: '/series/[id]' as const, params: { id: originSegmentId, seriesId: originFamily, ...rootParams, originCollection } };
  if (originCollection === 'completed' || originCollection === 'deleted') return { pathname: '/records' as const, params: { view: originCollection, ...rootParams } };
  return rootRoute(creationOrigin(rootParams));
}
/** A family child returns to that family, retaining its underlying collection scope. */
export function familyOriginParams(params: OriginParams, familyId: string, segmentId: string): OriginParams {
  const retained = retainedOriginParams(params);
  delete retained.originReminderId;
  return { ...retained, originFamily: familyId, originSegmentId: segmentId };
}
/** A family's own fallback must consume its context rather than return to itself. */
export function familyBackRoute(params: OriginParams) {
  const retained = retainedOriginParams(params);
  delete retained.originFamily; delete retained.originSegmentId;
  return secondaryOriginRoute(retained);
}
export function collectionKey(view: 'completed' | 'deleted', fixedListId?: string | null) {
  return (view === 'deleted' ? 'trash' : 'completed') + (fixedListId !== undefined ? ':list:' + JSON.stringify(fixedListId) : '');
}
// Foreground presentation snapshots only: never persistence or scheduling authority.
const snapshots = new Map<string, unknown>();
export function readRootSnapshot<T>(key: string, fallback: T): T { return snapshots.has(key) ? snapshots.get(key) as T : fallback; }
export function writeRootSnapshot<T>(key: string, value: T) { snapshots.set(key, value); }
