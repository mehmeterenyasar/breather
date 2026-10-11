import { describe, expect, it } from 'vitest';
import {
  applySettingsChange,
  canSnooze,
  deferBreak,
  deferredBreaks,
  dueBreaks,
  initialHealthStore,
  nextHealthTickAt,
  rescheduleBreak,
  resetAllBreaks,
  rollDay,
  snoozeBreak,
} from '@/core/health-schedule';
import type { HealthSettings, HealthStore } from '@/core/health-schedule';
import { MINUTE_MS } from '@/core/time';
import { DEFAULT_SETTINGS } from '@/storage/schema';

const S: HealthSettings = DEFAULT_SETTINGS.breaks;
const T0 = new Date(2026, 2, 2, 9, 0, 0, 0).getTime();

const store = (now = T0): HealthStore => initialHealthStore(S, now);

describe('arming the break counters', () => {
  it('arms each break with its own interval', () => {
    const s = store();

    expect(s.entries.eye.nextDueAt).toBe(T0 + 20 * MINUTE_MS);
    expect(s.entries.breath.nextDueAt).toBe(T0 + 60 * MINUTE_MS);
    expect(s.entries.posture.nextDueAt).toBe(T0 + 45 * MINUTE_MS);
    expect(s.entries.water.nextDueAt).toBe(T0 + 90 * MINUTE_MS);
  });

  it('sets the alarm for whichever is due first', () => {
    expect(nextHealthTickAt(store(), S)).toBe(T0 + 20 * MINUTE_MS);
  });

  it('ignores breaks that are switched off', () => {
    const onlyWater: HealthSettings = {
      ...S,
      eye: { ...S.eye, enabled: false },
      breath: { ...S.breath, enabled: false },
      posture: { ...S.posture, enabled: false },
    };

    expect(nextHealthTickAt(store(), onlyWater)).toBe(T0 + 90 * MINUTE_MS);
  });

  it('sets no alarm when they are all off', () => {
    const allOff: HealthSettings = {
      ...S,
      eye: { ...S.eye, enabled: false },
      breath: { ...S.breath, enabled: false },
      posture: { ...S.posture, enabled: false },
      water: { ...S.water, enabled: false },
    };

    expect(nextHealthTickAt(store(), allOff)).toBeUndefined();
  });
});

describe('which breaks are due', () => {
  it('returns only the ones switched on and actually due', () => {
    const s = store();

    expect(dueBreaks(s, S, T0 + 10 * MINUTE_MS)).toEqual([]);
    expect(dueBreaks(s, S, T0 + 20 * MINUTE_MS)).toEqual(['eye']);
    expect(dueBreaks(s, S, T0 + 46 * MINUTE_MS)).toEqual(['eye', 'posture']);
  });

  it('never offers a break that is switched off', () => {
    const noEye: HealthSettings = { ...S, eye: { ...S.eye, enabled: false } };
    expect(dueBreaks(store(), noEye, T0 + 25 * MINUTE_MS)).toEqual([]);
  });

  it('re-arms the counter once the break is taken', () => {
    const after = rescheduleBreak(store(), 'eye', S, T0 + 21 * MINUTE_MS);
    expect(after.entries.eye.nextDueAt).toBe(T0 + 41 * MINUTE_MS);
  });
});

describe('deferring during focus, then merging into the Pomodoro break', () => {
  it('marks a deferred break and pushes it one interval out', () => {
    const deferred = deferBreak(store(), 'eye', S, T0 + 20 * MINUTE_MS);

    expect(deferred.entries.eye.deferred).toBe(true);
    expect(deferred.entries.eye.nextDueAt).toBe(T0 + 40 * MINUTE_MS);
    // So it doesn't fire again immediately.
    expect(dueBreaks(deferred, S, T0 + 25 * MINUTE_MS)).toEqual([]);
  });

  it('lists the deferred breaks for the Pomodoro break', () => {
    let s = deferBreak(store(), 'eye', S, T0 + 20 * MINUTE_MS);
    s = deferBreak(s, 'posture', S, T0 + 45 * MINUTE_MS);

    expect(deferredBreaks(s, S)).toEqual(['eye', 'posture']);
  });

  it('clears the deferred flag once the break is taken', () => {
    const deferred = deferBreak(store(), 'eye', S, T0 + 20 * MINUTE_MS);
    const taken = rescheduleBreak(deferred, 'eye', S, T0 + 30 * MINUTE_MS);

    expect(taken.entries.eye.deferred).toBe(false);
    expect(deferredBreaks(taken, S)).toEqual([]);
  });
});

