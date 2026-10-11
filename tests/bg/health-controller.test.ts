import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ALARM } from '@/bg/alarms';
import {
  handleHealthTick,
  markAwayAsBreak,
  resolveBreak,
  scheduleHealth,
} from '@/bg/health-controller';
import { dispatchTimer } from '@/bg/timer-controller';
import { MINUTE_MS } from '@/core/time';
import { db } from '@/db';
import { readActiveBreak, readHealthStore } from '@/storage/health-state';
import { readSettings, updateSettings } from '@/storage/settings';

/**
 * The worker side of the health breaks: arming the alarm, the reminder gates,
 * deferring during focus, and the break window opening and closing.
 */

/** Monday 2 March 2026 at 10:00, inside the default working hours. */
const T0 = new Date(2026, 2, 2, 10, 0, 0, 0).getTime();

async function alarmFor(name: string) {
  const all = await fakeBrowser.alarms.getAll();
  return all.find((alarm) => alarm.name === name);
}

/** The fake browser starts with a window of its own, so count only our popups. */
async function breakWindows() {
  const all = await fakeBrowser.windows.getAll();
  return all.filter((window) => window.type === 'popup');
}

/** By time, not by primary key. */
async function breakEvents() {
  return db.breakEvents.orderBy('at').toArray();
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  fakeBrowser.reset();
  fakeBrowser.i18n.getMessage = ((key: string) => key) as typeof fakeBrowser.i18n.getMessage;
  await Promise.all(db.tables.map((table) => table.clear()));
  // Only the eye break, so each scenario is about one break.
  await updateSettings({
    breaks: {
      eye: { enabled: true, everyMin: 20, durationSec: 20 },
      breath: { enabled: false },
      posture: { enabled: false },
      water: { enabled: false },
    },
  });
  await scheduleHealth(T0);
});

afterAll(() => {
  vi.useRealTimers();
});

describe('the break alarm', () => {
  it('is armed for whichever break is due first', async () => {
    expect((await alarmFor(ALARM.healthTick))?.scheduledTime).toBe(T0 + 20 * MINUTE_MS);
  });

  it('offers nothing when it fires early', async () => {
    vi.setSystemTime(T0 + 10 * MINUTE_MS);
    await handleHealthTick();

    expect(await readActiveBreak()).toBeNull();
    expect(await breakWindows()).toHaveLength(0);
  });
});

describe('offering a break', () => {
  it('opens the break window when one is due', async () => {
    vi.setSystemTime(T0 + 20 * MINUTE_MS);
    await handleHealthTick();

    const active = await readActiveBreak();
    expect(active?.kinds).toEqual(['eye']);
    expect(await breakWindows()).toHaveLength(1);

    // And records that it was offered.
    const events = await breakEvents();
    expect(events).toEqual([expect.objectContaining({ type: 'eye', action: 'offered' })]);
  });

  it('does not consume the break while muted, and looks again shortly', async () => {
    await updateSettings({ dnd: { muteUntil: T0 + 60 * MINUTE_MS } });

    vi.setSystemTime(T0 + 20 * MINUTE_MS);
    await handleHealthTick();

    expect(await readActiveBreak()).toBeNull();
    expect(await breakWindows()).toHaveLength(0);

    // The due time has not moved, so the break arrives once they are free.
    const store = await readHealthStore((await readSettings()).breaks, Date.now());
    expect(store.entries.eye.nextDueAt).toBe(T0 + 20 * MINUTE_MS);
    expect((await alarmFor(ALARM.healthTick))?.scheduledTime).toBe(T0 + 25 * MINUTE_MS);
  });

  it('offers nothing outside working hours', async () => {
    await updateSettings({ dnd: { workHours: { enabled: true } } });

    // Monday 20:00, outside the default 09:00-18:00.
    vi.setSystemTime(new Date(2026, 2, 2, 20, 0, 0, 0).getTime());
    await handleHealthTick();

    expect(await readActiveBreak()).toBeNull();
  });

  it('opens no window in notification mode, and re-arms the counter', async () => {
    await updateSettings({ breaks: { presentation: 'notification' } });

    const now = T0 + 20 * MINUTE_MS;
    vi.setSystemTime(now);
    await handleHealthTick();

    expect(await breakWindows()).toHaveLength(0);
    const store = await readHealthStore((await readSettings()).breaks, now);
    expect(store.entries.eye.nextDueAt).toBe(now + 20 * MINUTE_MS);
  });
});

