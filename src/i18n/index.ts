import { en } from '@/locales/en';
import type { Catalog } from '@/locales/en';

/**
 * Translations at runtime.
 *
 * `browser.i18n` takes the language from the browser and cannot be changed
 * while the extension is running, which rules it out: the user is allowed to
 * pick a language in settings. So the strings are plain TypeScript catalogs
 * instead, with the browser language as the default.
 *
 * English is bundled statically, being both the default and the fallback. The
 * others load only when chosen, so the popup doesn't carry five translations it
 * will never show.
 *
 * The manifest name and description can't work this way — the browser reads
 * those before any of our code runs — so they stay in `public/_locales/`.
 */

export const LANGUAGES = ['en', 'de', 'es', 'fr', 'pt', 'tr'] as const;
export type Lang = (typeof LANGUAGES)[number];

/** What settings stores. `auto` follows the browser. */
export type LangPreference = 'auto' | Lang;

type Join<P extends string, K extends string> = P extends '' ? K : `${P}.${K}`;

type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? Join<P, K> : Paths<T[K], Join<P, K>>;
}[keyof T & string];

/** Every valid key, e.g. 'popup.todayFocus'. */
export type MessageKey = Paths<Catalog>;

type ValueAt<T, K extends string> = K extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? ValueAt<T[Head], Rest>
    : never
  : K extends keyof T
    ? T[K]
    : never;

/** The names of the `{placeholders}` inside a string. */
type SubNames<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | SubNames<Rest>
  : never;

type SubsOf<K extends MessageKey> = SubNames<ValueAt<Catalog, K> & string>;

type KeysWithSubs = {
  [K in MessageKey]: [SubsOf<K>] extends [never] ? never : K;
}[MessageKey];

type KeysWithoutSubs = Exclude<MessageKey, KeysWithSubs>;

export interface I18n {
  t(key: KeysWithoutSubs): string;
  /** With placeholders, whose names the compiler checks against the string. */
  t<K extends KeysWithSubs>(key: K, subs: Record<SubsOf<K>, string | number>): string;
}

type Node = { [key: string]: string | Node };

function flatten(node: Node, prefix = '', out = new Map<string, string>()): Map<string, string> {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else flatten(value, path, out);
  }
  return out;
}

const FALLBACK = flatten(en as unknown as Node);

const loaders: Record<Lang, () => Promise<Node>> = {
  en: () => Promise.resolve(en as unknown as Node),
  de: () => import('@/locales/de').then((module) => module.de as unknown as Node),
  es: () => import('@/locales/es').then((module) => module.es as unknown as Node),
  fr: () => import('@/locales/fr').then((module) => module.fr as unknown as Node),
  pt: () => import('@/locales/pt').then((module) => module.pt as unknown as Node),
  tr: () => import('@/locales/tr').then((module) => module.tr as unknown as Node),
};

let active = FALLBACK;
let activeLang: Lang = 'en';

export function currentLanguage(): Lang {
  return activeLang;
}

/** 'pt-BR' becomes 'pt', 'de-AT' becomes 'de', anything unknown becomes 'en'. */
export function resolveLanguage(preference: LangPreference, uiLanguage: string): Lang {
  if (preference !== 'auto') return preference;

  const base = uiLanguage.toLowerCase().split('-')[0] ?? '';
  return (LANGUAGES as readonly string[]).includes(base) ? (base as Lang) : 'en';
}

export async function setLanguage(lang: Lang): Promise<void> {
  if (lang === activeLang) return;

  try {
    const catalog = await loaders[lang]();
    active = flatten(catalog);
    activeLang = lang;
  } catch (error) {
    // Staying in English beats filling the screen with key names.
    console.warn('[breather] could not load language, staying in English', lang, error);
  }
}

const PLACEHOLDER = /\{(\w+)\}/g;

function translate(key: string, subs?: Record<string, string | number>): string {
  const template = active.get(key) ?? FALLBACK.get(key);
  // The key itself is at least diagnosable; an empty space is not.
  if (template == null) return key;
  if (!subs) return template;

  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = subs[name];
    return value == null ? match : String(value);
  });
}

export const i18n: I18n = {
  t: translate as I18n['t'],
};
