export type Atmosphere = 'sunrise' | 'sky' | 'evening' | 'night';
export type AtmosphereSelection = Atmosphere | 'automatic';
export type Brightness = 'light' | 'dark';
export function normalizeAtmosphere(value: unknown): AtmosphereSelection {
  return value === 'sunrise' || value === 'sky' || value === 'evening' || value === 'night' ? value : 'automatic';
}
export function resolveAtmosphere(selection: unknown, now: Date): Atmosphere {
  const manual = normalizeAtmosphere(selection);
  if (manual !== 'automatic') return manual;
  const hour = now.getHours();
  return hour >= 6 && hour < 10 ? 'sunrise' : hour >= 10 && hour < 17 ? 'sky' : hour >= 17 && hour < 21 ? 'evening' : 'night';
}
export function nextAppearanceBoundary(now: Date): number {
  const next = new Date(now);
  const hour = [6,10,17,21].find(value => value > now.getHours());
  if (hour === undefined) { next.setDate(next.getDate() + 1); next.setHours(6,0,0,0); }
  else next.setHours(hour,0,0,0);
  return Math.max(1, next.getTime() - now.getTime());
}
/** Only automatic updates wait; explicit preference selections remain immediate. */
export class AppearanceTransitions {
  private holds = new Set<symbol>();
  private current: Atmosphere;
  private desired: Atmosphere;
  constructor(initial: Atmosphere) { this.current = initial; this.desired = initial; }
  hold() { const token = Symbol(); this.holds.add(token); return token; }
  release(token: symbol) { this.holds.delete(token); if (!this.holds.size) this.current = this.desired; return this.current; }
  update(scene: Atmosphere, explicit = false) { this.desired = scene; if (explicit || !this.holds.size) this.current = scene; return this.current; }
  get value() { return this.current; }
}
