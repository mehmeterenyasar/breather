/** Shared vocabulary for the timer and the breaks. */

export type Mode = 'pomodoro' | 'stopwatch' | 'countdown' | 'flowtime';
export type Phase = 'focus' | 'shortBreak' | 'longBreak' | 'idle';
export type Status = 'idle' | 'running' | 'paused';
/** The health breaks, each with its own schedule and switch. */
export type HealthKind = 'eye' | 'breath' | 'posture' | 'water';
/** Everything recorded in the break history, Pomodoro breaks included. */
export type BreakKind = HealthKind | 'pomodoro';
export type BreakAction = 'offered' | 'taken' | 'skipped' | 'snoozed' | 'auto';

export const MODES: readonly Mode[] = ['pomodoro', 'stopwatch', 'countdown', 'flowtime'];

export function isBreakPhase(phase: Phase): phase is 'shortBreak' | 'longBreak' {
  return phase === 'shortBreak' || phase === 'longBreak';
}

/** Session tag. Names are user content, so they are never translated. */
export interface Tag {
  id: string;
  name: string;
  /** Serbest hex renk (#rgb veya #rrggbb). */
  color: string;
  archived?: boolean;
}

/**
 * The slice of settings the timer needs. The full `Settings` object lives in
 * the storage schema and structurally contains this.
 */
export interface TimerSettings {
  /** Minutes, 1 to 180. */
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  /** Focus sessions between long breaks. */
  longBreakEvery: number;
  autoStartBreak: boolean;
  autoStartFocus: boolean;
  /** What the add-time button adds. */
  extendMin: number;
  /** Last length used in countdown mode. */
  countdownDefaultMin: number;
  /** Stopwatch nudge interval, or null when switched off. */
  stopwatchRemindEveryMin: number | null;
  /** Share of the worked time Flowtime suggests as a break. */
  flowtimeBreakRatio: number;
  flowtimeMinBreakMin: number;
  flowtimeMaxBreakMin: number;
}
