import { browser } from 'wxt/browser';
import { i18n } from '@/i18n';
import { formatDurationShort, formatTimeOfDay, phaseLabel } from '@/format';
import type { HealthKind, Phase } from '@/core/types';

/**
 * Notifications. The tone is played by our own audio code, so on Chromium these
 * are created silent to avoid doubling up. Firefox has no `silent` field, hence
 * the build-target check.
 */

const ICON = '/icon/128.png';
const isFirefox = import.meta.env.BROWSER === 'firefox';

async function show(id: string, title: string, message: string): Promise<void> {
  try {
    await browser.notifications.create(id, {
      type: 'basic',
      iconUrl: browser.runtime.getURL(ICON),
      title,
      message,
      ...(isFirefox ? {} : { silent: true }),
    });
  } catch (error) {
    console.warn('[breather] could not show a notification', error);
  }
}

/** How long the focus ran, and what comes next. */
export async function notifyFocusDone(workedMs: number, nextPhase: Phase): Promise<void> {
  await show(
    'breather:focus-done',
    i18n.t('notify.focusDone.title'),
    i18n.t('notify.focusDone.body', {
      duration: formatDurationShort(workedMs),
      next: phaseLabel(nextPhase),
    }),
  );
}

export async function notifyBreakDone(): Promise<void> {
  await show(
    'breather:break-done',
    i18n.t('notify.breakDone.title'),
    i18n.t('notify.breakDone.body'),
  );
}

/** The stopwatch nudge. */
export async function notifyReminder(elapsedMs: number): Promise<void> {
  await show(
    'breather:reminder',
    i18n.t('stopwatch.reminder.title', { duration: formatDurationShort(elapsedMs) }),
    i18n.t('stopwatch.reminder.body'),
  );
}

const BREAK_TITLE = {
  eye: 'break.eye.title',
  breath: 'break.breath.title',
  posture: 'break.posture.title',
  water: 'break.water.title',
  pomodoro: 'phase.shortBreak',
} as const;

/** Used when the user chose notifications over the break window. */
export async function notifyHealthBreak(kinds: readonly HealthKind[]): Promise<void> {
  const first = kinds[0];
  if (!first) return;

  await show(
    'breather:health',
    i18n.t(BREAK_TITLE[first]),
    kinds.length > 1
      ? i18n.t('notify.health.combined', { count: String(kinds.length) })
      : i18n.t('notify.health.body'),
  );
}

export async function notifyWater(): Promise<void> {
  await show('breather:water', i18n.t('break.water.title'), i18n.t('break.water.body'));
}

export async function notifyWeeklyReport(
  focusMs: number,
  deltaPercent: number | null,
): Promise<void> {
  const duration = formatDurationShort(focusMs);

  const body =
    deltaPercent == null
      ? i18n.t('notify.weekly.bodyFirst', { duration })
      : deltaPercent >= 0
        ? i18n.t('notify.weekly.bodyUp', { duration, percent: Math.abs(deltaPercent) })
        : i18n.t('notify.weekly.bodyDown', { duration, percent: Math.abs(deltaPercent) });

  await show('breather:weekly', i18n.t('notify.weekly.title'), body);
}

/** The phase ran out while the browser was closed or the machine asleep. */
export async function notifyStaleCompletion(at: number): Promise<void> {
  await show(
    'breather:stale',
    i18n.t('notify.stale.title'),
    i18n.t('notify.stale.body', { time: formatTimeOfDay(at) }),
  );
}
