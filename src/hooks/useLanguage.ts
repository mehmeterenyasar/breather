import { useEffect, useState } from 'preact/hooks';
import { currentLanguage } from '@/i18n';
import { watchLanguage } from '@/i18n/init';

/**
 * Repaints when the language changes. `i18n.t()` reads a module-level catalog,
 * which Preact has no way of noticing, so this turns it into a state change.
 */
export function useLanguage(): string {
  const [lang, setLang] = useState(() => currentLanguage());

  useEffect(() => watchLanguage(setLang), []);

  return lang;
}
