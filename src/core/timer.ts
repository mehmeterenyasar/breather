import { cycleDots, flowtimeBreakMs, nextPhaseAfter, phaseDurationMs } from './pomodoro';
import { minutesToMs } from './time';
import { isBreakPhase } from './types';
import type { Mode, Phase, Status, TimerSettings } from './types';

/**
 * The timer itself. No browser APIs in here, and no reads of the wall clock:
 * `now` always arrives as an argument.
 *
 * An MV3 service worker can be suspended at any moment, so the state is never a
 * countdown. It is a handful of timestamps:
 *
 *   startedAt + pausedTotalMs (+ any pause in progress) + plannedMs + extendedMs
 *
 * and the remaining time is worked out from `now` on every read. Suspending the
 * worker, closing the browser or sleeping the machine therefore cannot put this
 * out of step; the arithmetic simply picks up whatever the clock says.
 */
export interface TimerState {
  mode: Mode;
  phase: Phase;
  status: Status;
  /** When the current phase started. */
  startedAt?: number;
  /**
   * Planned net length. Undefined means the phase counts up instead (stopwatch
   * and Flowtime focus), so there is no deadline at all.
   */
  plannedMs?: number;
  /** Everything added with the "+5 min" button. */
  extendedMs: number;
  /** Derived, and only set while running a counted-down phase. The alarm uses it. */
  targetEndAt?: number;

  pausedAt?: number;
  /** Sum of the pauses that have already ended. */
  pausedTotalMs: number;
  /** Focus sessions finished in the current cycle. */
  pomodoroIndex: number;
  tagId?: string;
  sessionId?: string;
  /** Did the user start this phase, or did the auto-start chain? */
  autoStarted: boolean;
}

/** Below this, a focus session is treated as a misclick and never recorded. */
export const MIN_RECORD_MS = 60_000;

/**
 * How late we can notice a finished phase and still chain into the next one.
 *
 * If the browser was shut for ten minutes, saying "your break started then" is
 * simply false, so past this window the session is closed at its real end time
 * and the timer goes idle instead.
 */
export const AUTOSTART_GRACE_MS = 90_000;

export interface TransitionCtx {
  now: number;
  /** Injected so this file stays free of crypto and randomness. */
  newId: () => string;
}

export type TimerEvent =
  | { type: 'SET_MODE'; mode: Mode }
  | {
      type: 'START';
      mode?: Mode;
      phase?: Phase;
      plannedMs?: number;
      tagId?: string;
      autoStarted?: boolean;
    }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'TOGGLE' }
  | { type: 'RESET' }
  | { type: 'EXTEND'; ms?: number }
  | { type: 'SKIP' }
  | { type: 'FINISH' }
  /** Phase finished. Pass `at` to use the real deadline rather than a late alarm. */
  | { type: 'COMPLETE'; at?: number }
  | { type: 'SET_TAG'; tagId?: string }
  /** Give back time that idle detection recorded as a pause. */
  | { type: 'ADD_PAUSED_TIME'; ms: number };

/** A finished focus session, on its way to IndexedDB. */
export interface ClosedSessionDraft {
  id: string;
  mode: Mode;
  phase: Phase;
  start: number;
  end: number;
  /** Net time, pauses excluded. */
  durationMs: number;
  pausedMs: number;
  tagId?: string;
  completed: boolean;
}

export type TimerEffect =
  | { kind: 'focusDiscarded'; durationMs: number }
  | {
      kind: 'breakClosed';
      phase: 'shortBreak' | 'longBreak';
      action: 'taken' | 'skipped';
      at: number;
      durationMs: number;
    }
  | { kind: 'phaseEnded'; phase: Phase; nextPhase: Phase; at: number; completed: boolean }
  | { kind: 'phaseStarted'; phase: Phase; mode: Mode; at: number; autoStarted: boolean }
  | { kind: 'suggestBreak'; ms: number; at: number }
  /** The phase ended while nobody was watching, `overdueMs` ago. */
  | { kind: 'staleCompletion'; overdueMs: number; at: number };

export interface Transition {
  state: TimerState;
  closed?: ClosedSessionDraft;
  effects: TimerEffect[];
}

export function initialState(mode: Mode = 'pomodoro'): TimerState {
  return {
    mode,
    phase: 'idle',
    status: 'idle',
    extendedMs: 0,
    pausedTotalMs: 0,
    pomodoroIndex: 0,
    autoStarted: false,
  };
}

