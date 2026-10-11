import { MINUTE_MS } from '@/core/time';
import {
  applySettingsChange,
  deferBreak,
  deferredBreaks,
  dueBreaks,
  nextHealthTickAt,
  rescheduleMany,
  resetAllBreaks,
  rollDay,
  snoozeBreak,
} from '@/core/health-schedule';
import type { HealthSettings, HealthStore } from '@/core/health-schedule';
import { pickStretch } from '@/core/stretches';
import { isBreakPhase } from '@/core/types';
import type { BreakAction, BreakKind, HealthKind } from '@/core/types';
import { addBreakEvent } from '@/db/sessions';
import { storage } from 'wxt/utils/storage';
import { readSettings } from '@/storage/settings';
import type { Settings } from '@/storage/schema';
import {
  clearActiveBreak,
  readActiveBreak,
  readHealthStore,
  readLastStretch,
  writeActiveBreak,
  writeHealthStore,
  writeLastStretch,
} from '@/storage/health-state';
import { readTimerState } from '@/storage/timer-state';
import { readTodaySummary, writeTodaySummary } from '@/storage/today-cache';
import { ALARM, armAt, clearAlarms } from './alarms';
import { closeBreakWindow, openBreakWindow } from './break-window';
import { canRemindNow } from './dnd';
import { notifyHealthBreak, notifyWater } from './notify';

/**
 * Drives the health breaks.
 *
 * One alarm is set for whichever break is due first. When it fires, state is
 * re-read from storage, the due ones are worked out, and they are either
 * announced or shown in a window depending on the chosen presentation.
 *
 * The important subtlety: if the reminder gates are shut, the break is *not*
 * consumed. Its due time stays where it is and we simply look again in a few
 * minutes, so the break arrives the moment the user is available rather than
 * being silently skipped.
 */

/** How often to look again while the gates are shut. */
const RECHECK_MS = 5 * MINUTE_MS;

/** Water never opens a window; that would be far too much for a glass of water. */
const NOTIFICATION_ONLY: readonly HealthKind[] = ['water'];

/**
 * Last seen settings, kept so we can tell which break the user just switched on
 * or re-timed and re-arm only that one.
 */
const SNAPSHOT_KEY = 'local:healthSettingsSnapshot' as const;

function healthSettings(settings: Settings): HealthSettings {
  return settings.breaks;
}

async function persist(store: HealthStore, settings: Settings): Promise<void> {
  await writeHealthStore(store);
  await armHealthAlarm(store, settings);
}

async function armHealthAlarm(store: HealthStore, settings: Settings): Promise<void> {
  const next = nextHealthTickAt(store, healthSettings(settings));
  if (next == null) {
    await clearAlarms(ALARM.healthTick);
    return;
  }
  // A due time in the past would spin the alarm, so never schedule sooner than a minute out.
  await armAt(ALARM.healthTick, Math.max(next, Date.now() + MINUTE_MS));
}

async function recordEvents(
  kinds: readonly BreakKind[],
  action: BreakAction,
  at: number,
  durationMs?: number,
): Promise<void> {
  for (const kind of kinds) {
    await addBreakEvent({
      id: crypto.randomUUID(),
      type: kind,
      at,
      action,
      ...(durationMs == null ? {} : { durationMs }),
    });
  }
}

/** Refreshes the alarm, re-arming whichever breaks the user just changed. */
export async function scheduleHealth(now = Date.now()): Promise<void> {
  const settings = await readSettings();
  const config = healthSettings(settings);

  let store = rollDay(await readHealthStore(config, now), now);

  const previous = await storage.getItem<HealthSettings>(SNAPSHOT_KEY);
  if (previous) store = applySettingsChange(store, previous, config, now);
  await storage.setItem(SNAPSHOT_KEY, config);

  await persist(store, settings);
}

export async function handleHealthTick(): Promise<void> {
  const now = Date.now();
  const settings = await readSettings();
  const config = healthSettings(settings);

  // A break window is already open; keep the chain alive but offer nothing new.
  if (await readActiveBreak()) {
    await armAt(ALARM.healthTick, now + RECHECK_MS);
    return;
  }

  let store = rollDay(await readHealthStore(config, now), now);
  const due = dueBreaks(store, config, now);

  if (due.length === 0) {
    await persist(store, settings);
    return;
  }

  // Gates shut. Leave the due time alone and look again shortly.
  if (!(await canRemindNow(settings, now))) {
    await writeHealthStore(store);
    await armAt(ALARM.healthTick, now + RECHECK_MS);
    return;
  }

  // Mid-focus: hold it back for the Pomodoro break instead of interrupting.
  const timer = await readTimerState();
  const inFocus = timer.status === 'running' && timer.phase === 'focus';

  if (inFocus && config.dontInterruptFocus) {
    for (const kind of due) store = deferBreak(store, kind, config, now);
    await persist(store, settings);
    return;
  }

  await present(due, store, settings, now);
}

