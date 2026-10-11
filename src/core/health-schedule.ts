import { MINUTE_MS, dayKey } from './time';
import type { HealthKind } from './types';

/**
 * Scheduling for the health breaks.
 *
 * Each kind carries its own `nextDueAt`. As with the timer there is no counter
 * anywhere, only the next due time, and the worker sets a single alarm for
 * whichever comes first.
 *
 * Breaks that fall due mid-focus are marked `deferred` instead of interrupting,
 * and get offered during the next Pomodoro break.
 */

export const HEALTH_KINDS: readonly HealthKind[] = ['eye', 'breath', 'posture', 'water'];

export interface HealthEntry {
  /** When this break is next due. */
  nextDueAt: number;
  /** Fell due during focus, waiting for the Pomodoro break. */
  deferred: boolean;
  /** Snoozes used today, for the strict-mode daily limit. */
  snoozedToday: number;
}

export type HealthState = Record<HealthKind, HealthEntry>;

/** The slice of settings this module needs. */
export interface HealthBreakConfig {
  enabled: boolean;
  everyMin: number;
  durationSec: number;
}

export interface HealthSettings {
  eye: HealthBreakConfig;
  breath: HealthBreakConfig;
  posture: HealthBreakConfig;
  water: HealthBreakConfig;
  dontInterruptFocus: boolean;
  snoozeMin: number;
  dailySnoozeLimit: number;
}

export interface HealthMeta {
  /** Which day the snooze counters belong to. */
  dayKey: string;
}

export interface HealthStore extends HealthMeta {
  entries: HealthState;
}

function entry(nextDueAt: number): HealthEntry {
  return { nextDueAt, deferred: false, snoozedToday: 0 };
}

export function initialHealthStore(settings: HealthSettings, now: number): HealthStore {
  return {
    dayKey: dayKey(now),
    entries: {
      eye: entry(now + settings.eye.everyMin * MINUTE_MS),
      breath: entry(now + settings.breath.everyMin * MINUTE_MS),
      posture: entry(now + settings.posture.everyMin * MINUTE_MS),
      water: entry(now + settings.water.everyMin * MINUTE_MS),
    },
  };
}

/** Snooze allowances reset when the day turns over. */
export function rollDay(store: HealthStore, now: number): HealthStore {
  const today = dayKey(now);
  if (store.dayKey === today) return store;

  const entries = { ...store.entries };
  for (const kind of HEALTH_KINDS) {
    entries[kind] = { ...entries[kind], snoozedToday: 0 };
  }
  return { dayKey: today, entries };
}

/** Breaks that are enabled and due. */
export function dueBreaks(store: HealthStore, settings: HealthSettings, now: number): HealthKind[] {
  return HEALTH_KINDS.filter(
    (kind) => settings[kind].enabled && store.entries[kind].nextDueAt <= now,
  );
}

export function deferredBreaks(store: HealthStore, settings: HealthSettings): HealthKind[] {
  return HEALTH_KINDS.filter((kind) => settings[kind].enabled && store.entries[kind].deferred);
}

/** Earliest due time across the enabled breaks. This is what the alarm uses. */
export function nextHealthTickAt(store: HealthStore, settings: HealthSettings): number | undefined {
  const times = HEALTH_KINDS.filter((kind) => settings[kind].enabled).map(
    (kind) => store.entries[kind].nextDueAt,
  );
  return times.length === 0 ? undefined : Math.min(...times);
}

function patch(store: HealthStore, kind: HealthKind, changes: Partial<HealthEntry>): HealthStore {
  return {
    ...store,
    entries: { ...store.entries, [kind]: { ...store.entries[kind], ...changes } },
  };
}

/** Taken or skipped, either way the clock starts again. */
export function rescheduleBreak(
  store: HealthStore,
  kind: HealthKind,
  settings: HealthSettings,
  now: number,
): HealthStore {
  return patch(store, kind, {
    nextDueAt: now + settings[kind].everyMin * MINUTE_MS,
    deferred: false,
  });
}

export function rescheduleMany(
  store: HealthStore,
  kinds: readonly HealthKind[],
  settings: HealthSettings,
  now: number,
): HealthStore {
  return kinds.reduce((acc, kind) => rescheduleBreak(acc, kind, settings, now), store);
}

export function canSnooze(store: HealthStore, kind: HealthKind, settings: HealthSettings): boolean {
  if (settings.dailySnoozeLimit <= 0) return true;
  return store.entries[kind].snoozedToday < settings.dailySnoozeLimit;
}

/**
 * Snooze. Once the daily allowance runs out this quietly falls back to a full
 * interval, which is less annoying than refusing the button outright.
 */
export function snoozeBreak(
  store: HealthStore,
  kind: HealthKind,
  settings: HealthSettings,
  now: number,
): HealthStore {
  if (!canSnooze(store, kind, settings)) {
    return rescheduleBreak(store, kind, settings, now);
  }

  return patch(store, kind, {
    nextDueAt: now + settings.snoozeMin * MINUTE_MS,
    deferred: false,
    snoozedToday: store.entries[kind].snoozedToday + 1,
  });
}

/**
 * Hold a break back without losing it. The due time moves on by a full interval
 * so a long focus session doesn't retrigger this every minute.
 */
export function deferBreak(
  store: HealthStore,
  kind: HealthKind,
  settings: HealthSettings,
  now: number,
): HealthStore {
  return patch(store, kind, {
    nextDueAt: now + settings[kind].everyMin * MINUTE_MS,
    deferred: true,
  });
}

/** Time away from the machine counts as a break, so everything resets. */
export function resetAllBreaks(
  store: HealthStore,
  settings: HealthSettings,
  now: number,
): HealthStore {
  return rescheduleMany(store, HEALTH_KINDS, settings, now);
}

/** Re-arm whatever the user just switched on or re-timed; leave the rest. */
export function applySettingsChange(
  store: HealthStore,
  previous: HealthSettings,
  next: HealthSettings,
  now: number,
): HealthStore {
  let result = store;

  for (const kind of HEALTH_KINDS) {
    const wasEnabled = previous[kind].enabled;
    const isEnabled = next[kind].enabled;
    const intervalChanged = previous[kind].everyMin !== next[kind].everyMin;

    if ((!wasEnabled && isEnabled) || (isEnabled && intervalChanged)) {
      result = rescheduleBreak(result, kind, next, now);
    }
  }

  return result;
}