export function isCountUp(state: TimerState): boolean {
  return state.plannedMs == null;
}

/** Length of the pause currently in progress. */
export function activePauseMs(state: TimerState, now: number): number {
  if (state.status !== 'paused' || state.pausedAt == null) return 0;
  return Math.max(0, now - state.pausedAt);
}

export function pausedMsAt(state: TimerState, now: number): number {
  return state.pausedTotalMs + activePauseMs(state, now);
}

/** Elapsed time with pauses taken out. */
export function elapsedMs(state: TimerState, now: number): number {
  if (state.startedAt == null || state.status === 'idle') return 0;
  return Math.max(0, now - state.startedAt - pausedMsAt(state, now));
}

/** Planned plus added time, or null when the phase counts up. */
export function totalPlannedMs(state: TimerState): number | null {
  if (state.plannedMs == null) return null;
  return state.plannedMs + state.extendedMs;
}

/** Can go negative when an alarm fires late, which is how lateness is detected. */
export function remainingMs(state: TimerState, now: number): number | null {
  const total = totalPlannedMs(state);
  if (total == null) return null;
  return total - elapsedMs(state, now);
}

/** The moment to set the alarm for. */
export function nextDeadlineAt(state: TimerState): number | undefined {
  const total = totalPlannedMs(state);
  if (state.status !== 'running' || state.startedAt == null || total == null) return undefined;
  return state.startedAt + state.pausedTotalMs + total;
}

/**
 * Next nudge for the stopwatch reminder.
 *
 * Pauses don't count: a 50 minute reminder means 50 minutes of actual work, so
 * pausing for half an hour pushes the reminder out by half an hour too.
 */
export function nextReminderAt(
  state: TimerState,
  intervalMs: number | null,
  now: number,
): number | undefined {
  if (intervalMs == null || intervalMs <= 0) return undefined;
  if (state.status !== 'running' || state.startedAt == null) return undefined;
  if (!isCountUp(state)) return undefined;

  const steps = Math.floor(elapsedMs(state, now) / intervalMs) + 1;
  return state.startedAt + state.pausedTotalMs + steps * intervalMs;
}

export function progress(state: TimerState, now: number): number | null {
  const total = totalPlannedMs(state);
  if (total == null || total <= 0) return null;
  return Math.min(1, Math.max(0, elapsedMs(state, now) / total));
}

export interface TimerSnapshot {
  state: TimerState;
  now: number;
  elapsedMs: number;
  remainingMs: number | null;
  /** What the ring shows: time left counting down, time spent counting up. */
  displayMs: number;
  progress: number | null;
  dots: boolean[];
  isCountUp: boolean;
}

export function snapshot(state: TimerState, settings: TimerSettings, now: number): TimerSnapshot {
  const remaining = remainingMs(state, now);
  const elapsed = elapsedMs(state, now);
  return {
    state,
    now,
    elapsedMs: elapsed,
    remainingMs: remaining,
    displayMs: remaining == null ? elapsed : Math.max(0, remaining),
    progress: progress(state, now),
    dots: cycleDots(settings, state.pomodoroIndex, state.phase),
    isCountUp: remaining == null,
  };
}

function withDerived(state: TimerState): TimerState {
  const target = nextDeadlineAt(state);
  if (target == null) {
    const next = { ...state };
    delete next.targetEndAt;
    return next;
  }
  return { ...state, targetEndAt: target };
}

function resolvePlannedMs(
  mode: Mode,
  phase: Phase,
  settings: TimerSettings,
  explicit?: number,
): number | undefined {
  if (explicit != null) return Math.max(0, Math.round(explicit));
  switch (mode) {
    case 'pomodoro':
      return phaseDurationMs(settings, phase);
    case 'countdown':
      return minutesToMs(settings.countdownDefaultMin);
    case 'stopwatch':
    case 'flowtime':
      // Focus counts up here, but breaks still count down.
      return isBreakPhase(phase) ? phaseDurationMs(settings, phase) : undefined;
  }
}

function startPhase(args: {
  mode: Mode;
  phase: Phase;
  plannedMs: number | undefined;
  at: number;
  tagId?: string;
  pomodoroIndex: number;
  autoStarted: boolean;
  id: string;
}): TimerState {
  return withDerived({
    mode: args.mode,
    phase: args.phase,
    status: 'running',
    startedAt: args.at,
    plannedMs: args.plannedMs,
    extendedMs: 0,
    pausedTotalMs: 0,
    pomodoroIndex: args.pomodoroIndex,
    tagId: args.tagId,
    sessionId: args.id,
    autoStarted: args.autoStarted,
  });
}

