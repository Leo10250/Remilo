import { catalogs, type MessageKey, type MessageArguments } from './catalog.generated';
export type { MessageKey } from './catalog.generated';
export type LanguagePreference = 'system' | 'en' | 'zh-Hans';
export type SupportedLanguage = 'en' | 'zh-Hans';
export type LocalizedMessage = { key: MessageKey; args?: Record<string, string | number> };
export type Translator = typeof t;

// The native-confirmed presentation snapshot is the only imperative UI locale.
// React subscribes to the same store; language never enters a scheduling command.
let language: SupportedLanguage = 'en';
const listeners = new Set<() => void>();
const retained = new Map<string, LocalizedMessage>();
export const currentLanguage = () => language;
export const subscribeLanguage = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function confirmLanguage(next: SupportedLanguage) {
  if (language === next) return;
  language = next; listeners.forEach(listener => listener());
}
export function t<K extends MessageKey>(key: K, args: MessageArguments[K] = {} as MessageArguments[K], locale: SupportedLanguage = language): string {
  const entry: string | { one?: string; other: string } = catalogs[locale][key];
  const text = typeof entry === 'string' ? entry : (entry.one && Number((args as Record<string, unknown>).count) === 1 ? entry.one : entry.other);
  const rendered = text.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_, name: string) => String((args as Record<string, unknown>)[name] ?? `{${name}}`));
  // Compatibility for existing string-valued feedback state. Retain its descriptor,
  // never try to translate user-authored Text/Copy values by their content.
  retained.set(rendered, { key, args: { ...args } });
  if (retained.size > 2048) retained.delete(retained.keys().next().value!);
  return rendered;
}
export const createTranslator = (locale: SupportedLanguage) => <K extends MessageKey>(key: K, args?: MessageArguments[K]) => t(key, args, locale);
/** Lazy app-copy constants remain responsive to a confirmed locale change. */
export function live<T extends object>(factory: () => T): T { return new Proxy(factory(), { get: (_, key) => Reflect.get(factory(), key) }); }
export function renderMessage(message: LocalizedMessage, locale: SupportedLanguage = language) {
  if (!Object.hasOwn(catalogs.en, message.key)) return locale === 'zh-Hans' ? '此历史记录的详细说明暂不可用。' : 'Historical details are unavailable.';
  return t(message.key, message.args as MessageArguments[MessageKey], locale);
}
export function ownedMessage(value: string | LocalizedMessage, locale: SupportedLanguage = language): string {
  if (typeof value !== 'string') return renderMessage(value, locale);
  const descriptor = retained.get(value);
  if (descriptor) return renderMessage(descriptor, locale);
  for (const key of Object.keys(catalogs.en) as MessageKey[]) {
    if (catalogs.en[key] === value || catalogs['zh-Hans'][key] === value) return t(key, undefined, locale);
  }
  return value;
}
/** Capture app-owned feedback at its boundary, while its arguments are known. */
export function describeMessage(value: string): LocalizedMessage | undefined {
  const captured = retained.get(value);
  if (captured) return captured;
  for (const key of Object.keys(catalogs.en) as MessageKey[]) {
    if (catalogs.en[key] === value || catalogs['zh-Hans'][key] === value) return { key };
  }
  return undefined;
}
/** Platform exceptions are diagnostics; only reviewed app messages enter the UI. */
export function errorText(error: unknown, fallback: string): string {
  const source = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  const known = describeMessage(source);
  if (known) return renderMessage(known);
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  return code.startsWith('STALE') ? t('m_fe8e0e6d9197') : fallback;
}

type CapturedText = { readonly __remiloMessage: LocalizedMessage };
/** These helpers are only for feedback state, never reminder/editor content. */
export function captureFeedback(value: unknown): unknown {
  if (typeof value === 'string') { const message = describeMessage(value); return message ? { __remiloMessage: message } satisfies CapturedText : value; }
  if (Array.isArray(value)) return value.map(captureFeedback);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) =>
    [key, typeof entry === 'string' && !['message', 'label', 'title', 'text', 'description'].includes(key) ? entry : captureFeedback(entry)]));
  return value;
}
export function presentFeedback<T>(value: unknown): T {
  if (value && typeof value === 'object' && '__remiloMessage' in value) return renderMessage((value as CapturedText).__remiloMessage) as T;
  if (Array.isArray(value)) return value.map(entry => presentFeedback(entry)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, presentFeedback(entry)])) as T;
  return value as T;
}
export function resolveLanguage(tags: readonly string[]): SupportedLanguage {
  for (const tag of tags) {
    const parts = tag.replaceAll('_','-').toLowerCase().split('-');
    if (parts[0] === 'en') return 'en';
    if (parts[0] === 'zh' && !parts.includes('hant') && (parts.includes('hans') || !parts.some(x => ['tw','hk','mo'].includes(x)))) return 'zh-Hans';
  }
  return 'en';
}
