import { describe, expect, it } from 'vitest';
import { COUNTDOWN_PRESETS_MIN, clampDurationMin } from '@/core/presets';
import { MINUTE_MS } from '@/core/time';
import { initialState, nextReminderAt, transition } from '@/core/timer';
import type { TimerState, TransitionCtx } from '@/core/timer';
import { DEFAULT_SETTINGS } from '@/storage/schema';

const S = DEFAULT_SETTINGS.timer;
const T0 = new Date(2026, 2, 2, 9, 0, 0, 0).getTime();
const ctx = (now: number): TransitionCtx => ({ now, newId: () => 'id' });

function startStopwatch(): TimerState {
  return transition(initialState('stopwatch'), { type: 'START' }, S, ctx(T0)).state;
}

describe('the stopwatch nudge', () => {
  const interval = 50 * MINUTE_MS;

  it('comes one interval after the start', () => {
    expect(nextReminderAt(startStopwatch(), interval, T0)).toBe(T0 + interval);
  });

  it('aims for the next one if an interval has already passed', () => {
    const state = startStopwatch();
    expect(nextReminderAt(state, interval, T0 + 51 * MINUTE_MS)).toBe(T0 + 2 * interval);
  });

  it('counts worked time, not wall-clock time', () => {
    const paused = transition(startStopwatch(), { type: 'PAUSE' }, S, ctx(T0 + 10 * MINUTE_MS));
    const resumed = transition(paused.state, { type: 'RESUME' }, S, ctx(T0 + 40 * MINUTE_MS));

    // Paused for 30 minutes, so 50 minutes of work lands at minute 80.
    expect(nextReminderAt(resumed.state, interval, T0 + 40 * MINUTE_MS)).toBe(T0 + 80 * MINUTE_MS);
  });

  it('arms nothing when switched off or given a nonsense interval', () => {
    const state = startStopwatch();
    expect(nextReminderAt(state, null, T0)).toBeUndefined();
    expect(nextReminderAt(state, 0, T0)).toBeUndefined();
    expect(nextReminderAt(state, -1000, T0)).toBeUndefined();
  });

  it('stays out of the way of counted-down phases, which have an end alarm', () => {
    const pomodoro = transition(initialState('pomodoro'), { type: 'START' }, S, ctx(T0)).state;
    expect(nextReminderAt(pomodoro, interval, T0)).toBeUndefined();
  });

  it('arms nothing while paused or idle', () => {
    const paused = transition(startStopwatch(), { type: 'PAUSE' }, S, ctx(T0 + MINUTE_MS));
    expect(nextReminderAt(paused.state, interval, T0 + MINUTE_MS)).toBeUndefined();
    expect(nextReminderAt(initialState('stopwatch'), interval, T0)).toBeUndefined();
  });
});

describe('the countdown presets', () => {
  it('are the lengths we expect', () => {
    expect([...COUNTDOWN_PRESETS_MIN]).toEqual([5, 10, 15, 30, 45, 60]);
  });

  it('clamp a custom length to between 1 and 180', () => {
    expect(clampDurationMin(0)).toBe(1);
    expect(clampDurationMin(-20)).toBe(1);
    expect(clampDurationMin(999)).toBe(180);
    expect(clampDurationMin(42.6)).toBe(43);
    expect(clampDurationMin(Number.NaN)).toBe(1);
  });
});
