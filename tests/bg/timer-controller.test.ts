import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ALARM } from '@/bg/alarms';
import {
  applySessionReview,
  bootstrapTimer,
  dispatchTimer,
  handleStopwatchReminder,
  handleTimerEndAlarm,
  refreshTodaySummary,
} from '@/bg/timer-controller';
import { MINUTE_MS } from '@/core/time';
import { db } from '@/db';
import { readSettings, updateSettings } from '@/storage/settings';
import { readTimerState } from '@/storage/timer-state';
import { readTodaySummary } from '@/storage/today-cache';
import { readBreakSuggestion, readPendingReview } from '@/storage/ui-queue';

/**
 * The wiring between the pure core and the browser APIs.
 *
 * This is where the MV3 half of the acceptance criteria is checked: that the
 * alarm lands on the right moment, that a session is written with the end time
 * it really had, and that waking the worker brings the state back in line.
 */

const T0 = new Date(2026, 2, 2, 9, 0, 0, 0).getTime();

async function alarmFor(name: string): Promise<{ scheduledTime: number } | undefined> {
  const all = await fakeBrowser.alarms.getAll();
  return all.find((alarm) => alarm.name === name);
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  fakeBrowser.reset();
  // fakeBrowser has no i18n. Handing the key back is enough here; the strings
  // themselves are the locale suite's problem.
  fakeBrowser.i18n.getMessage = ((key: string) => key) as typeof fakeBrowser.i18n.getMessage;
  await Promise.all(db.tables.map((table) => table.clear()));
});

afterAll(() => {
  vi.useRealTimers();
});

