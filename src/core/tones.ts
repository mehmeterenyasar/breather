/**
 * Notification tones, defined as a few notes rather than shipped as audio.
 *
 * Nothing to license, nothing to download, and volume and pitch stay under our
 * control. Since the definitions are plain data they can be checked in tests;
 * `src/audio/synth.ts` is what actually plays them.
 */

export const TONES = [
  'soft',
  'chime',
  'bell',
  'glass',
  'marimba',
  'pebble',
  'drop',
  'rise',
  'pulse',
  'woodblock',
] as const;
export type ToneId = (typeof TONES)[number];

export type ToneWave = 'sine' | 'triangle' | 'square';

export interface ToneNote {
  freq: number;
  /** Seconds from the start of the tone. */
  start: number;

  duration: number;
  wave: ToneWave;
  /** Relative level within the tone. */
  gain: number;
}

export interface ToneSpec {
  notes: ToneNote[];
}

const note = (
  freq: number,
  start: number,
  duration: number,
  wave: ToneWave,
  gain: number,
): ToneNote => ({ freq, start, duration, wave, gain });

/**
 * All of them short and soft. The job is to let you know, not to startle you,
 * and none runs past 1.6 seconds.
 */
export const TONE_SPECS: Record<ToneId, ToneSpec> = {
  // Two stacked sines, round and unobtrusive.
  soft: {
    notes: [note(523.25, 0, 0.9, 'sine', 0.5), note(659.25, 0.06, 0.9, 'sine', 0.35)],
  },
  // Descending triad, bell-ish.
  chime: {
    notes: [
      note(880, 0, 0.5, 'triangle', 0.4),
      note(659.25, 0.16, 0.5, 'triangle', 0.35),
      note(523.25, 0.32, 0.8, 'triangle', 0.3),
    ],
  },
  // Fast decay, like a struck wooden bar.
  marimba: {
    notes: [
      note(587.33, 0, 0.26, 'sine', 0.55),
      note(880, 0.12, 0.3, 'sine', 0.4),
      note(1174.66, 0.12, 0.18, 'sine', 0.15),
    ],
  },
  // A single falling drop.
  drop: {
    notes: [note(740, 0, 0.18, 'sine', 0.5), note(493.88, 0.1, 0.5, 'sine', 0.45)],
  },
  // Very short and dry.
  woodblock: {
    notes: [note(1046.5, 0, 0.09, 'square', 0.22), note(784, 0.02, 0.14, 'triangle', 0.3)],
  },
  // Bright bell: fundamental plus two harmonics, long decay.
  bell: {
    notes: [
      note(830.61, 0, 1.2, 'sine', 0.42),
      note(1244.51, 0, 0.7, 'sine', 0.16),
      note(1661.22, 0.01, 0.4, 'sine', 0.08),
    ],
  },
  // Thin rising arpeggio.
  glass: {
    notes: [
      note(1174.66, 0, 0.5, 'sine', 0.3),
      note(1396.91, 0.07, 0.5, 'sine', 0.26),
      note(1760, 0.14, 0.7, 'sine', 0.22),
    ],
  },
  // Low and round, a stone into water.
  pebble: {
    notes: [note(329.63, 0, 0.5, 'sine', 0.55), note(246.94, 0.07, 0.6, 'sine', 0.4)],
  },
  // The inverse of `drop`, so it reads as a beginning.
  rise: {
    notes: [note(523.25, 0, 0.22, 'sine', 0.42), note(783.99, 0.13, 0.45, 'sine', 0.45)],
  },
  // Two even taps.
  pulse: {
    notes: [note(659.25, 0, 0.16, 'sine', 0.4), note(659.25, 0.26, 0.26, 'sine', 0.35)],
  },
};

/** Total length, so the caller knows when it can tear the audio context down. */
export function toneDurationSec(spec: ToneSpec): number {
  return spec.notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0);
}

/** Shifting the pitch is enough to tell two events apart by ear. */
export function transposeTone(spec: ToneSpec, factor: number): ToneSpec {
  const safe = Math.min(4, Math.max(0.25, factor));
  return { notes: spec.notes.map((n) => ({ ...n, freq: n.freq * safe })) };
}

/** Focus ends at pitch, breaks end lower. */
export const TONE_TRANSPOSE = {
  focusEnd: 1,
  breakEnd: 0.75,
} as const;