describe('staying out of the way during focus', () => {
  it('holds the break back while a Pomodoro focus is running', async () => {
    await dispatchTimer({ type: 'START' });

    vi.setSystemTime(T0 + 20 * MINUTE_MS);
    await handleHealthTick();

    expect(await readActiveBreak()).toBeNull();
    const store = await readHealthStore((await readSettings()).breaks, Date.now());
    expect(store.entries.eye.deferred).toBe(true);
  });

  it('offers the held-back break once the Pomodoro break starts', async () => {
    await updateSettings({ timer: { autoStartBreak: true } });
    await dispatchTimer({ type: 'START' });

    vi.setSystemTime(T0 + 20 * MINUTE_MS);
    await handleHealthTick();
    expect(await readActiveBreak()).toBeNull();

    // Focus over, Pomodoro break under way.
    vi.setSystemTime(T0 + 25 * MINUTE_MS);
    await dispatchTimer({ type: 'COMPLETE', at: T0 + 25 * MINUTE_MS });

    expect((await readActiveBreak())?.kinds).toEqual(['eye']);
  });

  it('interrupts the focus anyway when the setting is off', async () => {
    await updateSettings({ breaks: { dontInterruptFocus: false } });
    await dispatchTimer({ type: 'START' });

    vi.setSystemTime(T0 + 20 * MINUTE_MS);
    await handleHealthTick();

    expect((await readActiveBreak())?.kinds).toEqual(['eye']);
  });
});

describe('what happened to the break', () => {
  beforeEach(async () => {
    vi.setSystemTime(T0 + 20 * MINUTE_MS);
    await handleHealthTick();
  });

  it('records a taken break, closes the window and re-arms', async () => {
    const now = T0 + 21 * MINUTE_MS;
    vi.setSystemTime(now);
    await resolveBreak('taken');

    expect(await readActiveBreak()).toBeNull();
    expect(await breakWindows()).toHaveLength(0);

    const events = await breakEvents();
    expect(events.map((e) => e.action)).toEqual(['offered', 'taken']);
    expect(events[1]?.durationMs).toBe(MINUTE_MS);

    const store = await readHealthStore((await readSettings()).breaks, now);
    expect(store.entries.eye.nextDueAt).toBe(now + 20 * MINUTE_MS);
  });

  it('pushes a snoozed break five minutes out', async () => {
    const now = T0 + 21 * MINUTE_MS;
    vi.setSystemTime(now);
    await resolveBreak('snoozed');

    const store = await readHealthStore((await readSettings()).breaks, now);
    expect(store.entries.eye.nextDueAt).toBe(now + 5 * MINUTE_MS);
    expect(store.entries.eye.snoozedToday).toBe(1);
  });

  it('records a skipped break and still re-arms the counter', async () => {
    const now = T0 + 21 * MINUTE_MS;
    vi.setSystemTime(now);
    await resolveBreak('skipped');

    const events = await breakEvents();
    expect(events.map((e) => e.action)).toEqual(['offered', 'skipped']);

    const store = await readHealthStore((await readSettings()).breaks, now);
    expect(store.entries.eye.nextDueAt).toBe(now + 20 * MINUTE_MS);
  });
});

describe('time away from the machine', () => {
  it('counts as having taken the break', async () => {
    const now = T0 + 30 * MINUTE_MS;
    vi.setSystemTime(now);
    await markAwayAsBreak(10 * MINUTE_MS, now);

    const store = await readHealthStore((await readSettings()).breaks, now);
    expect(store.entries.eye.nextDueAt).toBe(now + 20 * MINUTE_MS);

    const events = await breakEvents();
    expect(events).toEqual([expect.objectContaining({ type: 'eye', action: 'auto' })]);
  });
});