describe('snoozing, and the daily limit', () => {
  it('pushes the counter out by the configured snooze', () => {
    const snoozed = snoozeBreak(store(), 'eye', S, T0 + 20 * MINUTE_MS);

    expect(snoozed.entries.eye.nextDueAt).toBe(T0 + 25 * MINUTE_MS);
    expect(snoozed.entries.eye.snoozedToday).toBe(1);
  });

  it('falls back to a full interval once the daily limit is reached', () => {
    let s = store();
    for (let i = 0; i < S.dailySnoozeLimit; i++) {
      s = snoozeBreak(s, 'eye', S, T0 + 20 * MINUTE_MS);
    }

    expect(canSnooze(s, 'eye', S)).toBe(false);

    const extra = snoozeBreak(s, 'eye', S, T0 + 20 * MINUTE_MS);
    // A whole interval, not the five minute snooze.
    expect(extra.entries.eye.nextDueAt).toBe(T0 + 40 * MINUTE_MS);
    expect(extra.entries.eye.snoozedToday).toBe(S.dailySnoozeLimit);
  });

  it('allows unlimited snoozing when the limit is zero', () => {
    const unlimited: HealthSettings = { ...S, dailySnoozeLimit: 0 };
    expect(canSnooze(store(), 'eye', unlimited)).toBe(true);
  });

  it('gives the snoozes back when the day changes', () => {
    const snoozed = snoozeBreak(store(), 'eye', S, T0 + 20 * MINUTE_MS);
    const nextDay = rollDay(snoozed, T0 + 26 * 60 * MINUTE_MS);

    expect(nextDay.entries.eye.snoozedToday).toBe(0);
    // The due times stay put; only the snooze count resets.
    expect(nextDay.entries.eye.nextDueAt).toBe(snoozed.entries.eye.nextDueAt);
  });

  it('changes nothing when rolled within the same day', () => {
    const s = snoozeBreak(store(), 'eye', S, T0 + 20 * MINUTE_MS);
    expect(rollDay(s, T0 + 2 * 60 * MINUTE_MS)).toBe(s);
  });
});

describe('time away from the machine', () => {
  it('resets every counter', () => {
    const away = T0 + 30 * MINUTE_MS;
    const reset = resetAllBreaks(store(), S, away);

    expect(reset.entries.eye.nextDueAt).toBe(away + 20 * MINUTE_MS);
    expect(reset.entries.water.nextDueAt).toBe(away + 90 * MINUTE_MS);
    expect(dueBreaks(reset, S, away)).toEqual([]);
  });
});

describe('changing the settings', () => {
  it('arms a break that was just switched on', () => {
    const off: HealthSettings = { ...S, eye: { ...S.eye, enabled: false } };
    const changed = applySettingsChange(store(), off, S, T0 + 5 * MINUTE_MS);

    expect(changed.entries.eye.nextDueAt).toBe(T0 + 25 * MINUTE_MS);
  });

  it('re-arms with the new interval when it changes', () => {
    const faster: HealthSettings = { ...S, eye: { ...S.eye, everyMin: 10 } };
    const changed = applySettingsChange(store(), S, faster, T0 + 5 * MINUTE_MS);

    expect(changed.entries.eye.nextDueAt).toBe(T0 + 15 * MINUTE_MS);
  });

  it('leaves the breaks that did not change alone', () => {
    const changed = applySettingsChange(store(), S, S, T0 + 5 * MINUTE_MS);
    expect(changed.entries.water.nextDueAt).toBe(T0 + 90 * MINUTE_MS);
  });
});
