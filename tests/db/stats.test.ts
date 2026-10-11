import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { HOUR_MS, MINUTE_MS } from '@/core/time';
import { summarize } from '@/core/stats';
import { db } from '@/db';
import { rebuildAllStats, statsForRange } from '@/db/daily-stats';
import { aggregatesForRange, dataCounts, sessionsForRange } from '@/db/queries';
import {
  addManualSession,
  addSession,
  deleteSession,
  totalsForDay,
  updateSession,
} from '@/db/sessions';
import { exportBackup, importBackup, wipeHistory } from '@/db/backup';
import { parseBackup } from '@/core/backup-format';
import type { ClosedSessionDraft } from '@/core/timer';

/**
 * Whether the daily rollup is actually correct, and whether the statistics
 * queries still behave with a realistic amount of data behind them.
 */

const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0).getTime();

const draft = (overrides: Partial<ClosedSessionDraft> = {}): ClosedSessionDraft => ({
  id: crypto.randomUUID(),
  mode: 'pomodoro',
  phase: 'focus',
  start: at(2026, 3, 2, 9),
  end: at(2026, 3, 2, 9, 25),
  durationMs: 25 * MINUTE_MS,
  pausedMs: 0,
  completed: true,
  ...overrides,
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at(2026, 3, 2, 12));
  fakeBrowser.reset();
  await Promise.all(db.tables.map((table) => table.clear()));
});

afterAll(() => {
  vi.useRealTimers();
});

describe('the daily rollup', () => {
  it('gains a row for the day when a session is added', async () => {
    await addSession(draft({ tagId: 'kod' }));

    const rows = await statsForRange('2026-03-02', '2026-03-02');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dayKey: '2026-03-02',
      tagId: 'kod',
      focusMs: 25 * MINUTE_MS,
      sessionCount: 1,
      pomodoroCount: 1,
    });
    expect(rows[0]?.hourMs[9]).toBe(25 * MINUTE_MS);
  });

  it('keeps a row per tag', async () => {
    await addSession(draft({ tagId: 'kod' }));
    await addSession(
      draft({
        tagId: 'ders',
        start: at(2026, 3, 2, 11),
        end: at(2026, 3, 2, 11, 30),
        durationMs: 30 * MINUTE_MS,
      }),
    );
    await addSession(
      draft({ start: at(2026, 3, 2, 14), end: at(2026, 3, 2, 14, 10), durationMs: 10 * MINUTE_MS }),
    );

    const rows = await statsForRange('2026-03-02', '2026-03-02');
    expect(rows).toHaveLength(3);
    expect(summarize(rows).focusMs).toBe(65 * MINUTE_MS);
    // Untagged is stored as the empty string.
    expect(rows.some((row) => row.tagId === '')).toBe(true);
  });

  it('writes a session over midnight to both days', async () => {
    await addSession(
      draft({
        start: at(2026, 3, 2, 23, 40),
        end: at(2026, 3, 3, 0, 20),
        durationMs: 40 * MINUTE_MS,
        mode: 'stopwatch',
      }),
    );

    expect((await totalsForDay('2026-03-02')).focusMs).toBe(20 * MINUTE_MS);
    expect((await totalsForDay('2026-03-03')).focusMs).toBe(20 * MINUTE_MS);
  });

  it('counts a Pomodoro on the day it finished', async () => {
    await addSession(
      draft({
        start: at(2026, 3, 2, 23, 50),
        end: at(2026, 3, 3, 0, 15),
        durationMs: 25 * MINUTE_MS,
      }),
    );

    expect((await totalsForDay('2026-03-02')).pomodoroCount).toBe(0);
    expect((await totalsForDay('2026-03-03')).pomodoroCount).toBe(1);
  });

  it('is updated when a session is deleted', async () => {
    const row = await addSession(draft());
    expect((await totalsForDay('2026-03-02')).focusMs).toBe(25 * MINUTE_MS);

    await deleteSession(row.id);
    expect((await totalsForDay('2026-03-02')).focusMs).toBe(0);
    expect(await statsForRange('2026-03-02', '2026-03-02')).toEqual([]);
  });

  it('recomputes both days when an edit moves a session', async () => {
    const row = await addSession(draft());

    await updateSession(row.id, {
      start: at(2026, 3, 5, 10),
      end: at(2026, 3, 5, 11),
    });

    expect((await totalsForDay('2026-03-02')).focusMs).toBe(0);
    expect((await totalsForDay('2026-03-05')).focusMs).toBe(HOUR_MS);
  });

  it('moves the time across when a tag changes', async () => {
    const row = await addSession(draft({ tagId: 'kod' }));
    await updateSession(row.id, { tagId: 'ders' });

    const rows = await statsForRange('2026-03-02', '2026-03-02');
    expect(rows.map((item) => item.tagId)).toEqual(['ders']);
  });

  it('includes a manually added session', async () => {
    await addManualSession({
      start: at(2026, 3, 4, 8),
      end: at(2026, 3, 4, 9),
      mode: 'stopwatch',
    });

    expect((await totalsForDay('2026-03-04')).focusMs).toBe(HOUR_MS);
  });

  it('can be rebuilt from the sessions', async () => {
    await addSession(draft({ tagId: 'kod' }));
    await addSession(
      draft({ start: at(2026, 3, 4, 9), end: at(2026, 3, 4, 10), durationMs: HOUR_MS }),
    );

    const before = await statsForRange('2026-03-01', '2026-03-10');
    await db.dailyStats.clear();
    await rebuildAllStats();
    const after = await statsForRange('2026-03-01', '2026-03-10');

    expect(after).toEqual(before);
  });
});

