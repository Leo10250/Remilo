export type RoutineSessionRequest = { routineId: string; date: string | null; epoch: number };

/** Unresolved lookups belong to one view; resolved days share the native dated cache. */
export function routineSessionQueryKey(request: RoutineSessionRequest, viewId: string) {
  return request.date === null ? ['routine-session', request.routineId, null, viewId, request.epoch] as const :
    ['routine-session', request.routineId, request.date] as const;
}

/** A mounted view keeps the first native-resolved day until Open today is explicit. */
export class RoutineSessionViewDates {
  private dates = new Map<string, string>();
  private epoch = 0;

  request(routineId: string, date?: string): RoutineSessionRequest {
    return { routineId, date: date ?? this.dates.get(routineId) ?? null, epoch: this.epoch };
  }

  resolve(request: RoutineSessionRequest, date: string): boolean {
    if (request.epoch !== this.epoch || request.date !== null || this.dates.has(request.routineId)) return false;
    this.dates.set(request.routineId, date);
    return true;
  }

  openToday(routineId: string) {
    this.epoch += 1;
    this.dates.delete(routineId);
  }
}
