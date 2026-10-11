import { describe, expect, it } from 'vitest';
import { cycleDots, flowtimeBreakMs, nextPhaseAfter, phaseDurationMs } from '@/core/pomodoro';
import { MINUTE_MS } from '@/core/time';
import { DEFAULT_SETTINGS } from '@/storage/schema';
import type { Phase, TimerSettings } from '@/core/types';

const S: TimerSettings = DEFAULT_SETTINGS.timer;

describe('phase durations', () => {
  it('come from the settings', () => {
    expect(phaseDurationMs(S, 'focus')).toBe(25 * MINUTE_MS);
    expect(phaseDurationMs(S, 'shortBreak')).toBe(5 * MINUTE_MS);
    expect(phaseDurationMs(S, 'longBreak')).toBe(15 * MINUTE_MS);
    expect(phaseDurationMs(S, 'idle')).toBe(0);
  });

  it('respect custom lengths', () => {
    const custom: TimerSettings = { ...S, focusMin: 50, shortBreakMin: 10 };
    expect(phaseDurationMs(custom, 'focus')).toBe(50 * MINUTE_MS);
    expect(phaseDurationMs(custom, 'shortBreak')).toBe(10 * MINUTE_MS);
  });
});

describe('moving through the cycle', () => {
  it('gives a long break after every fourth focus', () => {
    const seen: Phase[] = [];
    let index = 0;
    for (let i = 0; i < 8; i++) {
      const afterFocus = nextPhaseAfter(S, 'focus', index);
      seen.push(afterFocus.phase);
      index = nextPhaseAfter(S, afterFocus.phase, afterFocus.pomodoroIndex).pomodoroIndex;
    }

    expect(seen).toEqual([
      'shortBreak',
      'shortBreak',
      'shortBreak',
      'longBreak',
      'shortBreak',
      'shortBreak',
      'shortBreak',
      'longBreak',
    ]);
  });

  it('lets you change how often the long break comes', () => {
    const every2: TimerSettings = { ...S, longBreakEvery: 2 };
    expect(nextPhaseAfter(every2, 'focus', 0).phase).toBe('shortBreak');
    expect(nextPhaseAfter(every2, 'focus', 1).phase).toBe('longBreak');
  });

  it('resets the cycle after a long break but not a short one', () => {
    expect(nextPhaseAfter(S, 'longBreak', 4)).toMatchObject({ phase: 'focus', pomodoroIndex: 0 });
    expect(nextPhaseAfter(S, 'shortBreak', 2)).toMatchObject({ phase: 'focus', pomodoroIndex: 2 });
  });

  it('treats auto-start for focus and for breaks separately', () => {
    const settings: TimerSettings = { ...S, autoStartBreak: true, autoStartFocus: false };
    expect(nextPhaseAfter(settings, 'focus', 0).autoStart).toBe(true);
    expect(nextPhaseAfter(settings, 'shortBreak', 1).autoStart).toBe(false);
  });

  it('clamps a nonsensical long-break interval to two', () => {
    const broken: TimerSettings = { ...S, longBreakEvery: 1 };
    expect(nextPhaseAfter(broken, 'focus', 0).phase).toBe('shortBreak');
    expect(nextPhaseAfter(broken, 'focus', 1).phase).toBe('longBreak');
  });
});

describe('the cycle dots', () => {
  it('show how many focus sessions are done', () => {
    expect(cycleDots(S, 0, 'focus')).toEqual([false, false, false, false]);
    expect(cycleDots(S, 2, 'focus')).toEqual([true, true, false, false]);
    expect(cycleDots(S, 3, 'shortBreak')).toEqual([true, true, true, false]);
  });

  it('are all filled during the long break', () => {
    expect(cycleDots(S, 4, 'longBreak')).toEqual([true, true, true, true]);
  });

  it('number as many as the long-break interval', () => {
    expect(cycleDots({ ...S, longBreakEvery: 6 }, 0, 'idle')).toHaveLength(6);
  });
});

describe('the Flowtime break suggestion', () => {
  it('defaults to a fifth of the time worked', () => {
    expect(flowtimeBreakMs(S, 50 * MINUTE_MS)).toBe(10 * MINUTE_MS);
    expect(flowtimeBreakMs(S, 90 * MINUTE_MS)).toBe(18 * MINUTE_MS);
  });

  it('takes the ratio from the settings', () => {
    expect(flowtimeBreakMs({ ...S, flowtimeBreakRatio: 0.25 }, 40 * MINUTE_MS)).toBe(
      10 * MINUTE_MS,
    );
  });

  it('clamps to a sensible minimum and maximum', () => {
    expect(flowtimeBreakMs(S, 2 * MINUTE_MS)).toBe(3 * MINUTE_MS);
    expect(flowtimeBreakMs(S, 10 * 60 * MINUTE_MS)).toBe(30 * MINUTE_MS);
  });
});
