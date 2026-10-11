import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTOSTART_GRACE_MS,
  elapsedMs,
  initialState,
  nextDeadlineAt,
  reconcile,
  remainingMs,
  transition,
  type TimerEvent,
  type TimerState,
  type Transition,
  type TransitionCtx,
} from '@/core/timer';
import { MINUTE_MS } from '@/core/time';
import { DEFAULT_SETTINGS } from '@/storage/schema';
import type { TimerSettings } from '@/core/types';

const S: TimerSettings = DEFAULT_SETTINGS.timer;
/** A fixed starting point: 2 March 2026, 09:00 local. */
const T0 = new Date(2026, 2, 2, 9, 0, 0, 0).getTime();

let idCounter = 0;
const ctx = (now: number): TransitionCtx => ({ now, newId: () => `id-${++idCounter}` });

beforeEach(() => {
  idCounter = 0;
});

/** Applies a list of events in order and returns the last transition. */
function run(
  start: TimerState,
  steps: Array<[offsetMs: number, event: TimerEvent]>,
  settings: TimerSettings = S,
): Transition {
  let result: Transition = { state: start, effects: [] };
  for (const [offset, event] of steps) {
    result = transition(result.state, event, settings, ctx(T0 + offset));
  }
  return result;
}

describe('starting and reading the timer', () => {
  it('sets a 25 minute focus and derives the end from the timestamp', () => {
    const { state } = run(initialState('pomodoro'), [[0, { type: 'START' }]]);

    expect(state.status).toBe('running');
    expect(state.phase).toBe('focus');
    expect(state.plannedMs).toBe(25 * MINUTE_MS);
    expect(state.targetEndAt).toBe(T0 + 25 * MINUTE_MS);
    expect(state.sessionId).toBe('id-1');
  });

  it('works the remaining time out from `now` on every read', () => {
    const { state } = run(initialState(), [[0, { type: 'START' }]]);

    expect(remainingMs(state, T0)).toBe(25 * MINUTE_MS);
    expect(remainingMs(state, T0 + 10 * MINUTE_MS)).toBe(15 * MINUTE_MS);
    // It goes negative past the end, which is how a late alarm is detected.
    expect(remainingMs(state, T0 + 26 * MINUTE_MS)).toBe(-1 * MINUTE_MS);
  });

  it('ignores START and SET_MODE while running, rather than losing the session', () => {
    const started = run(initialState(), [[0, { type: 'START' }]]).state;

    expect(run(started, [[MINUTE_MS, { type: 'START' }]]).state).toBe(started);
    expect(run(started, [[MINUTE_MS, { type: 'SET_MODE', mode: 'stopwatch' }]]).state).toBe(
      started,
    );
  });
});

