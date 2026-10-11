import { distributeByHour, splitSessionByDay } from '@/core/day-split';
import { DAY_MS, dayKey, dayKeyToTs, startOfNextDay } from '@/core/time';
import { db } from './index';
import type { DailyStatRow, SessionRow } from './index';

/**
 * The rollup that makes the statistics page quick: a few rows per day instead
 * of a scan over every session ever recorded. Nothing here is original data, so
 * `rebuildAllStats` can always produce it again from the sessions.
 *
 * Writes recompute whole days rather than adjusting totals in place. That is
 * slower, but an incremental update that drifts out of step is much worse than
 * a recompute nobody notices.
 */

interface Bucket {
  focusMs: number;
  sessionCount: number;
  pomodoroCount: number;
  hourMs: number[];
}

function emptyBucket(): Bucket {
  return { focusMs: 0, sessionCount: 0, pomodoroCount: 0, hourMs: new Array<number>(24).fill(0) };
}

/** Recomputes one day's rows from the sessions. */
export async function recomputeDay(key: string): Promise<DailyStatRow[]> {
  const dayStart = dayKeyToTs(key);
  const dayEnd = startOfNextDay(dayStart);

  // Reach back a day: a session that started yesterday may run into this one.
  const candidates = await db.sessions
    .where('start')
    .between(dayStart - DAY_MS, dayEnd, true, false)
    .toArray();

  const buckets = new Map<string, Bucket>();

  for (const session of candidates) {
    if (session.phase !== 'focus') continue;

    const tagId = session.tagId ?? '';
    const slice = splitSessionByDay(session).find((item) => item.dayKey === key);

    if (slice && slice.durationMs > 0) {
      const bucket = buckets.get(tagId) ?? emptyBucket();
      bucket.focusMs += slice.durationMs;
      bucket.sessionCount += 1;

      const hours = distributeByHour(slice.start, slice.end, slice.durationMs);
      for (let hour = 0; hour < 24; hour++) {
        bucket.hourMs[hour] = (bucket.hourMs[hour] ?? 0) + (hours[hour] ?? 0);
      }

      buckets.set(tagId, bucket);
    }

    // A Pomodoro counts on the day it finished, not the day it began.
    if (session.mode === 'pomodoro' && session.completed && dayKey(session.end) === key) {
      const bucket = buckets.get(tagId) ?? emptyBucket();
      bucket.pomodoroCount += 1;
      buckets.set(tagId, bucket);
    }
  }

  const rows: DailyStatRow[] = [...buckets.entries()].map(([tagId, bucket]) => ({
    dayKey: key,
    tagId,
    ...bucket,
  }));

  await db.transaction('rw', db.dailyStats, async () => {
    await db.dailyStats.where('dayKey').equals(key).delete();
    if (rows.length > 0) await db.dailyStats.bulkPut(rows);
  });

  return rows;
}

export async function recomputeDays(keys: Iterable<string>): Promise<void> {
  for (const key of new Set(keys)) {
    await recomputeDay(key);
  }
}

/** The days a session touches, which is two when it crosses midnight. */
export function affectedDays(session: Pick<SessionRow, 'start' | 'end'>): string[] {
  return [...new Set([dayKey(session.start), dayKey(session.end)])];
}

/** Rebuilds the whole table. For after an import, or after something went wrong. */
export async function rebuildAllStats(): Promise<number> {
  await db.dailyStats.clear();

  const days = new Set<string>();
  await db.sessions.each((session) => {
    for (const key of affectedDays(session)) days.add(key);
  });

  await recomputeDays(days);
  return days.size;
}

export async function statsForRange(fromKey: string, toKey: string): Promise<DailyStatRow[]> {
  return db.dailyStats.where('dayKey').between(fromKey, toKey, true, true).toArray();
}