describe('the timer controller', () => {
  it('writes the state and arms the alarm for the absolute end', async () => {
    await dispatchTimer({ type: 'START' });

    const state = await readTimerState();
    expect(state.status).toBe('running');
    expect(state.targetEndAt).toBe(T0 + 25 * MINUTE_MS);

    const alarm = await alarmFor(ALARM.timerEnd);
    expect(alarm?.scheduledTime).toBe(T0 + 25 * MINUTE_MS);

    // The badge shows whole minutes and gets its own per-minute alarm.
    expect(await fakeBrowser.action.getBadgeText({})).toBe('25');
    expect(await alarmFor(ALARM.badgeTick)).toBeDefined();
  });

  it('records the session, refreshes the cache and clears the badge', async () => {
    await dispatchTimer({ type: 'START' });

    vi.setSystemTime(T0 + 25 * MINUTE_MS);
    await handleTimerEndAlarm();

    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      start: T0,
      end: T0 + 25 * MINUTE_MS,
      durationMs: 25 * MINUTE_MS,
      completed: true,
      source: 'timer',
      dayKey: '2026-03-02',
    });

    const state = await readTimerState();
    expect(state.status).toBe('idle');
    expect(state.pomodoroIndex).toBe(1);

    const summary = await readTodaySummary(Date.now());
    expect(summary.focusMs).toBe(25 * MINUTE_MS);
    expect(summary.pomodoroCount).toBe(1);

    expect(await fakeBrowser.action.getBadgeText({})).toBe('');
    expect(await alarmFor(ALARM.timerEnd)).toBeUndefined();
  });

  it('closes a session at its real end after the browser was shut for 10 minutes', async () => {
    await dispatchTimer({ type: 'START' });

    // Closed, the phase ran out, and ten minutes later it was opened again.
    vi.setSystemTime(T0 + 35 * MINUTE_MS);
    await bootstrapTimer();

    const sessions = await db.sessions.toArray();
    expect(sessions[0]).toMatchObject({
      end: T0 + 25 * MINUTE_MS,
      durationMs: 25 * MINUTE_MS,
      completed: true,
    });

    // Too late to auto-start the break.
    const state = await readTimerState();
    expect(state.status).toBe('idle');
    expect(await alarmFor(ALARM.timerEnd)).toBeUndefined();
  });

  it('re-arms with the remaining time when the browser comes back early', async () => {
    await dispatchTimer({ type: 'START' });

    fakeBrowser.alarms.clearAll();
    vi.setSystemTime(T0 + 10 * MINUTE_MS);
    await bootstrapTimer();

    expect((await alarmFor(ALARM.timerEnd))?.scheduledTime).toBe(T0 + 25 * MINUTE_MS);
    expect((await readTimerState()).status).toBe('running');
    expect(await db.sessions.count()).toBe(0);
  });

  it('clears the alarm on pause and re-arms it further out on resume', async () => {
    await dispatchTimer({ type: 'START' });

    vi.setSystemTime(T0 + 10 * MINUTE_MS);
    await dispatchTimer({ type: 'PAUSE' });
    expect(await alarmFor(ALARM.timerEnd)).toBeUndefined();

    vi.setSystemTime(T0 + 15 * MINUTE_MS);
    await dispatchTimer({ type: 'RESUME' });
    expect((await alarmFor(ALARM.timerEnd))?.scheduledTime).toBe(T0 + 30 * MINUTE_MS);
  });

  it('starts the break by itself when auto-start is on', async () => {
    await updateSettings({ timer: { autoStartBreak: true } });
    await dispatchTimer({ type: 'START' });

    vi.setSystemTime(T0 + 25 * MINUTE_MS);
    await handleTimerEndAlarm();

    const state = await readTimerState();
    expect(state.status).toBe('running');
    expect(state.phase).toBe('shortBreak');
    expect((await alarmFor(ALARM.timerEnd))?.scheduledTime).toBe(T0 + 30 * MINUTE_MS);
  });

  it('writes a skipped break as a break event, not a session', async () => {
    await updateSettings({ timer: { autoStartBreak: true } });
    await dispatchTimer({ type: 'START' });

    vi.setSystemTime(T0 + 25 * MINUTE_MS);
    await handleTimerEndAlarm();

    vi.setSystemTime(T0 + 26 * MINUTE_MS);
    await dispatchTimer({ type: 'SKIP' });

    expect(await db.sessions.count()).toBe(1);
    const events = await db.breakEvents.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'pomodoro', action: 'skipped' });
  });

  it('writes no badge text when the badge is switched off', async () => {
    await updateSettings({ appearance: { showBadge: false } });
    await dispatchTimer({ type: 'START' });

    expect(await fakeBrowser.action.getBadgeText({})).toBe('');
    expect(await alarmFor(ALARM.badgeTick)).toBeUndefined();
    // The timer still runs; the badge is only a view of it.
    expect((await alarmFor(ALARM.timerEnd))?.scheduledTime).toBe(T0 + 25 * MINUTE_MS);
  });

  it("gives today's cache only its share of a session over midnight", async () => {
    const lateStart = new Date(2026, 2, 2, 23, 40, 0, 0).getTime();
    vi.setSystemTime(lateStart);
    await dispatchTimer({ type: 'START', plannedMs: 40 * MINUTE_MS });

    vi.setSystemTime(lateStart + 40 * MINUTE_MS);
    await handleTimerEndAlarm();

    // It is 3 March now, and only 20 minutes of that session belong to it.
    const summary = await refreshTodaySummary(Date.now());
    expect(summary.dayKey).toBe('2026-03-03');
    expect(summary.focusMs).toBe(20 * MINUTE_MS);
  });
});

