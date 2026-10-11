import { storage } from 'wxt/utils/storage';
import { dayKey } from '@/core/time';

/**
 * Today's numbers, kept here so the popup never has to open IndexedDB. The
 * worker rewrites this little record whenever a session closes.
 *
 * A `dayKey` that isn't today means the record is stale: the popup shows zeros
 * and asks the worker for a fresh one.
 */

const KEY = 'local:todaySummary' as const;

export interface TodaySummary {
  dayKey: string;
  focusMs: number;
  pomodoroCount: number;
  sessionCount: number;
  /** Glasses of water logged today. */
  waterGlasses: number;
  updatedAt: number;
}

export function emptySummary(key: string, now: number): TodaySummary {
  return {
    dayKey: key,
    focusMs: 0,
    pomodoroCount: 0,
    sessionCount: 0,
    waterGlasses: 0,
    updatedAt: now,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** A stale record comes back zeroed rather than wrong. */
export function normalizeSummary(raw: unknown, now: number): TodaySummary {
  const today = dayKey(now);
  if (!isRecord(raw) || raw.dayKey !== today) return emptySummary(today, now);

  return {
    dayKey: today,
    focusMs: n(raw.focusMs),
    pomodoroCount: n(raw.pomodoroCount),
    sessionCount: n(raw.sessionCount),
    waterGlasses: n(raw.waterGlasses),
    updatedAt: n(raw.updatedAt),
  };
}

export async function readTodaySummary(now: number): Promise<TodaySummary> {
  return normalizeSummary(await storage.getItem<unknown>(KEY), now);
}

export async function writeTodaySummary(summary: TodaySummary): Promise<void> {
  await storage.setItem(KEY, summary);
}

export function watchTodaySummary(
  now: () => number,
  callback: (summary: TodaySummary) => void,
): () => void {
  return storage.watch<unknown>(KEY, (value) => callback(normalizeSummary(value, now())));
}
