import { describe, expect, it } from 'vitest';
import { normalizeTimerState } from '@/storage/timer-state';
import { MINUTE_MS } from '@/core/time';

/**
 * Whatever comes out of storage is suspect: it may be from an older version, a
 * write that was cut off, or someone editing it by hand. Falling back to idle
 * beats running a state that contradicts itself, but the cycle position has to
 * survive the fall.
 */

const T0 = new Date(2026, 2, 2, 9, 0, 0, 0).getTime();

const running = {
  mode: 'pomodoro',
  phase: 'focus',
  status: 'running',
  startedAt: T0,
  plannedMs: 25 * MINUTE_MS,
  extendedMs: 0,
  targetEndAt: T0 + 25 * MINUTE_MS,
  pausedTotalMs: 0,
  pomodoroIndex: 2,
  autoStarted: false,
  sessionId: 'abc',
};

describe('reading the timer state', () => {
  it('returns a valid record unchanged', () => {
    expect(normalizeTimerState(running)).toMatchObject({
      status: 'running',
      startedAt: T0,
      plannedMs: 25 * MINUTE_MS,
      pomodoroIndex: 2,
      sessionId: 'abc',
    });
  });

  it('falls back to the initial state for anything that is not an object', () => {
    expect(normalizeTimerState(undefined).status).toBe('idle');
    expect(normalizeTimerState(null).status).toBe('idle');
    expect(normalizeTimerState('bozuk').status).toBe('idle');
    expect(normalizeTimerState([]).status).toBe('idle');
  });

  it('keeps the cycle position and the tag even when falling back', () => {
    const state = normalizeTimerState({
      mode: 'pomodoro',
      phase: 'idle',
      status: 'idle',
      pomodoroIndex: 3,
      tagId: 'kod',
    });

    expect(state.pomodoroIndex).toBe(3);
    expect(state.tagId).toBe('kod');
  });

  it('treats running without a start time as corrupt', () => {
    const state = normalizeTimerState({ ...running, startedAt: undefined });
    expect(state.status).toBe('idle');
    expect(state.pomodoroIndex).toBe(2);
  });

  it('treats paused without a pause time as corrupt', () => {
    const state = normalizeTimerState({ ...running, status: 'paused' });
    expect(state.status).toBe('idle');
  });

  it('replaces an unknown mode, phase or status with a safe default', () => {
    const state = normalizeTimerState({ ...running, mode: 'turbo', phase: 'uyku', status: 'hmm' });
    expect(state.mode).toBe('pomodoro');
    expect(state.status).toBe('idle');
  });

  it('cleans up negative and non-numeric durations', () => {
    const state = normalizeTimerState({
      ...running,
      pausedTotalMs: -500,
      extendedMs: 'lots',
      pomodoroIndex: -3,
    });

    expect(state.pausedTotalMs).toBe(0);
    expect(state.extendedMs).toBe(0);
    expect(state.pomodoroIndex).toBe(0);
  });

  it('keeps the mode, so the chosen tab does not reset itself', () => {
    expect(normalizeTimerState({ mode: 'flowtime', status: 'idle', phase: 'idle' }).mode).toBe(
      'flowtime',
    );
  });
});
