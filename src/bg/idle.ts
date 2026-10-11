import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { MINUTE_MS } from '@/core/time';
import { isCountUp } from '@/core/timer';
import { readSettings } from '@/storage/settings';
import { readTimerState } from '@/storage/timer-state';
import { setIdlePrompt } from '@/storage/ui-queue';
import { markAwayAsBreak } from './health-controller';
import { dispatchTimer } from './timer-controller';

/**
 * `chrome.idle` tells us when the user walks away or the screen locks.
 *
 * Two things follow. Counting-up timers pause, since time away isn't work;
 * counted-down phases are left alone, because there the whole point is that the
 * clock keeps running. And the break counters reset, because standing up and
 * leaving is a break whatever we were about to suggest.
 *
 * On return the popup offers to hand the time back.
 */

const AWAY_KEY = 'local:awaySince' as const;
const AUTO_PAUSED_KEY = 'local:autoPaused' as const;

/** The API refuses anything shorter. */
const MIN_DETECTION_SEC = 15;

export async function applyIdleDetection(): Promise<void> {
  const settings = await readSettings();

  if (!settings.dnd.idle.enabled) return;

  const seconds = Math.max(MIN_DETECTION_SEC, Math.round(settings.dnd.idle.afterMin * 60));
  try {
    browser.idle.setDetectionInterval(seconds);
  } catch (error) {
    console.warn('[breather] could not set the idle detection interval', error);
  }
}

export async function handleIdleStateChange(state: string): Promise<void> {
  const settings = await readSettings();
  if (!settings.dnd.idle.enabled) return;

  if (state === 'idle' || state === 'locked') {
    await onAway();
    return;
  }

  if (state === 'active') await onReturn(settings.dnd.idle.askToAddTime);
}

async function onAway(): Promise<void> {
  const now = Date.now();
  if ((await storage.getItem<number>(AWAY_KEY)) != null) return;

  await storage.setItem(AWAY_KEY, now);

  const timer = await readTimerState();
  // Counting-up phases only.
  if (timer.status === 'running' && isCountUp(timer)) {
    await dispatchTimer({ type: 'PAUSE' });
    await storage.setItem(AUTO_PAUSED_KEY, true);
  }
}

async function onReturn(askToAddTime: boolean): Promise<void> {
  const now = Date.now();
  const since = await storage.getItem<number>(AWAY_KEY);
  await storage.removeItem(AWAY_KEY);

  const autoPaused = (await storage.getItem<boolean>(AUTO_PAUSED_KEY)) === true;
  await storage.removeItem(AUTO_PAUSED_KEY);

  const awayMs = since == null ? 0 : Math.max(0, now - since);

  // They were away from the screen, so the breaks count as taken.
  if (awayMs > 0) await markAwayAsBreak(awayMs, now);

  if (!autoPaused) return;

  // Resume where it left off; the question about the gap waits in the popup.
  await dispatchTimer({ type: 'RESUME' });

  if (askToAddTime && awayMs >= MINUTE_MS) {
    await setIdlePrompt({ ms: awayMs, at: now });
  }
}
