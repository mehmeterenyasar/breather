import { useCallback, useEffect, useState } from 'preact/hooks';
import { storage } from 'wxt/utils/storage';
import { nextHealthTickAt } from '@/core/health-schedule';
import { sendMessage } from '@/messaging';
import { readHealthStore } from '@/storage/health-state';
import type { Settings } from '@/storage/schema';
import { clearIdlePrompt, readIdlePrompt, watchIdlePrompt } from '@/storage/ui-queue';
import type { IdlePrompt } from '@/storage/ui-queue';

/**
 * What the popup needs about breaks: when the next one is due, and how much
 * water today. Reads come from `local`, writes go through the worker.
 */
export function useNextBreakAt(settings: Settings | null): number | undefined {
  const [at, setAt] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!settings) return;
    let alive = true;

    const read = async () => {
      const store = await readHealthStore(settings.breaks, Date.now());
      if (alive) setAt(nextHealthTickAt(store, settings.breaks));
    };

    void read();
    const unwatch = storage.watch<unknown>('local:healthState', () => void read());

    return () => {
      alive = false;
      unwatch();
    };
  }, [settings]);

  return at;
}

export function useIdlePrompt() {
  const [prompt, setPrompt] = useState<IdlePrompt | null>(null);

  useEffect(() => {
    let alive = true;
    const now = () => Date.now();

    void readIdlePrompt(now()).then((value) => alive && setPrompt(value));
    const unwatch = watchIdlePrompt(now, setPrompt);

    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  const resolve = useCallback((add: boolean) => {
    setPrompt(null);
    void sendMessage('idle.resolve', { add }).catch(() => void clearIdlePrompt());
  }, []);

  return { prompt, resolve };
}
