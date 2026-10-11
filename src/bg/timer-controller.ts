import {
  elapsedMs,
  initialState,
  nextDeadlineAt,
  nextReminderAt,
  reconcile,
  transition,
} from '@/core/timer';
import type { Transition, TimerEvent, TimerState, TransitionCtx } from '@/core/timer';
import { dayKey, minutesToMs } from '@/core/time';
import { addBreakEvent, addSession, reviewSession, totalsForDay } from '@/db/sessions';
import { readSettings, updateSettings } from '@/storage/settings';
import type { Settings } from '@/storage/schema';
import { readTimerState, writeTimerState } from '@/storage/timer-state';
import { readTodaySummary, writeTodaySummary } from '@/storage/today-cache';
import type { TodaySummary } from '@/storage/today-cache';
import {
  clearBreakSuggestion,
  clearIdlePrompt,
  clearPendingReview,
  readIdlePrompt,
  setBreakSuggestion,
  setPendingReview,
} from '@/storage/ui-queue';
import { ALARM, armAt, armEveryMinute, clearAlarms } from './alarms';
import { cleanupAudio, playBreakEndSound, playFocusEndSound, previewSound } from './audio';
import { updateBadge } from './badge';
import { onPhaseStarted } from './health-controller';
import { notifyBreakDone, notifyFocusDone, notifyReminder, notifyStaleCompletion } from './notify';

/**
 * The only bridge between the pure core and the browser.
 *
 * Every operation goes the same way round: re-read the state from storage, run
 * the reducer, write the result, re-arm the alarms. Nothing is ever read from a
 * variable left over from an earlier call, because the worker may well have
 * been suspended in between and that variable is a lie.
 */

function makeCtx(now = Date.now()): TransitionCtx {
  return { now, newId: () => crypto.randomUUID() };
}

/** Read, reduce, write, then the side effects. */
async function apply(
  run: (state: TimerState, settings: Settings, ctx: TransitionCtx) => Transition,
): Promise<TimerState> {
  const [state, settings] = await Promise.all([readTimerState(), readSettings()]);
  const ctx = makeCtx();
  const result = run(state, settings, ctx);

  await writeTimerState(result.state);
  await persistData(result, ctx.now);
  await scheduleAlarms(result.state, settings, ctx.now);
  await updateBadge(result.state, settings.appearance.showBadge, ctx.now);
  await runNotifications(result, settings);

  return result.state;
}

/** Session and break records, today's cache, anything waiting for the popup. */
async function persistData(result: Transition, now: number): Promise<void> {
  let touchedDb = false;

  if (result.closed) {
    await addSession(result.closed, 'timer');
    touchedDb = true;

    // The popup is probably shut, so the rating question waits until it opens.
    await setPendingReview({
      sessionId: result.closed.id,
      at: result.closed.end,
      durationMs: result.closed.durationMs,
      mode: result.closed.mode,
    });
  }

  for (const effect of result.effects) {
    if (effect.kind === 'suggestBreak') {
      await setBreakSuggestion({ ms: effect.ms, at: effect.at });
    }

    if (effect.kind === 'breakClosed') {
      await addBreakEvent({
        id: crypto.randomUUID(),
        type: 'pomodoro',
        at: effect.at,
        action: effect.action,
        durationMs: effect.durationMs,
      });
      touchedDb = true;
    }
  }

  if (touchedDb) await refreshTodaySummary(now);
}

/**
 * A failed notification must never take the timer with it. By this point the
 * state and the session row are already written, so anything thrown in here is
 * logged and dropped.
 */
async function runNotifications(result: Transition, settings: Settings): Promise<void> {
  try {
    for (const effect of result.effects) {
      switch (effect.kind) {
        case 'phaseEnded': {
          // No sound for a skipped phase; the user is right there looking at it.
          if (!effect.completed) break;
          if (effect.phase === 'focus') {
            await notifyFocusDone(result.closed?.durationMs ?? 0, effect.nextPhase);
            await playFocusEndSound(settings);
          } else if (effect.phase === 'shortBreak' || effect.phase === 'longBreak') {
            await notifyBreakDone();
            await playBreakEndSound(settings);
          }
          break;
        }
        case 'phaseStarted':
          // A Pomodoro break is a good moment for whatever was held back.
          await onPhaseStarted(effect.phase, nextDeadlineAt(result.state));
          break;
        case 'staleCompletion':
          await notifyStaleCompletion(effect.at);
          break;
        default:
          break;
      }
    }
  } catch (error) {
    console.error('[breather] the notification step failed', error);
  }
}

