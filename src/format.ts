import { i18n } from '@/i18n';
import { MINUTE_MS } from '@/core/time';
import type { Mode, Phase } from '@/core/types';

/**
 * Formatting that needs words. The arithmetic kind lives in `core/time.ts`.
 */

const PHASE_KEY = {
  focus: 'phase.focus',
  shortBreak: 'phase.shortBreak',
  longBreak: 'phase.longBreak',
  idle: 'phase.idle',
} as const satisfies Record<Phase, string>;

const MODE_KEY = {
  pomodoro: 'mode.pomodoro',
  stopwatch: 'mode.stopwatch',
  countdown: 'mode.countdown',
  flowtime: 'mode.flowtime',
} as const satisfies Record<Mode, string>;

export function phaseLabel(phase: Phase): string {
  return i18n.t(PHASE_KEY[phase]);
}

export function modeLabel(mode: Mode): string {
  return i18n.t(MODE_KEY[mode]);
}

/** "25m", "1h 20m", "45s" */
export function formatDurationShort(ms: number): string {
  const safe = Math.max(0, ms);

  if (safe < MINUTE_MS) {
    return `${Math.round(safe / 1000)} ${i18n.t('common.secondShort')}`;
  }

  const totalMin = Math.round(safe / MINUTE_MS);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const h = i18n.t('common.hourShort');
  const m = i18n.t('common.minuteShort');

  if (hours > 0 && minutes > 0) return `${hours} ${h} ${minutes} ${m}`;
  if (hours > 0) return `${hours} ${h}`;
  return `${minutes} ${m}`;
}

/** Clock time in whatever format the user's locale prefers. */
export function formatTimeOfDay(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