describe('the pause arithmetic', () => {
  it('freezes the remaining time, and resuming pushes the end out', () => {
    const paused = run(initialState(), [
      [0, { type: 'START' }],
      [10 * MINUTE_MS, { type: 'PAUSE' }],
    ]).state;

    // The remaining time does not move while paused.
    expect(remainingMs(paused, T0 + 10 * MINUTE_MS)).toBe(15 * MINUTE_MS);
    expect(remainingMs(paused, T0 + 14 * MINUTE_MS)).toBe(15 * MINUTE_MS);
    // And no alarm is armed.
    expect(nextDeadlineAt(paused)).toBeUndefined();

    const resumed = run(paused, [[15 * MINUTE_MS, { type: 'RESUME' }]]).state;

    expect(resumed.pausedTotalMs).toBe(5 * MINUTE_MS);
    expect(resumed.targetEndAt).toBe(T0 + 30 * MINUTE_MS);
    expect(remainingMs(resumed, T0 + 20 * MINUTE_MS)).toBe(10 * MINUTE_MS);
  });

  it('leaves pauses out of the elapsed time', () => {
    const state = run(initialState(), [
      [0, { type: 'START' }],
      [5 * MINUTE_MS, { type: 'PAUSE' }],
      [9 * MINUTE_MS, { type: 'RESUME' }],
    ]).state;

    expect(elapsedMs(state, T0 + 12 * MINUTE_MS)).toBe(8 * MINUTE_MS);
  });

  it('makes TOGGLE start, pause and resume in turn', () => {
    let state = run(initialState(), [[0, { type: 'TOGGLE' }]]).state;
    expect(state.status).toBe('running');

    state = run(state, [[MINUTE_MS, { type: 'TOGGLE' }]]).state;
    expect(state.status).toBe('paused');

    state = run(state, [[2 * MINUTE_MS, { type: 'TOGGLE' }]]).state;
    expect(state.status).toBe('running');
  });

  it('extends the end, and does nothing while counting up', () => {
    const extended = run(initialState(), [
      [0, { type: 'START' }],
      [MINUTE_MS, { type: 'EXTEND' }],
    ]).state;
    expect(extended.extendedMs).toBe(5 * MINUTE_MS);
    expect(extended.targetEndAt).toBe(T0 + 30 * MINUTE_MS);

    const stopwatch = run(initialState('stopwatch'), [
      [0, { type: 'START' }],
      [MINUTE_MS, { type: 'EXTEND' }],
    ]).state;
    expect(stopwatch.extendedMs).toBe(0);
  });

  it('can hand back the time spent away', () => {
    const state = run(initialState('stopwatch'), [
      [0, { type: 'START' }],
      [10 * MINUTE_MS, { type: 'PAUSE' }],
      [15 * MINUTE_MS, { type: 'RESUME' }],
      [15 * MINUTE_MS, { type: 'ADD_PAUSED_TIME', ms: 5 * MINUTE_MS }],
    ]).state;

    expect(state.pausedTotalMs).toBe(0);
    expect(elapsedMs(state, T0 + 15 * MINUTE_MS)).toBe(15 * MINUTE_MS);
  });
});

