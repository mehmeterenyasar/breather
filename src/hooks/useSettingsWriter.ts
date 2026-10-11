import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { updateSettings } from '@/storage/settings';
import type { DeepPartial } from '@/storage/settings';
import type { Settings } from '@/storage/schema';

/**
 * There is no save button; every change is written as it is made. The brief
 * "Saved" that flashes afterwards exists so nobody has to wonder whether it was.
 */
export function useSettingsWriter() {
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const write = useCallback(
    (patch: DeepPartial<Settings> | ((current: Settings) => DeepPartial<Settings>)) => {
      void updateSettings(patch)
        .then(() => {
          setSaved(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setSaved(false), 1600);
        })
        .catch((error: unknown) => console.error('[breather] ayar kaydedilemedi', error));
    },
    [],
  );

  return { write, saved };
}
