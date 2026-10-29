import { captureFeedback, presentFeedback, t } from '../localization';

export type ConfirmationButton = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
export type ConfirmationOptions = { cancelable?: boolean; onDismiss?: () => void };
export type ConfirmationContent = { title: string; message?: string; buttons: ConfirmationButton[]; options?: ConfirmationOptions };
type FocusTarget = { focus: () => void; isConnected?: boolean };
export type ConfirmationEntry = { readonly id: number; readonly owner: symbol; readonly payload: unknown; readonly returnFocus?: FocusTarget };

/** Process-only presentation. Captured callbacks never enter native commands or storage. */
export class ConfirmationState {
  private current: ConfirmationEntry | null = null;
  private sequence = 0;
  private listeners = new Set<() => void>();
  private focused?: FocusTarget;
  getSnapshot = () => this.current;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { this.listeners.forEach(listener => listener()); }
  rememberFocus(target: unknown) {
    if (!this.current && target && typeof target === 'object' && 'focus' in target && typeof target.focus === 'function') this.focused = target as FocusTarget;
  }
  present(owner: symbol, title: string, message?: string, buttons?: ConfirmationButton[], options?: ConfirmationOptions) {
    // Repeated Back/Close cannot replace the navigation/action already being reviewed.
    if (this.current) return;
    this.current = { id: ++this.sequence, owner, payload: captureFeedback({ title, message,
      buttons: buttons?.length ? buttons : [{ text: t('m_565339bc4d33') }], options }), returnFocus: this.focused };
    this.emit();
  }
  content(entry: ConfirmationEntry) { return presentFeedback<ConfirmationContent>(entry.payload); }
  choose(id: number, index: number) {
    const entry = this.current;
    if (!entry || entry.id !== id) return;
    const { buttons } = this.content(entry), button = buttons[index];
    if (!button) return;
    this.finish(entry, button.style === 'cancel' || buttons.length === 1 && button.style !== 'destructive' && !button.onPress);
    button.onPress?.();
  }
  dismiss(id: number) {
    const entry = this.current;
    if (!entry || entry.id !== id) return;
    const { buttons, options } = this.content(entry);
    if (options?.cancelable === false) return;
    const cancel = buttons.find(button => button.style === 'cancel');
    this.finish(entry, true);
    // Back/backdrop have the same safe outcome as the labeled cancellation.
    cancel?.onPress?.(); options?.onDismiss?.();
  }
  private restore: { id: number; target?: FocusTarget } | null = null;
  private finish(entry: ConfirmationEntry, returnFocus: boolean) {
    this.current = null;
    this.restore = returnFocus ? { id: entry.id, target: entry.returnFocus } : null;
    this.emit();
  }
  restoreTarget() { return this.current ? null : this.restore; }
  canRestore(id: number) { return !this.current && this.sequence === id && this.restore?.id === id; }
  release(owner: symbol) {
    if (this.current?.owner !== owner) return;
    // An unmounted route must never execute a retained action or steal focus.
    this.current = null; this.restore = null; this.emit();
  }
}

export const confirmations = new ConfirmationState();
export const rememberConfirmationFocus = (target: unknown) => confirmations.rememberFocus(target);