describe('closing a session', () => {
  it('records the net duration and queues up the short break', () => {
    const started = run(initialState(), [[0, { type: 'START' }]]).state;
    const result = transition(
      started,
      { type: 'COMPLETE', at: T0 + 25 * MINUTE_MS },
      S,
      ctx(T0 + 25 * MINUTE_MS),
    );

    expect(result.closed).toMatchObject({
      start: T0,
      end: T0 + 25 * MINUTE_MS,
      durationMs: 25 * MINUTE_MS,
      pausedMs: 0,
      completed: true,
      phase: 'focus',
      mode: 'pomodoro',
    });
    expect(result.state.status).toBe('idle');
    expect(result.state.pomodoroIndex).toBe(1);
    expect(result.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'phaseEnded', nextPhase: 'shortBreak', completed: true }),
      ]),
    );
  });

  it('excludes the pauses from a recorded session', () => {
    const state = run(initialState(), [
      [0, { type: 'START' }],
      [5 * MINUTE_MS, { type: 'PAUSE' }],
      [8 * MINUTE_MS, { type: 'RESUME' }],
    ]).state;
    const end = nextDeadlineAt(state)!;
    const result = transition(state, { type: 'COMPLETE', at: end }, S, ctx(end));

    expect(end).toBe(T0 + 28 * MINUTE_MS);
    expect(result.closed?.durationMs).toBe(25 * MINUTE_MS);
    expect(result.closed?.pausedMs).toBe(3 * MINUTE_MS);
  });

  it('starts the break at the end when auto-start is on', () => {
    const settings: TimerSettings = { ...S, autoStartBreak: true };
    const started = run(initialState(), [[0, { type: 'START' }]], settings).state;
    const end = T0 + 25 * MINUTE_MS;
    const result = transition(started, { type: 'COMPLETE', at: end }, settings, ctx(end));

    expect(result.state.status).toBe('running');
    expect(result.state.phase).toBe('shortBreak');
    expect(result.state.startedAt).toBe(end);
    expect(result.state.autoStarted).toBe(true);
    expect(result.state.targetEndAt).toBe(end + 5 * MINUTE_MS);
  });

  it('gives a long break after the fourth focus and then resets the cycle', () => {
    const settings: TimerSettings = { ...S, autoStartBreak: true, autoStartFocus: true };
    let state = initialState('pomodoro');
    let at = T0;

    for (let i = 0; i < 4; i++) {
      state = transition(state, { type: 'START' }, settings, ctx(at)).state;
      at = nextDeadlineAt(state)!;
      const done = transition(state, { type: 'COMPLETE', at }, settings, ctx(at));
      state = done.state;
      expect(state.pomodoroIndex).toBe(i + 1);
      expect(state.phase).toBe(i === 3 ? 'longBreak' : 'shortBreak');

      at = nextDeadlineAt(state)!;
      state = transition(state, { type: 'COMPLETE', at }, settings, ctx(at)).state;
      expect(state.phase).toBe('focus');
    }

    expect(state.pomodoroIndex).toBe(0);
  });

  it('records a skipped focus as incomplete', () => {
    const started = run(initialState(), [[0, { type: 'START' }]]).state;
    const result = transition(started, { type: 'SKIP' }, S, ctx(T0 + 10 * MINUTE_MS));

    expect(result.closed).toMatchObject({ durationMs: 10 * MINUTE_MS, completed: false });
    expect(result.state.pomodoroIndex).toBe(1);
  });

  it('throws away a focus under a minute instead of recording it', () => {
    const started = run(initialState(), [[0, { type: 'START' }]]).state;
    const result = transition(started, { type: 'SKIP' }, S, ctx(T0 + 30 * 1000));

    expect(result.closed).toBeUndefined();
    expect(result.effects).toEqual([{ kind: 'focusDiscarded', durationMs: 30 * 1000 }]);
    expect(result.state.pomodoroIndex).toBe(0);
    expect(result.state.status).toBe('idle');
  });

  it('closes a skipped break as a break event, not a session', () => {
    const settings: TimerSettings = { ...S, autoStartBreak: true };
    const started = run(initialState(), [[0, { type: 'START' }]], settings).state;
    const end = T0 + 25 * MINUTE_MS;
    const inBreak = transition(started, { type: 'COMPLETE', at: end }, settings, ctx(end)).state;

    const result = transition(inBreak, { type: 'SKIP' }, settings, ctx(end + 60 * 1000));

    expect(result.closed).toBeUndefined();
    expect(result.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'breakClosed',
          phase: 'shortBreak',
          action: 'skipped',
          durationMs: 60 * 1000,
        }),
      ]),
    );
  });

  it('writes nothing when reset', () => {
    const started = run(initialState(), [[0, { type: 'START' }]]).state;
    const result = transition(started, { type: 'RESET' }, S, ctx(T0 + 10 * MINUTE_MS));

    expect(result.closed).toBeUndefined();
    expect(result.state.status).toBe('idle');
    expect(result.state.phase).toBe('idle');
  });
});

