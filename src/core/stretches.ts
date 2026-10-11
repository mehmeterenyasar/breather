/**
 * Stretch ids only; the instructions themselves live in the locale catalogs
 * under `stretch.<id>`. Picking is random except that it never repeats the
 * previous one, which is enough to stop the same stretch twice in a row.
 */

export const STRETCH_IDS = ['neck', 'shoulders', 'wrists', 'upperBack', 'chest', 'legs'] as const;

export type StretchId = (typeof STRETCH_IDS)[number];

/** Which part of the figure to highlight on the break screen. */
export const STRETCH_REGION: Record<StretchId, 'head' | 'arms' | 'hands' | 'torso' | 'legs'> = {
  neck: 'head',
  shoulders: 'arms',
  wrists: 'hands',
  upperBack: 'torso',
  chest: 'arms',
  legs: 'legs',
};

/** `random` comes in as an argument so this stays pure and testable. */
export function pickStretch(previous: StretchId | undefined, random: number): StretchId {
  const pool = STRETCH_IDS.filter((id) => id !== previous);
  const safe = Math.min(0.999999, Math.max(0, random));
  return pool[Math.floor(safe * pool.length)] ?? STRETCH_IDS[0];
}
