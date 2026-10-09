export type HandoffTicket = Readonly<{ pageRevision: number; foregroundRevision: number; activeAtCapture: boolean }>;

/** A read-only handoff may finish; it must not open UI for a departed page. */
export class HandoffScope {
  private pageRevision = 0;
  private foregroundRevision = 0;
  private focused = false;
  private foreground: boolean;
  private opened = new WeakSet<HandoffTicket>();

  constructor(foreground: boolean) { this.foreground = foreground; }
  focus(value: boolean) {
    if (this.focused && !value) this.pageRevision += 1;
    this.focused = value;
  }
  foregroundChanged(value: boolean) {
    if (this.foreground && !value) this.foregroundRevision += 1;
    this.foreground = value;
  }
  capture(): HandoffTicket { return { pageRevision: this.pageRevision, foregroundRevision: this.foregroundRevision, activeAtCapture: this.active() }; }
  active() { return this.focused && this.foreground; }
  current(ticket: HandoffTicket) {
    return ticket.activeAtCapture && this.focused && ticket.pageRevision === this.pageRevision &&
      (this.opened.has(ticket) || ticket.foregroundRevision === this.foregroundRevision);
  }
  canLaunch(ticket: HandoffTicket) {
    return ticket.activeAtCapture && this.active() && ticket.pageRevision === this.pageRevision && ticket.foregroundRevision === this.foregroundRevision;
  }
  markOpened(ticket: HandoffTicket) {
    if (!this.canLaunch(ticket)) return false;
    this.opened.add(ticket);
    return true;
  }
  canPublish(ticket: HandoffTicket) { return this.active() && this.current(ticket); }
}
