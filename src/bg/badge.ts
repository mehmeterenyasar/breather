import { browser } from 'wxt/browser';
import { elapsedMs, remainingMs } from '@/core/timer';
import type { TimerState } from '@/core/timer';
import { formatBadge } from '@/core/time';
import { isBreakPhase } from '@/core/types';

/**
 * The toolbar badge, in minutes.
 *
 * Updating it every second would mean keeping the worker awake, which costs
 * battery for a number nobody reads that closely. Once a minute is plenty.
 */

const COLOR = {
  focus: '#3f7d6f',
  break: '#5d7fa8',
  paused: '#8a8f98',
} as const;

async function setText(text: string): Promise<void> {
  await browser.action.setBadgeText({ text });
}

async function setColor(color: string): Promise<void> {
  await browser.action.setBadgeBackgroundColor({ color });
  // Missing on Firefox and older Chrome, and only affects legibility.
  try {
    await browser.action.setBadgeTextColor?.({ color: '#ffffff' });
  } catch {
    // not important enough to report
  }
}

export async function updateBadge(
  state: TimerState,
  showBadge: boolean,
  now: number,
): Promise<void> {
  if (!showBadge || state.status === 'idle') {
    await setText('');
    return;
  }

  const remaining = remainingMs(state, now);
  const value = remaining == null ? elapsedMs(state, now) : Math.max(0, remaining);

  await setText(formatBadge(value));
  await setColor(
    state.status === 'paused'
      ? COLOR.paused
      : isBreakPhase(state.phase)
        ? COLOR.break
        : COLOR.focus,
  );
}