describe('range queries', () => {
  beforeEach(async () => {
    await addSession(draft({ tagId: 'kod' }));
    await addSession(
      draft({
        tagId: 'ders',
        start: at(2026, 3, 4, 9),
        end: at(2026, 3, 4, 10),
        durationMs: HOUR_MS,
      }),
    );
  });

  it('apply the tag filter', async () => {
    const all = await aggregatesForRange({ fromKey: '2026-03-01', toKey: '2026-03-10' });
    const onlyCode = await aggregatesForRange({
      fromKey: '2026-03-01',
      toKey: '2026-03-10',
      tagId: 'kod',
    });

    expect(summarize(all).focusMs).toBe(85 * MINUTE_MS);
    expect(summarize(onlyCode).focusMs).toBe(25 * MINUTE_MS);
  });

  it('return sessions newest first, a page at a time', async () => {
    const page = await sessionsForRange(
      { fromKey: '2026-03-01', toKey: '2026-03-10' },
      { offset: 0, limit: 1 },
    );

    expect(page.total).toBe(2);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.tagId).toBe('ders');
  });
});

describe('backups', () => {
  it('can be exported and restored', async () => {
    await addSession(draft({ tagId: 'kod' }));
    const backup = await exportBackup();

    await wipeHistory();
    expect((await dataCounts()).sessions).toBe(0);

    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await importBackup(parsed.data, 'replace');
    expect(result.sessions).toBe(1);
    expect((await totalsForDay('2026-03-02')).focusMs).toBe(25 * MINUTE_MS);
  });

  it('keep the existing data in merge mode', async () => {
    await addSession(draft({ id: 'eski', tagId: 'kod' }));

    const incoming = {
      app: 'breather',
      format: 1,
      exportedAt: Date.now(),
      sessions: [
        {
          id: 'yeni',
          mode: 'pomodoro',
          phase: 'focus',
          start: at(2026, 3, 6, 9),
          end: at(2026, 3, 6, 9, 25),
          durationMs: 25 * MINUTE_MS,
          pausedMs: 0,
          completed: true,
          dayKey: '2026-03-06',
        },
      ],
      breakEvents: [],
    };

    await importBackup(incoming, 'merge');

    expect((await dataCounts()).sessions).toBe(2);
    expect((await totalsForDay('2026-03-02')).focusMs).toBe(25 * MINUTE_MS);
    expect((await totalsForDay('2026-03-06')).focusMs).toBe(25 * MINUTE_MS);
  });

  it('clear the rollup along with the history', async () => {
    await addSession(draft());
    await wipeHistory();

    expect(await db.dailyStats.count()).toBe(0);
    expect((await dataCounts()).sessions).toBe(0);
  });
});

describe('a lot of data', () => {
  it('reads few rows and returns quickly across a year of 5,000 sessions', async () => {
    vi.useRealTimers();
    const { seedFakeData } = await import('@/db/seed.dev');

    const seeded = await seedFakeData({ sessions: 5000, days: 730, seed: 42 });
    expect(seeded.sessions).toBe(5000);

    const startedAt = performance.now();
    const rows = await aggregatesForRange({ fromKey: '2025-01-01', toKey: '2026-12-31' });
    const elapsed = performance.now() - startedAt;

    const totals = summarize(rows);
    expect(totals.sessionCount).toBeGreaterThan(4000);

    // A few rows per day, rather than a scan over all five thousand.
    expect(rows.length).toBeLessThan(4000);

    // fake-indexeddb is slower than the real thing, so this is a loose bound.
    expect(elapsed).toBeLessThan(2000);

    vi.useFakeTimers({ toFake: ['Date'] });
  }, 120_000);
});