/** Called when a Pomodoro break starts, to offer whatever was held back. */
export async function offerDeferredBreaks(phaseEndsAt: number | undefined): Promise<void> {
  const now = Date.now();
  const settings = await readSettings();
  const config = healthSettings(settings);
  const store = rollDay(await readHealthStore(config, now), now);

  const pending = deferredBreaks(store, config);
  if (pending.length === 0) return;
  if (!(await canRemindNow(settings, now))) return;

  await present(pending, store, settings, now, phaseEndsAt);
}

async function present(
  kinds: HealthKind[],
  store: HealthStore,
  settings: Settings,
  now: number,
  hostPhaseEndsAt?: number,
): Promise<void> {
  const config = healthSettings(settings);
  await recordEvents(kinds, 'offered', now);

  const windowKinds = kinds.filter((kind) => !NOTIFICATION_ONLY.includes(kind));
  const notificationKinds = kinds.filter((kind) => NOTIFICATION_ONLY.includes(kind));

  let next = store;

  // Water is announced and immediately rescheduled; the counter lives in the popup.
  if (notificationKinds.length > 0) {
    await notifyWater();
    next = rescheduleMany(next, notificationKinds, config, now);
  }

  if (windowKinds.length === 0 || settings.breaks.presentation === 'notification') {
    if (windowKinds.length > 0) {
      await notifyHealthBreak(windowKinds);
      // In notification mode we can't know whether it was taken, so assume it was.
      next = rescheduleMany(next, windowKinds, config, now);
    }
    await persist(next, settings);
    return;
  }

  const stretch = windowKinds.includes('posture')
    ? pickStretch(await readLastStretch(), Math.random())
    : undefined;
  if (stretch) await writeLastStretch(stretch);

  await writeActiveBreak({
    id: crypto.randomUUID(),
    kinds: windowKinds,
    startedAt: now,
    ...(hostPhaseEndsAt == null ? {} : { hostPhaseEndsAt }),
    ...(stretch == null ? {} : { stretch }),
  });

  // Keep the chain running even with the window open, so a window that fails
  // to appear doesn't strand the whole thing.
  await persist(next, settings);
  await openBreakWindow(settings.breaks.presentation === 'fullscreen');
}

export type BreakOutcome = 'taken' | 'skipped' | 'snoozed';

export async function resolveBreak(outcome: BreakOutcome): Promise<void> {
  const now = Date.now();
  const active = await readActiveBreak();
  if (!active) return;

  const settings = await readSettings();
  const config = healthSettings(settings);
  let store = rollDay(await readHealthStore(config, now), now);

  if (outcome === 'snoozed') {
    for (const kind of active.kinds) store = snoozeBreak(store, kind, config, now);
  } else {
    store = rescheduleMany(store, active.kinds, config, now);
  }

  await recordEvents(
    active.kinds,
    outcome,
    now,
    outcome === 'taken' ? now - active.startedAt : undefined,
  );

  await clearActiveBreak();
  await persist(store, settings);
  await closeBreakWindow();
}

/** Closing the window by hand counts as skipping, otherwise it reopens at once. */
export async function handleBreakWindowClosed(): Promise<void> {
  const active = await readActiveBreak();
  if (!active) return;
  await resolveBreak('skipped');
}

/** Time away from the machine counts as having taken the breaks. */
export async function markAwayAsBreak(awayMs: number, now = Date.now()): Promise<void> {
  const settings = await readSettings();
  const config = healthSettings(settings);
  const store = rollDay(await readHealthStore(config, now), now);

  const enabled = (['eye', 'breath', 'posture', 'water'] as HealthKind[]).filter(
    (kind) => config[kind].enabled,
  );
  await recordEvents(enabled, 'auto', now, awayMs);

  await persist(resetAllBreaks(store, config, now), settings);
}

/** The water counter. Also written to the database so it shows up in stats. */
export async function addWaterGlass(): Promise<number> {
  const now = Date.now();
  const summary = await readTodaySummary(now);
  const next = { ...summary, waterGlasses: summary.waterGlasses + 1, updatedAt: now };

  await writeTodaySummary(next);
  await recordEvents(['water'], 'taken', now);
  return next.waterGlasses;
}

export async function onPhaseStarted(
  phase: string,
  phaseEndsAt: number | undefined,
): Promise<void> {
  if (!isBreakPhase(phase as never)) return;
  await offerDeferredBreaks(phaseEndsAt);
}
