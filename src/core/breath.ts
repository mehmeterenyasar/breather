/**
 * Breathing patterns, expressed as a list of steps with a length in seconds.
 *
 * The break screen only ever asks "which step am I on and how far through it",
 * which means the animated circle and the reduced-motion text version are both
 * driven by the same numbers.
 */

export type BreathPhase = 'inhale' | 'inhale2' | 'hold' | 'exhale' | 'holdAfter';

export interface BreathPattern {
  inhaleSec: number;
  /** Second short inhale of the physiological sigh. Zero everywhere else. */
  inhale2Sec: number;
  holdSec: number;
  exhaleSec: number;
  holdAfterSec: number;
}

export interface BreathStep {
  phase: BreathPhase;
  seconds: number;
}

export const BREATH_PRESETS = {
  /** Box breathing, 4-4-4-4. */
  box: { inhaleSec: 4, inhale2Sec: 0, holdSec: 4, exhaleSec: 4, holdAfterSec: 4 },
  /** 4-7-8. */
  fourSevenEight: { inhaleSec: 4, inhale2Sec: 0, holdSec: 7, exhaleSec: 8, holdAfterSec: 0 },
  /** Coherent breathing, 5.5 in and 5.5 out. */
  coherent: { inhaleSec: 5.5, inhale2Sec: 0, holdSec: 0, exhaleSec: 5.5, holdAfterSec: 0 },
  /** Physiological sigh: two short inhales, one long exhale. */
  sigh: { inhaleSec: 1.5, inhale2Sec: 1, holdSec: 0, exhaleSec: 6, holdAfterSec: 0 },
} as const satisfies Record<string, BreathPattern>;

export type BreathPresetId = keyof typeof BREATH_PRESETS;

/** How big the circle gets: 0.45 at rest, 1 at full inhale. */
const SCALE = {
  min: 0.45,
  mid: 0.78,
  max: 1,
} as const;

export function breathSteps(pattern: BreathPattern): BreathStep[] {
  const raw: BreathStep[] = [
    { phase: 'inhale', seconds: pattern.inhaleSec },
    { phase: 'inhale2', seconds: pattern.inhale2Sec },
    { phase: 'hold', seconds: pattern.holdSec },
    { phase: 'exhale', seconds: pattern.exhaleSec },
    { phase: 'holdAfter', seconds: pattern.holdAfterSec },
  ];
  return raw.filter((step) => step.seconds > 0);
}

export function breathCycleMs(pattern: BreathPattern): number {
  return breathSteps(pattern).reduce((total, step) => total + step.seconds * 1000, 0);
}

/** Whole cycles that fit in the given time, never fewer than one. */
export function breathRounds(pattern: BreathPattern, totalMs: number): number {
  const cycle = breathCycleMs(pattern);
  if (cycle <= 0) return 0;
  return Math.max(1, Math.round(totalMs / cycle));
}

export interface BreathFrame {
  phase: BreathPhase;
  /** Progress through the current step, 0 to 1. */
  phaseProgress: number;
  /** Seconds left in this step, rounded up so the screen counts 3-2-1. */
  secondsLeft: number;
  /** Cycle number, starting at 1. */
  round: number;

  scale: number;
  /** Progress through the whole session, 0 to 1. */
  progress: number;
}

function scaleFor(phase: BreathPhase, progress: number, hasSecondInhale: boolean): number {
  const inhaleTop = hasSecondInhale ? SCALE.mid : SCALE.max;

  switch (phase) {
    case 'inhale':
      return SCALE.min + (inhaleTop - SCALE.min) * progress;
    case 'inhale2':
      return SCALE.mid + (SCALE.max - SCALE.mid) * progress;
    case 'hold':
      return SCALE.max;
    case 'exhale':
      return SCALE.max - (SCALE.max - SCALE.min) * progress;
    case 'holdAfter':
      return SCALE.min;
  }
}

/**
 * State of the session at a given moment. Past the end it keeps returning the
 * final frame rather than wrapping around.
 */
export function breathFrameAt(
  pattern: BreathPattern,
  elapsedMs: number,
  totalMs: number,
): BreathFrame {
  const steps = breathSteps(pattern);
  const cycle = breathCycleMs(pattern);
  const hasSecondInhale = pattern.inhale2Sec > 0;

  const clamped = Math.min(Math.max(0, elapsedMs), Math.max(0, totalMs));
  const progress = totalMs > 0 ? clamped / totalMs : 1;

  if (steps.length === 0 || cycle <= 0) {
    return {
      phase: 'inhale',
      phaseProgress: 0,
      secondsLeft: 0,
      round: 1,
      scale: SCALE.min,
      progress,
    };
  }

  const round = Math.floor(clamped / cycle) + 1;
  let offset = clamped % cycle;

  for (const step of steps) {
    const stepMs = step.seconds * 1000;
    if (offset < stepMs) {
      const phaseProgress = stepMs > 0 ? offset / stepMs : 1;
      return {
        phase: step.phase,
        phaseProgress,
        secondsLeft: Math.max(1, Math.ceil((stepMs - offset) / 1000)),
        round,
        scale: scaleFor(step.phase, phaseProgress, hasSecondInhale),
        progress,
      };
    }
    offset -= stepMs;
  }

  // Rounding left us just past the last step.
  const last = steps[steps.length - 1]!;
  return {
    phase: last.phase,
    phaseProgress: 1,
    secondsLeft: 1,
    round,
    scale: scaleFor(last.phase, 1, hasSecondInhale),
    progress,
  };
}
