/** Civil strings are presentation drafts; native java.time resolves scheduling instants. */
export function deviceZone() { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
export function civilAt(instantMs: number, zoneId = deviceZone()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zoneId, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instantMs));
  const part = (name: string) => parts.find((item) => item.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}
export function pickerCivil(timestamp: number, utcOffsetMinutes: number) {
  return new Date(timestamp + utcOffsetMinutes * 60_000).toISOString().slice(0, 19);
}
export function mergeCivil(base: string, selected: string, mode: 'date' | 'time') {
  return mode === 'date' ? selected.slice(0, 10) + base.slice(10) : base.slice(0, 10) + selected.slice(10, 16) + ':00';
}
