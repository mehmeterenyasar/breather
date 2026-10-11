import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LANGUAGES, i18n, resolveLanguage, setLanguage } from '@/i18n';
import type { Lang } from '@/i18n';
import { en } from '@/locales/en';
import { de } from '@/locales/de';
import { es } from '@/locales/es';
import { fr } from '@/locales/fr';
import { pt } from '@/locales/pt';
import { tr } from '@/locales/tr';

/**
 * TypeScript already guarantees the keys: a catalog has to satisfy `Translation`,
 * so a missing one is a compile error.
 *
 * What is left for this suite is what the types cannot see. Empty strings. A
 * translation whose placeholders drifted from the English, since losing
 * `{duration}` turns the sentence into nonsense without failing anything. And
 * the manifest strings in `public/_locales`, which are maintained by hand and
 * can therefore fall out of step with the catalogs.
 */

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

type Node = { [key: string]: string | Node };

const catalogs: Record<Lang, Node> = {
  en: en as unknown as Node,
  de: de as unknown as Node,
  es: es as unknown as Node,
  fr: fr as unknown as Node,
  pt: pt as unknown as Node,
  tr: tr as unknown as Node,
};

function flatten(node: Node, prefix = '', out = new Map<string, string>()): Map<string, string> {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else flatten(value, path, out);
  }
  return out;
}

const flat = Object.fromEntries(
  Object.entries(catalogs).map(([lang, node]) => [lang, flatten(node)]),
) as Record<Lang, Map<string, string>>;

const placeholders = (value: string) =>
  [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();

describe('the translation catalogs', () => {
  it('cover all six languages', () => {
    expect([...LANGUAGES].sort()).toEqual(['de', 'en', 'es', 'fr', 'pt', 'tr']);
    for (const lang of LANGUAGES) {
      expect(flat[lang].size, lang).toBeGreaterThan(300);
    }
  });

  it('contain no empty strings', () => {
    const empty: string[] = [];
    for (const lang of LANGUAGES) {
      for (const [key, value] of flat[lang]) {
        if (value.trim().length === 0) empty.push(`${lang}:${key}`);
      }
    }
    expect(empty).toEqual([]);
  });

  it('have the same keys as the English one', () => {
    const base = [...flat.en.keys()].sort();
    for (const lang of LANGUAGES) {
      expect([...flat[lang].keys()].sort(), lang).toEqual(base);
    }
  });

  it('have exactly the same placeholders', () => {
    const mismatched: string[] = [];

    for (const lang of LANGUAGES) {
      if (lang === 'en') continue;
      for (const [key, value] of flat[lang]) {
        const expected = placeholders(flat.en.get(key) ?? '');
        if (placeholders(value).join() !== expected.join()) mismatched.push(`${lang}:${key}`);
      }
    }

    expect(mismatched).toEqual([]);
  });

  it('spell the product name the same way everywhere', () => {
    for (const lang of LANGUAGES) {
      expect(flat[lang].get('extName'), lang).toBe('Breather');
    }
  });
});

describe('the manifest strings in public/_locales', () => {
  /** Chrome wants a region in some of these, hence pt_BR. */
  const FOLDER: Record<Lang, string> = {
    en: 'en',
    de: 'de',
    es: 'es',
    fr: 'fr',
    pt: 'pt_BR',
    tr: 'tr',
  };

  const read = (folder: string) =>
    JSON.parse(
      readFileSync(join(ROOT, 'public', '_locales', folder, 'messages.json'), 'utf8'),
    ) as Record<string, { message: string }>;

  it('have a folder per language', () => {
    const folders = readdirSync(join(ROOT, 'public', '_locales')).sort();
    expect(folders).toEqual(Object.values(FOLDER).sort());
  });

  it('match the catalogs', () => {
    // These four are maintained by hand, because the browser reads them before
    // any of our code runs. Which is precisely why they can drift.
    const keys = ['extName', 'extDescription', 'cmdToggleTimer', 'cmdSkipPhase'] as const;
    const drift: string[] = [];

    for (const lang of LANGUAGES) {
      const messages = read(FOLDER[lang]);
      for (const key of keys) {
        if (messages[key]?.message !== flat[lang].get(key)) drift.push(`${lang}:${key}`);
      }
    }

    expect(drift).toEqual([]);
  });
});

describe('resolving the language', () => {
  it('ignores the region on the browser language', () => {
    expect(resolveLanguage('auto', 'pt-BR')).toBe('pt');
    expect(resolveLanguage('auto', 'de-AT')).toBe('de');
    expect(resolveLanguage('auto', 'fr')).toBe('fr');
  });

  it('falls back to English for a language we do not have', () => {
    expect(resolveLanguage('auto', 'ja')).toBe('en');
    expect(resolveLanguage('auto', '')).toBe('en');
  });

  it('lets an explicit preference win', () => {
    expect(resolveLanguage('tr', 'en-US')).toBe('tr');
    expect(resolveLanguage('de', 'tr-TR')).toBe('de');
  });
});

describe('the translation runtime', () => {
  it('starts in English', () => {
    expect(i18n.t('action.start')).toBe('Start');
  });

  it('swaps the strings when the language changes', async () => {
    await setLanguage('de');
    expect(i18n.t('action.start')).toBe('Starten');

    await setLanguage('tr');
    expect(i18n.t('action.start')).toBe('Başlat');

    await setLanguage('en');
    expect(i18n.t('action.start')).toBe('Start');
  });

  it('fills the placeholders in', () => {
    expect(i18n.t('action.extend', { minutes: 5 })).toBe('+5 min');
    expect(i18n.t('stats.table.count', { shown: 25, total: 500 })).toBe('25 of 500');
  });

  it('leaves a placeholder alone when nothing was passed for it', () => {
    // A visible gap is better than a confidently wrong number.
    expect(i18n.t('action.extend', {} as { minutes: number })).toBe('+{minutes} min');
  });
});