/** Arms, or clears, each of the three timer alarms to match the state. */
async function scheduleAlarms(state: TimerState, settings: Settings, now: number): Promise<void> {
  const deadline = nextDeadlineAt(state);

  if (deadline != null) {
    await armAt(ALARM.timerEnd, deadline);
  } else {
    await clearAlarms(ALARM.timerEnd);
  }

  const needsBadgeTick = state.status === 'running' && settings.appearance.showBadge;
  if (needsBadgeTick) {
    await armEveryMinute(ALARM.badgeTick);
  } else {
    await clearAlarms(ALARM.badgeTick);
  }

  const reminderAt = nextReminderAt(state, reminderIntervalMs(settings), now);
  if (reminderAt != null) {
    await armAt(ALARM.stopwatchRemind, reminderAt);
  } else {
    await clearAlarms(ALARM.stopwatchRemind);
  }
}

function reminderIntervalMs(settings: Settings): number | null {
  const minutes = settings.timer.stopwatchRemindEveryMin;
  return minutes == null ? null : minutesToMs(minutes);
}

export async function dispatchTimer(event: TimerEvent): Promise<TimerState> {
  const next = await apply((state, settings, ctx) => {
    // Reconcile first: the phase may have run out while nobody was looking.
    const settled = reconcile(state, settings.timer, ctx);
    const result = transition(settled.state, event, settings.timer, ctx);

    return {
      state: result.state,
      closed: result.closed ?? settled.closed,
      effects: [...settled.effects, ...result.effects],
    };
  });

  // Starting something new makes a pending break suggestion meaningless.
  if (event.type === 'START') await clearBreakSuggestion();

  // Remembered so the popup opens on the last tag and mode used.
  if (event.type === 'SET_TAG') await updateSettings({ lastTagId: next.tagId });
  if (event.type === 'SET_MODE') await updateSettings({ lastMode: next.mode });

  return next;
}

/** The stars and note the popup collects after a focus session. */
export async function applySessionReview(input: {
  sessionId: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  note?: string;
}): Promise<void> {
  const { sessionId, ...review } = input;
  await reviewSession(sessionId, review);
  await clearPendingReview();
}

export async function dismissBreakSuggestion(): Promise<void> {
  await clearBreakSuggestion();
}

/** Nudge, then arm the next one. */
export async function handleStopwatchReminder(): Promise<void> {
  const [state, settings] = await Promise.all([readTimerState(), readSettings()]);
  const now = Date.now();

  if (state.status !== 'running') {
    await clearAlarms(ALARM.stopwatchRemind);
    return;
  }

  await notifyReminder(elapsedMs(state, now));
  await scheduleAlarms(state, settings, now);
}

/** The preview button in settings. */
export async function playSoundPreview(): Promise<void> {
  await previewSound(await readSettings());
}

/** Answering the "add the time you were away?" question. */
export async function resolveIdlePrompt(add: boolean): Promise<void> {
  if (add) {
    const prompt = await readIdlePrompt(Date.now());
    if (prompt) await dispatchTimer({ type: 'ADD_PAUSED_TIME', ms: prompt.ms });
  }
  await clearIdlePrompt();
}

/** Called on worker wake, browser start, and every popup open. */
export async function syncTimer(): Promise<TimerState> {
  return apply((state, settings, ctx) => reconcile(state, settings.timer, ctx));
}

/** Reconciliation already closes the phase at the right moment. */
export async function handleTimerEndAlarm(): Promise<void> {
  await syncTimer();
}

export async function handleBadgeTick(): Promise<void> {
  const [state, settings] = await Promise.all([readTimerState(), readSettings()]);
  await updateBadge(state, settings.appearance.showBadge, Date.now());
}

/** Recomputes the cache the popup reads instead of touching IndexedDB. */
export async function refreshTodaySummary(now = Date.now()): Promise<TodaySummary> {
  const key = dayKey(now);
  const [totals, previous] = await Promise.all([totalsForDay(key), readTodaySummary(now)]);

  const summary: TodaySummary = {
    dayKey: key,
    focusMs: totals.focusMs,
    pomodoroCount: totals.pomodoroCount,
    sessionCount: totals.sessionCount,
    waterGlasses: previous.waterGlasses,
    updatedAt: now,
  };

  await writeTodaySummary(summary);
  return summary;
}

/** Install and update: tidy up the state and get the alarms back in place. */
export async function bootstrapTimer(): Promise<void> {
  const [state, settings] = await Promise.all([readTimerState(), readSettings()]);
  const ctx = makeCtx();
  const settled = reconcile(state, settings.timer, ctx);

  if (settled.state !== state) {
    await writeTimerState(settled.state);
    await persistData(settled, ctx.now);
    await runNotifications(settled, settings);
  }

  await scheduleAlarms(settled.state, settings, ctx.now);
  await updateBadge(settled.state, settings.appearance.showBadge, ctx.now);
  await refreshTodaySummary(ctx.now);
  // Close an offscreen document left behind by a previous worker.
  await cleanupAudio();
}

/** An escape hatch for development, and for a state that got wedged. */
export async function hardResetTimer(): Promise<void> {
  await writeTimerState(initialState());
  await clearAlarms(ALARM.timerEnd, ALARM.badgeTick, ALARM.stopwatchRemind);
  await updateBadge(initialState(), false, Date.now());
}

export { elapsedMs };