describe('the counting-up modes', () => {
  it('give the stopwatch no end, and record the net time when finished', () => {
    const started = run(initialState('stopwatch'), [[0, { type: 'START' }]]).state;

    expect(started.plannedMs).toBeUndefined();
    expect(remainingMs(started, T0 + MINUTE_MS)).toBeNull();
    expect(nextDeadlineAt(started)).toBeUndefined();

    const result = transition(started, { type: 'FINISH' }, S, ctx(T0 + 40 * MINUTE_MS));
    expect(result.closed).toMatchObject({ durationMs: 40 * MINUTE_MS, completed: true });
    expect(result.state.status).toBe('idle');
  });

  it('ignore COMPLETE, having nothing to complete', () => {
    const started = run(initialState('stopwatch'), [[0, { type: 'START' }]]).state;
    const result = transition(started, { type: 'COMPLETE' }, S, ctx(T0 + MINUTE_MS));

    expect(result.state).toBe(started);
  });

  it('suggest a fifth of the worked time as a Flowtime break', () => {
    const started = run(initialState('flowtime'), [[0, { type: 'START' }]]).state;
    const result = transition(started, { type: 'FINISH' }, S, ctx(T0 + 50 * MINUTE_MS));

    expect(result.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'suggestBreak', ms: 10 * MINUTE_MS }),
      ]),
    );
  });

  it('clamp that suggestion at both ends', () => {
    const short = transition(
      run(initialState('flowtime'), [[0, { type: 'START' }]]).state,
      { type: 'FINISH' },
      S,
      ctx(T0 + 5 * MINUTE_MS),
    );
    const long = transition(
      run(initialState('flowtime'), [[0, { type: 'START' }]]).state,
      { type: 'FINISH' },
      S,
      ctx(T0 + 300 * MINUTE_MS),
    );

    expect(short.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'suggestBreak', ms: 3 * MINUTE_MS }),
      ]),
    );
    expect(long.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'suggestBreak', ms: 30 * MINUTE_MS }),
      ]),
    );
  });

  it('take a custom length in countdown mode without touching the cycle', () => {
    const started = run(initialState('countdown'), [
      [0, { type: 'START', plannedMs: 10 * MINUTE_MS }],
    ]).state;
    expect(started.targetEndAt).toBe(T0 + 10 * MINUTE_MS);

    const end = T0 + 10 * MINUTE_MS;
    const result = transition(started, { type: 'COMPLETE', at: end }, S, ctx(end));
    expect(result.closed?.durationMs).toBe(10 * MINUTE_MS);
    expect(result.state.phase).toBe('idle');
    expect(result.state.pomodoroIndex).toBe(0);
  });
});

describe('reconciliation after a closed browser, a suspended worker or a sleeping machine', () => {
  const settings: TimerSettings = { ...S, autoStartBreak: true };

  it('leaves the state alone when the phase has not run out', () => {
    const started = run(initialState(), [[0, { type: 'START' }]], settings).state;
    const result = reconcile(started, settings, ctx(T0 + 10 * MINUTE_MS));

    expect(result.state).toBe(started);
    expect(result.closed).toBeUndefined();
  });

  it('closes the session at the real end time, not at the moment we noticed', () => {
    const started = run(initialState(), [[0, { type: 'START' }]], settings).state;
    const wake = T0 + 35 * MINUTE_MS; // opened 10 minutes after it ended
    const result = reconcile(started, settings, ctx(wake));

    expect(result.closed).toMatchObject({
      end: T0 + 25 * MINUTE_MS,
      durationMs: 25 * MINUTE_MS,
      completed: true,
    });
    // Too late to pretend the break has been running since then.
    expect(result.state.status).toBe('idle');
    expect(result.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'staleCompletion', overdueMs: 10 * MINUTE_MS }),
      ]),
    );
  });

  it('keeps the auto-start chain for a short delay', () => {
    const started = run(initialState(), [[0, { type: 'START' }]], settings).state;
    const wake = T0 + 25 * MINUTE_MS + AUTOSTART_GRACE_MS - 1000;
    const result = reconcile(started, settings, ctx(wake));

    expect(result.state.status).toBe('running');
    expect(result.state.phase).toBe('shortBreak');
    expect(result.state.startedAt).toBe(T0 + 25 * MINUTE_MS);
  });

  it('does not touch a paused or counting-up state', () => {
    const paused = run(initialState(), [
      [0, { type: 'START' }],
      [MINUTE_MS, { type: 'PAUSE' }],
    ]).state;
    const stopwatch = run(initialState('stopwatch'), [[0, { type: 'START' }]]).state;
    const muchLater = T0 + 5 * 60 * MINUTE_MS;

    expect(reconcile(paused, S, ctx(muchLater)).state).toBe(paused);
    expect(reconcile(stopwatch, S, ctx(muchLater)).state).toBe(stopwatch);
    expect(elapsedMs(stopwatch, muchLater)).toBe(5 * 60 * MINUTE_MS);
  });
});