describe('tags, reviews and suggestions', () => {
  it('leaves a review request behind when a session closes', async () => {
    await dispatchTimer({ type: 'START' });

    vi.setSystemTime(T0 + 25 * MINUTE_MS);
    await handleTimerEndAlarm();

    const review = await readPendingReview(Date.now());
    const sessions = await db.sessions.toArray();

    expect(review?.sessionId).toBe(sessions[0]?.id);
    expect(review?.durationMs).toBe(25 * MINUTE_MS);
  });

  it('writes the review to the session and clears the request', async () => {
    await dispatchTimer({ type: 'START' });
    vi.setSystemTime(T0 + 25 * MINUTE_MS);
    await handleTimerEndAlarm();

    const review = await readPendingReview(Date.now());
    await applySessionReview({ sessionId: review!.sessionId, rating: 4, note: '  derin odak  ' });

    const session = await db.sessions.get(review!.sessionId);
    expect(session?.rating).toBe(4);
    expect(session?.note).toBe('derin odak');
    expect(await readPendingReview(Date.now())).toBeNull();
  });

  it('lets a stale review request expire', async () => {
    await dispatchTimer({ type: 'START' });
    vi.setSystemTime(T0 + 25 * MINUTE_MS);
    await handleTimerEndAlarm();

    // Open the popup the next day and it should not ask about yesterday.
    vi.setSystemTime(T0 + 20 * 60 * MINUTE_MS);
    expect(await readPendingReview(Date.now())).toBeNull();
  });

  it('leaves a break suggestion when a Flowtime session ends', async () => {
    await dispatchTimer({ type: 'SET_MODE', mode: 'flowtime' });
    await dispatchTimer({ type: 'START' });

    vi.setSystemTime(T0 + 50 * MINUTE_MS);
    await dispatchTimer({ type: 'FINISH' });

    expect((await readBreakSuggestion(Date.now()))?.ms).toBe(10 * MINUTE_MS);
  });

  it('drops a pending suggestion once something new starts', async () => {
    await dispatchTimer({ type: 'SET_MODE', mode: 'flowtime' });
    await dispatchTimer({ type: 'START' });
    vi.setSystemTime(T0 + 50 * MINUTE_MS);
    await dispatchTimer({ type: 'FINISH' });

    await dispatchTimer({ type: 'START' });
    expect(await readBreakSuggestion(Date.now())).toBeNull();
  });

  it('writes the chosen tag to the session and remembers it', async () => {
    await updateSettings({ tags: [{ id: 'kod', name: 'Kod', color: '#4e8c7e' }] });

    await dispatchTimer({ type: 'SET_TAG', tagId: 'kod' });
    await dispatchTimer({ type: 'START' });
    vi.setSystemTime(T0 + 25 * MINUTE_MS);
    await handleTimerEndAlarm();

    expect((await readSettings()).lastTagId).toBe('kod');
    expect((await db.sessions.toArray())[0]?.tagId).toBe('kod');
  });

  it('records a mode change in the settings', async () => {
    await dispatchTimer({ type: 'SET_MODE', mode: 'countdown' });
    expect((await readSettings()).lastMode).toBe('countdown');
  });
});

describe('the stopwatch reminder alarm', () => {
  beforeEach(async () => {
    await updateSettings({ timer: { stopwatchRemindEveryMin: 50 } });
  });

  it('is armed while the stopwatch runs', async () => {
    await dispatchTimer({ type: 'SET_MODE', mode: 'stopwatch' });
    await dispatchTimer({ type: 'START' });

    expect((await alarmFor(ALARM.stopwatchRemind))?.scheduledTime).toBe(T0 + 50 * MINUTE_MS);
    // Counting up, so there is no end alarm.
    expect(await alarmFor(ALARM.timerEnd)).toBeUndefined();
  });

  it('arms the next one when it fires', async () => {
    await dispatchTimer({ type: 'SET_MODE', mode: 'stopwatch' });
    await dispatchTimer({ type: 'START' });

    vi.setSystemTime(T0 + 50 * MINUTE_MS);
    await handleStopwatchReminder();

    expect((await alarmFor(ALARM.stopwatchRemind))?.scheduledTime).toBe(T0 + 100 * MINUTE_MS);
  });

  it('is cleared when the timer stops', async () => {
    await dispatchTimer({ type: 'SET_MODE', mode: 'stopwatch' });
    await dispatchTimer({ type: 'START' });

    vi.setSystemTime(T0 + 10 * MINUTE_MS);
    await dispatchTimer({ type: 'FINISH' });

    expect(await alarmFor(ALARM.stopwatchRemind)).toBeUndefined();
  });

  it('is not armed in Pomodoro mode', async () => {
    await dispatchTimer({ type: 'START' });
    expect(await alarmFor(ALARM.stopwatchRemind)).toBeUndefined();
  });
});

describe('when the sound cannot be played', () => {
  it('records the session and moves the state on regardless', async () => {
    // The test environment has neither AudioContext nor the offscreen API.
    await updateSettings({ sound: { enabled: true, volume: 0.6 } });
    await dispatchTimer({ type: 'START' });

    vi.setSystemTime(T0 + 25 * MINUTE_MS);
    await expect(handleTimerEndAlarm()).resolves.toBeUndefined();

    expect(await db.sessions.count()).toBe(1);
    expect((await readTimerState()).status).toBe('idle');
  });
});
