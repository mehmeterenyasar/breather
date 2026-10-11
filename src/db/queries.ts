import { startOfNextDay, dayKeyToTs } from '@/core/time';
import type { DayAggregate } from '@/core/stats';
import { db } from './index';
import type { BreakEventRow, SessionRow } from './index';
import { statsForRange } from './daily-stats';

/**
 * Everything the statistics page reads.
 *
 * The cards and charts come from the daily rollup. Only the session list touches
 * raw rows, and that one is paged.
 */

export interface RangeFilter {
  fromKey: string;
  toKey: string;
  /** undefined means every tag; '' means untagged only. */
  tagId?: string;
}

export async function aggregatesForRange(filter: RangeFilter): Promise<DayAggregate[]> {
  const rows = await statsForRange(filter.fromKey, filter.toKey);
  if (filter.tagId === undefined) return rows;
  return rows.filter((row) => row.tagId === filter.tagId);
}

export interface SessionPage {
  rows: SessionRow[];
  /** Total matching the filter, not just this page. */
  total: number;
}

/** Newest first, read off the `start` index. */
export async function sessionsForRange(
  filter: RangeFilter,
  page: { offset: number; limit: number },
): Promise<SessionPage> {
  const from = dayKeyToTs(filter.fromKey);
  const to = startOfNextDay(dayKeyToTs(filter.toKey));

  let collection = db.sessions.where('start').between(from, to, true, false);

  if (filter.tagId !== undefined) {
    const wanted = filter.tagId;
    collection = collection.filter((row) => (row.tagId ?? '') === wanted);
  }

  const matching = await collection.toArray();
  matching.sort((a, b) => b.start - a.start);

  return {
    total: matching.length,
    rows: matching.slice(page.offset, page.offset + page.limit),
  };
}

export async function breakEventsForRange(filter: RangeFilter): Promise<BreakEventRow[]> {
  return db.breakEvents.where('dayKey').between(filter.fromKey, filter.toKey, true, true).toArray();
}

/** Row counts, shown on the "delete everything" screen. */
export async function dataCounts(): Promise<{ sessions: number; breakEvents: number }> {
  const [sessions, breakEvents] = await Promise.all([db.sessions.count(), db.breakEvents.count()]);
  return { sessions, breakEvents };
}
