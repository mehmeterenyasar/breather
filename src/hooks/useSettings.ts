import { useEffect, useState } from 'preact/hooks';
import { readSettings, watchSettings } from '@/storage/settings';
import type { Settings } from '@/storage/schema';

/**
 * Reads settings from storage and watches for changes. No message to the worker:
 * waiting for one to wake up would be the slowest part of opening the popup.
 */
export function useSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let alive = true;
    void readSettings().then((value) => {
      if (alive) setSettings(value);
    });

    const unwatch = watchSettings((value) => setSettings(value));
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  return settings;
}

/** Puts the theme and accent colour on <html>. */
export function useTheme(settings: Settings | null): void {
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;

    if (settings.appearance.theme === 'system') {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = settings.appearance.theme;
    }

    root.dataset.accent = settings.appearance.accent;
    root.dataset.size = settings.appearance.popupSize;
  }, [settings]);
}