function idleFrom(state: TimerState): TimerState {
  return {
    mode: state.mode,
    phase: 'idle',
    status: 'idle',
    extendedMs: 0,
    pausedTotalMs: 0,
    pomodoroIndex: state.pomodoroIndex,
    tagId: state.tagId,
    autoStarted: false,
  };
}

/** Closes the phase: focus produces a session, a break produces a break event. */
function closeCurrent(
  state: TimerState,
  at: number,
  completed: boolean,
): { closed?: ClosedSessionDraft; effects: TimerEffect[] } {
  if (state.status === 'idle' || state.startedAt == null) return { effects: [] };

  const duration = elapsedMs(state, at);
  const paused = pausedMsAt(state, at);

  if (isBreakPhase(state.phase)) {
    return {
      effects: [
        {
          kind: 'breakClosed',
          phase: state.phase,
          action: completed ? 'taken' : 'skipped',
          at,
          durationMs: duration,
        },
      ],
    };
  }

  if (duration < MIN_RECORD_MS) {
    return { effects: [{ kind: 'focusDiscarded', durationMs: duration }] };
  }

  return {
    closed: {
      id: state.sessionId ?? String(state.startedAt),
      mode: state.mode,
      phase: state.phase,
      start: state.startedAt,
      end: at,
      durationMs: duration,
      pausedMs: paused,
      tagId: state.tagId,
      completed,
    },
    effects: [],
  };
}

/**
 * What follows a finished phase. Pomodoro walks its cycle, countdown and
 * stopwatch simply stop, and Flowtime proposes a break.
 */
function advance(args: {
  state: TimerState;
  settings: TimerSettings;
  at: number;
  completed: boolean;
  allowAutoStart: boolean;
  ctx: TransitionCtx;
  workedMs: number;
}): { state: TimerState; effects: TimerEffect[] } {
  const { state, settings, at, completed, allowAutoStart, ctx, workedMs } = args;
  const effects: TimerEffect[] = [];

  if (state.mode === 'pomodoro') {
    const next = nextPhaseAfter(settings, state.phase, state.pomodoroIndex);
    effects.push({ kind: 'phaseEnded', phase: state.phase, nextPhase: next.phase, at, completed });

    if (next.autoStart && allowAutoStart) {
      const started = startPhase({
        mode: state.mode,
        phase: next.phase,
        plannedMs: phaseDurationMs(settings, next.phase),
        at,
        tagId: state.tagId,
        pomodoroIndex: next.pomodoroIndex,
        autoStarted: true,
        id: ctx.newId(),
      });
      effects.push({
        kind: 'phaseStarted',
        phase: next.phase,
        mode: state.mode,
        at,
        autoStarted: true,
      });
      return { state: started, effects };
    }

    return { state: { ...idleFrom(state), pomodoroIndex: next.pomodoroIndex }, effects };
  }

  // The other modes have no cycle to advance.
  effects.push({ kind: 'phaseEnded', phase: state.phase, nextPhase: 'idle', at, completed });

  if (state.mode === 'flowtime' && state.phase === 'focus' && workedMs >= MIN_RECORD_MS) {
    effects.push({ kind: 'suggestBreak', ms: flowtimeBreakMs(settings, workedMs), at });
  }

  return { state: idleFrom(state), effects };
}

