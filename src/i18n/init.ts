import { browser } from 'wxt/browser';
import { readSettings, watchSettings } from '@/storage/settings';
import { currentLanguage, resolveLanguage, setLanguage } from './index';
import type { Lang, LangPreference } from './index';

/**
 * The browser side of the language handling. `src/i18n/index.ts` is kept free of
 * browser APIs so it can be tested, which leaves reading the settings and asking
 * the browser its language to this file.
 */

let pending: Promise<Lang> | null = null;

function uiLanguage(): string {
  try {
    return browser.i18n.getUILanguage();
  } catch {
    return 'en';
  }
}

/** Safe to call repeatedly: callers share the first call's promise. */
export function initI18n(): Promise<Lang> {
  pending ??= (async () => {
    const settings = await readSettings();
    const lang = resolveLanguage(settings.appearance.language, uiLanguage());
    await setLanguage(lang);
    return lang;
  })().catch((error: unknown) => {
    console.warn('[breather] could not initialise the language', error);
    return 'en' as Lang;
  });

  return pending;
}

/** Lets a UI repaint when the language changes under it. */
export function watchLanguage(onChange: (lang: Lang) => void): () => void {
  return watchSettings((settings) => {
    const next = resolveLanguage(settings.appearance.language, uiLanguage());
    if (next === currentLanguage()) return;

    void setLanguage(next).then(() => onChange(next));
  });
}

/** The language picker in settings. */
export async function applyLanguagePreference(preference: LangPreference): Promise<void> {
  await setLanguage(resolveLanguage(preference, uiLanguage()));
}
