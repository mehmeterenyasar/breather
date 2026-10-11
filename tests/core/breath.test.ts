import { describe, expect, it } from 'vitest';
import {
  BREATH_PRESETS,
  breathCycleMs,
  breathFrameAt,
  breathRounds,
  breathSteps,
} from '@/core/breath';
import type { BreathPattern } from '@/core/breath';
import { STRETCH_IDS, pickStretch } from '@/core/stretches';

const BOX: BreathPattern = BREATH_PRESETS.box;

describe('breathing patterns', () => {
  it('box breathing is four equal steps', () => {
    expect(breathSteps(BOX).map((s) => s.phase)).toEqual(['inhale', 'hold', 'exhale', 'holdAfter']);
    expect(breathCycleMs(BOX)).toBe(16_000);
  });

  it('skips steps of zero length', () => {
    expect(breathSteps(BREATH_PRESETS.coherent).map((s) => s.phase)).toEqual(['inhale', 'exhale']);
    expect(breathSteps(BREATH_PRESETS.fourSevenEight).map((s) => s.phase)).toEqual([
      'inhale',
      'hold',
      'exhale',
    ]);
  });

  it('the physiological sigh has two inhales', () => {
    expect(breathSteps(BREATH_PRESETS.sigh).map((s) => s.phase)).toEqual([
      'inhale',
      'inhale2',
      'exhale',
    ]);
  });

  it('works out the number of rounds from the duration', () => {
    expect(breathRounds(BOX, 64_000)).toBe(4);
    expect(breathRounds(BOX, 60_000)).toBe(4);
    // Even an absurdly short break gets one round.
    expect(breathRounds(BOX, 1000)).toBe(1);
  });
});

describe('the breathing frame', () => {
  it('moves through the steps in order', () => {
    expect(breathFrameAt(BOX, 0, 64_000).phase).toBe('inhale');
    expect(breathFrameAt(BOX, 5000, 64_000).phase).toBe('hold');
    expect(breathFrameAt(BOX, 9000, 64_000).phase).toBe('exhale');
    expect(breathFrameAt(BOX, 13_000, 64_000).phase).toBe('holdAfter');
  });

  it('counts the rounds as it loops', () => {
    expect(breathFrameAt(BOX, 1000, 64_000).round).toBe(1);
    expect(breathFrameAt(BOX, 17_000, 64_000).round).toBe(2);
    expect(breathFrameAt(BOX, 33_000, 64_000).round).toBe(3);
  });

  it('rounds the seconds up, so the screen reads 4-3-2-1', () => {
    expect(breathFrameAt(BOX, 0, 64_000).secondsLeft).toBe(4);
    expect(breathFrameAt(BOX, 1500, 64_000).secondsLeft).toBe(3);
    expect(breathFrameAt(BOX, 3900, 64_000).secondsLeft).toBe(1);
  });

  it('grows on the inhale and shrinks on the exhale', () => {
    const inhaleStart = breathFrameAt(BOX, 0, 64_000).scale;
    const inhaleEnd = breathFrameAt(BOX, 3900, 64_000).scale;
    const exhaleEnd = breathFrameAt(BOX, 11_900, 64_000).scale;

    expect(inhaleEnd).toBeGreaterThan(inhaleStart);
    expect(breathFrameAt(BOX, 5000, 64_000).scale).toBe(1);
    expect(exhaleEnd).toBeLessThan(0.5);
  });

  it('grows in two stages for the double inhale', () => {
    const sigh = BREATH_PRESETS.sigh;
    const firstInhaleEnd = breathFrameAt(sigh, 1400, 30_000).scale;
    const secondInhaleEnd = breathFrameAt(sigh, 2400, 30_000).scale;

    expect(firstInhaleEnd).toBeLessThan(secondInhaleEnd);
    expect(secondInhaleEnd).toBeCloseTo(1, 1);
  });

  it('keeps the session progress between 0 and 1', () => {
    expect(breathFrameAt(BOX, 0, 64_000).progress).toBe(0);
    expect(breathFrameAt(BOX, 32_000, 64_000).progress).toBe(0.5);
    // Past the end it stays at 1 rather than overflowing.
    expect(breathFrameAt(BOX, 999_000, 64_000).progress).toBe(1);
    expect(breathFrameAt(BOX, -5000, 64_000).progress).toBe(0);
  });
});

describe('picking a stretch', () => {
  it('never repeats the previous one', () => {
    for (const previous of STRETCH_IDS) {
      for (const random of [0, 0.2, 0.5, 0.8, 0.999]) {
        expect(pickStretch(previous, random)).not.toBe(previous);
      }
    }
  });

  it('can pick anything on the first go', () => {
    expect(pickStretch(undefined, 0)).toBe(STRETCH_IDS[0]);
    expect(pickStretch(undefined, 0.999)).toBe(STRETCH_IDS[STRETCH_IDS.length - 1]);
  });

  it('survives a random value outside 0..1', () => {
    expect(STRETCH_IDS).toContain(pickStretch(undefined, -1));
    expect(STRETCH_IDS).toContain(pickStretch(undefined, 5));
  });
});
