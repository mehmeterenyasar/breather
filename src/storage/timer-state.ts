import { storage } from 'wxt/utils/storage';
import { initialState } from '@/core/timer';
import type { TimerState } from '@/core/timer';
import { MODES } from '@/core/types';
import type { Mode, Phase, Status } from '@/core/types';

/**
 * Timer state is `local`, deliberately not `sync`.
 *
 * It is written on every start, pause and extend, which would run straight into
 * the sync write limits (Chrome allows 120 a minute) and invite races between
 * machines. And a running timer belongs to one machine anyway.
 */

const KEY = 'local:timerState' as const;

const PHASES: readonly Phase[] = ['focus', 'shortBreak', 'longBreak', 'idle'];
const STATUSES: readonly Status[] = ['idle', 'running', 'paused'];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const numOrUndefined = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/**
 * Turns whatever came out of storage into a state we can trust. A record that
 * contradicts itself (running, but no `startedAt`) is treated as corrupt and
 * dropped to idle; a stopped timer is better than an undefined one.
 */
export function normalizeTimerState(raw: unknown): TimerState {
  if (!isRecord(raw)) return initialState();

  const mode = (MODES.includes(raw.mode as Mode) ? raw.mode : 'pomodoro') as Mode;
  const phase = (PHASES.includes(raw.phase as Phase) ? raw.phase : 'idle') as Phase;
  const status = (STATUSES.includes(raw.status as Status) ? raw.status : 'idle') as Status;

  // Keep the cycle position and the tag: the ●●○○ row shouldn't reset itself
  // between two focus sessions.
  const idle = (): TimerState => ({
    ...initialState(mode),
    pomodoroIndex: Math.max(0, Math.round(numOrUndefined(raw.pomodoroIndex) ?? 0)),
    tagId: typeof raw.tagId === 'string' ? raw.tagId : undefined,
  });

  if (status === 'idle' || phase === 'idle') return idle();

  const startedAt = numOrUndefined(raw.startedAt);
  if (startedAt == null) return idle();
  if (status === 'paused' && numOrUndefined(raw.pausedAt) == null) return idle();

  const state: TimerState = {
    mode,
    phase,
    status,
    startedAt,
    plannedMs: numOrUndefined(raw.plannedMs),
    extendedMs: numOrUndefined(raw.extendedMs) ?? 0,
    targetEndAt: numOrUndefined(raw.targetEndAt),
    pausedAt: numOrUndefined(raw.pausedAt),
    pausedTotalMs: Math.max(0, numOrUndefined(raw.pausedTotalMs) ?? 0),
    pomodoroIndex: Math.max(0, Math.round(numOrUndefined(raw.pomodoroIndex) ?? 0)),
    tagId: typeof raw.tagId === 'string' ? raw.tagId : undefined,
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : undefined,
    autoStarted: raw.autoStarted === true,
  };

  return state;
}

export async function readTimerState(): Promise<TimerState> {
  return normalizeTimerState(await storage.getItem<unknown>(KEY));
}

export async function writeTimerState(state: TimerState): Promise<void> {
  await storage.setItem(KEY, state);
}

export function watchTimerState(callback: (state: TimerState) => void): () => void {
  return storage.watch<unknown>(KEY, (value) => callback(normalizeTimerState(value)));
}
