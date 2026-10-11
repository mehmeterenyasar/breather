import { minutesToMs } from './time';
import type { Phase, TimerSettings } from './types';

/** Planned net length of a phase. */
export function phaseDurationMs(settings: TimerSettings, phase: Phase): number {
  switch (phase) {
    case 'focus':
      return minutesToMs(settings.focusMin);
    case 'shortBreak':
      return minutesToMs(settings.shortBreakMin);
    case 'longBreak':
      return minutesToMs(settings.longBreakMin);
    case 'idle':
      return 0;
  }
}

export interface NextPhase {
  phase: Phase;
  /** Focus sessions finished in this cycle. */
  pomodoroIndex: number;

  autoStart: boolean;
}

/**
 * focus -> short or long break -> focus, and so on. `pomodoroIndex` counts the
 * focus sessions completed in the current cycle and resets after a long break.
 */
export function nextPhaseAfter(
  settings: TimerSettings,
  phase: Phase,
  pomodoroIndex: number,
): NextPhase {
  const every = Math.max(2, Math.floor(settings.longBreakEvery));

  if (phase === 'focus') {
    const index = pomodoroIndex + 1;
    const isLong = index % every === 0;
    return {
      phase: isLong ? 'longBreak' : 'shortBreak',
      pomodoroIndex: index,
      autoStart: settings.autoStartBreak,
    };
  }

  if (phase === 'longBreak') {
    return { phase: 'focus', pomodoroIndex: 0, autoStart: settings.autoStartFocus };
  }

  if (phase === 'shortBreak') {
    return { phase: 'focus', pomodoroIndex, autoStart: settings.autoStartFocus };
  }

  return { phase: 'focus', pomodoroIndex, autoStart: false };
}

/**
 * The ●●○○ indicator. During a long break every dot is filled, so the screen
 * still says "you earned this one".
 */
export function cycleDots(settings: TimerSettings, pomodoroIndex: number, phase: Phase): boolean[] {
  const every = Math.max(2, Math.floor(settings.longBreakEvery));
  const filled = phase === 'longBreak' ? every : pomodoroIndex % every;
  return Array.from({ length: every }, (_, i) => i < filled);
}

/** Flowtime's suggested break, clamped to the configured bounds. */
export function flowtimeBreakMs(settings: TimerSettings, workedMs: number): number {
  const raw = workedMs * settings.flowtimeBreakRatio;
  const min = minutesToMs(settings.flowtimeMinBreakMin);
  const max = minutesToMs(settings.flowtimeMaxBreakMin);
  return Math.round(Math.min(max, Math.max(min, raw)));
}
