/** Quick presets for countdown mode. A custom length is always available too. */
export const COUNTDOWN_PRESETS_MIN = [5, 10, 15, 30, 45, 60] as const;

/** Matches the bounds the settings schema clamps to. */
export const MIN_DURATION_MIN = 1;
export const MAX_DURATION_MIN = 180;

export function clampDurationMin(value: number): number {
  if (!Number.isFinite(value)) return MIN_DURATION_MIN;
  return Math.min(MAX_DURATION_MIN, Math.max(MIN_DURATION_MIN, Math.round(value)));
}