export function transition(
  state: TimerState,
  event: TimerEvent,
  settings: TimerSettings,
  ctx: TransitionCtx,
): Transition {
  const { now } = ctx;
  const noop: Transition = { state, effects: [] };

  switch (event.type) {
    case 'SET_MODE': {
      // Switching mode mid-session would throw the session away. The tabs are
      // disabled in the UI; this is the backstop.
      if (state.status !== 'idle') return noop;
      if (state.mode === event.mode) return noop;
      return { state: { ...initialState(event.mode), tagId: state.tagId }, effects: [] };
    }

    case 'START': {
      if (state.status !== 'idle') return noop;
      const mode = event.mode ?? state.mode;
      const phase = event.phase ?? 'focus';
      const autoStarted = event.autoStarted ?? false;
      const next = startPhase({
        mode,
        phase,
        plannedMs: resolvePlannedMs(mode, phase, settings, event.plannedMs),
        at: now,
        tagId: event.tagId ?? state.tagId,
        pomodoroIndex: state.pomodoroIndex,
        autoStarted,
        id: ctx.newId(),
      });
      return {
        state: next,
        effects: [{ kind: 'phaseStarted', phase, mode, at: now, autoStarted }],
      };
    }

    case 'PAUSE': {
      if (state.status !== 'running') return noop;
      return { state: withDerived({ ...state, status: 'paused', pausedAt: now }), effects: [] };
    }

    case 'RESUME': {
      if (state.status !== 'paused' || state.pausedAt == null) return noop;
      const pausedTotalMs = state.pausedTotalMs + Math.max(0, now - state.pausedAt);
      const resumed = withDerived({ ...state, status: 'running', pausedTotalMs });
      delete resumed.pausedAt;
      return { state: resumed, effects: [] };
    }

    case 'TOGGLE': {
      if (state.status === 'running') return transition(state, { type: 'PAUSE' }, settings, ctx);
      if (state.status === 'paused') return transition(state, { type: 'RESUME' }, settings, ctx);
      return transition(state, { type: 'START' }, settings, ctx);
    }

    case 'RESET': {
      // Reset leaves no trace. It exists to undo a phase you didn't mean to start.
      if (state.status === 'idle') return noop;
      return { state: idleFrom(state), effects: [] };
    }

    case 'EXTEND': {
      if (state.status === 'idle' || isCountUp(state)) return noop;
      const ms = event.ms ?? minutesToMs(settings.extendMin);
      if (ms <= 0) return noop;
      return { state: withDerived({ ...state, extendedMs: state.extendedMs + ms }), effects: [] };
    }

    case 'SET_TAG': {
      if (state.tagId === event.tagId) return noop;
      return { state: { ...state, tagId: event.tagId }, effects: [] };
    }

    case 'ADD_PAUSED_TIME': {
      // Idle time was booked as a pause, so handing it back means taking it off
      // the pause total.
      if (state.status === 'idle' || event.ms <= 0) return noop;
      const pausedTotalMs = Math.max(0, state.pausedTotalMs - event.ms);
      if (pausedTotalMs === state.pausedTotalMs) return noop;
      return { state: withDerived({ ...state, pausedTotalMs }), effects: [] };
    }

    case 'SKIP':
    case 'FINISH':
    case 'COMPLETE': {
      if (state.status === 'idle') return noop;
      if (event.type === 'COMPLETE' && isCountUp(state)) return noop;

      const completed = event.type !== 'SKIP';
      const at = event.type === 'COMPLETE' ? (event.at ?? now) : now;
      const overdueMs = event.type === 'COMPLETE' ? Math.max(0, now - at) : 0;
      const allowAutoStart = overdueMs <= AUTOSTART_GRACE_MS;

      const closedResult = closeCurrent(state, at, completed);

      // A focus too short to record shouldn't advance the cycle or trigger a
      // break either. Treat it like a reset.
      if (closedResult.effects.some((e) => e.kind === 'focusDiscarded')) {
        return { state: idleFrom(state), effects: closedResult.effects };
      }

      const advanced = advance({
        state,
        settings,
        at,
        completed,
        allowAutoStart,
        ctx,
        workedMs: elapsedMs(state, at),
      });

      const effects = [...closedResult.effects, ...advanced.effects];
      if (overdueMs > AUTOSTART_GRACE_MS) {
        effects.push({ kind: 'staleCompletion', overdueMs, at });
      }

      return { state: advanced.state, closed: closedResult.closed, effects };
    }
  }
}

/**
 * Brings the stored state back in line with the real clock. Called whenever the
 * worker wakes, the browser starts, or the machine comes back from sleep.
 *
 * Deadline still ahead, nothing to do; the caller re-arms the alarm. Deadline
 * passed, the session closes at `targetEndAt` rather than now, and if we are
 * more than AUTOSTART_GRACE_MS late the chain stops there. Counting-up phases
 * just keep counting.
 */
export function reconcile(
  state: TimerState,
  settings: TimerSettings,
  ctx: TransitionCtx,
): Transition {
  if (state.status !== 'running') return { state, effects: [] };

  const deadline = nextDeadlineAt(state);
  if (deadline == null || deadline > ctx.now) return { state, effects: [] };

  return transition(state, { type: 'COMPLETE', at: deadline }, settings, ctx);
}

export type { Mode, Phase, Status, TimerSettings };
