import { describe, expect, it } from 'vitest';
import { TONES, TONE_SPECS, TONE_TRANSPOSE, toneDurationSec, transposeTone } from '@/core/tones';

describe('the notification tones', () => {
  it('are all defined and have at least one note', () => {
    for (const tone of TONES) {
      expect(TONE_SPECS[tone].notes.length).toBeGreaterThan(0);
    }
  });

  it('none runs longer than 1.6 seconds', () => {
    for (const tone of TONES) {
      expect(toneDurationSec(TONE_SPECS[tone])).toBeLessThanOrEqual(1.6);
    }
  });

  it('stay inside an audible and sensible range', () => {
    for (const tone of TONES) {
      for (const note of TONE_SPECS[tone].notes) {
        expect(note.freq).toBeGreaterThan(100);
        expect(note.freq).toBeLessThan(5000);
        expect(note.gain).toBeGreaterThan(0);
        expect(note.gain).toBeLessThanOrEqual(1);
        expect(note.duration).toBeGreaterThan(0);
        expect(note.start).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('transpose every note by the same ratio', () => {
    const original = TONE_SPECS.soft;
    const lower = transposeTone(original, 0.5);

    expect(lower.notes.map((n) => n.freq)).toEqual(original.notes.map((n) => n.freq * 0.5));
    // Timing and level are untouched.
    expect(toneDurationSec(lower)).toBe(toneDurationSec(original));
  });

  it('clamp an extreme transposition', () => {
    const tiny = transposeTone(TONE_SPECS.soft, 0.001);
    const huge = transposeTone(TONE_SPECS.soft, 99);

    expect(tiny.notes[0]!.freq).toBe(TONE_SPECS.soft.notes[0]!.freq * 0.25);
    expect(huge.notes[0]!.freq).toBe(TONE_SPECS.soft.notes[0]!.freq * 4);
  });

  it('play the break end lower than the focus end', () => {
    expect(TONE_TRANSPOSE.breakEnd).toBeLessThan(TONE_TRANSPOSE.focusEnd);
  });

  it('are not mutated by transposing them', () => {
    const before = TONE_SPECS.chime.notes[0]!.freq;
    transposeTone(TONE_SPECS.chime, 2);
    expect(TONE_SPECS.chime.notes[0]!.freq).toBe(before);
  });
});
