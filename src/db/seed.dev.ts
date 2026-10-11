import { MINUTE_MS, dayKey, startOfDay } from '@/core/time';
import type { Mode } from '@/core/types';
import { db } from './index';
import type { BreakEventRow, SessionRow } from './index';
import { rebuildAllStats } from './daily-stats';

/**
 * Fake data, development builds only.
 *
 * It exists to answer one question: does the statistics page still open in
 * under a second with two years and five thousand sessions behind it? Nothing
 * in a production build imports this, and the `import.meta.env.DEV` guard in
 * settings keeps it out of the bundle entirely.
 */

const TAGS = ['seed-study', 'seed-code', 'seed-reading', 'seed-writing', ''] as const;
const MODES: Mode[] = ['pomodoro', 'pomodoro', 'pomodoro', 'stopwatch', 'countdown', 'flowtime'];

/** mulberry32, so a given seed always produces the same data. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(items: readonly T[], random: number): T =>
  items[Math.floor(random * items.length)] ?? items[0]!;

export interface SeedOptions {
  sessions?: number;
  days?: number;
  seed?: number;
}

export interface SeedResult {
  sessions: number;
  breakEvents: number;
  days: number;
  elapsedMs: number;
}

export async function seedFakeData(options: SeedOptions = {}): Promise<SeedResult> {
  const total = options.sessions ?? 5000;
  const days = options.days ?? 730;
  const random = rng(options.seed ?? 20260302);

  const startedAt = Date.now();
  const today = startOfDay(Date.now());

  const sessions: SessionRow[] = [];
  const events: BreakEventRow[] = [];

  // Spread over the days unevenly, and go round more than once if the requested
  // count needs it.
  let remaining = total;
  const density = Math.max(1, total / days);

  for (let pass = 0; remaining > 0 && pass < 8; pass++) {
    for (let dayOffset = days - 1; dayOffset >= 0 && remaining > 0; dayOffset--) {
      const dayStart = startOfDay(today - dayOffset * 24 * 60 * 60 * 1000);
      const date = new Date(dayStart);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      // Thinner at weekends, with the odd day of nothing at all.
      const roll = random();
      if (roll < (isWeekend ? 0.55 : 0.12)) continue;

      const perDay = Math.min(remaining, 1 + Math.floor(random() * density * (isWeekend ? 1 : 2)));
      let cursor = dayStart + (8 + Math.floor(random() * 3)) * 60 * MINUTE_MS;

      for (let i = 0; i < perDay; i++) {
        const mode = pick(MODES, random());
        const minutes = mode === 'pomodoro' ? 25 : 15 + Math.floor(random() * 75);
        const durationMs = minutes * MINUTE_MS;
        const pausedMs = random() < 0.25 ? Math.floor(random() * 5) * MINUTE_MS : 0;

        const start = cursor;
        const end = start + durationMs + pausedMs;
        const tagId = pick(TAGS, random());

        sessions.push({
          id: `seed-${pass}-${dayOffset}-${i}`,
          mode,
          phase: 'focus',
          start,
          end,
          durationMs,
          pausedMs,
          completed: random() > 0.12,
          source: 'timer',
          dayKey: dayKey(start),
          ...(tagId ? { tagId } : {}),
          ...(random() < 0.3
            ? { rating: (1 + Math.floor(random() * 5)) as 1 | 2 | 3 | 4 | 5 }
            : {}),
        });

        // A break event or two around each session.
        const kinds = ['eye', 'breath', 'posture', 'water'] as const;
        const actions = ['taken', 'taken', 'skipped', 'snoozed'] as const;
        events.push({
          id: `seed-ev-${pass}-${dayOffset}-${i}`,
          type: pick(kinds, random()),
          at: end,
          action: pick(actions, random()),
          dayKey: dayKey(end),
          durationMs: 20_000,
        });

        cursor = end + (5 + Math.floor(random() * 40)) * MINUTE_MS;
        remaining -= 1;
        if (remaining === 0) break;
      }
    }
  }

  await db.transaction('rw', db.sessions, db.breakEvents, db.dailyStats, async () => {
    await db.sessions.bulkPut(sessions);
    await db.breakEvents.bulkPut(events);
  });

  const dayCount = await rebuildAllStats();

  return {
    sessions: sessions.length,
    breakEvents: events.length,
    days: dayCount,
    elapsedMs: Date.now() - startedAt,
  };
}

/** Removes only the seeded rows; real sessions are left alone. */
export async function clearFakeData(): Promise<number> {
  const ids = await db.sessions.where('id').startsWith('seed-').primaryKeys();
  const eventIds = await db.breakEvents.where('id').startsWith('seed-ev-').primaryKeys();

  await db.transaction('rw', db.sessions, db.breakEvents, db.dailyStats, async () => {
    await db.sessions.bulkDelete(ids);
    await db.breakEvents.bulkDelete(eventIds);
  });

  await rebuildAllStats();
  return ids.length;
}
