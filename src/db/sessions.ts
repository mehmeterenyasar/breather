import { dayKey } from '@/core/time';
import type { BreakAction, BreakKind, Mode } from '@/core/types';
import type { ClosedSessionDraft } from '@/core/timer';
import { db } from './index';
import type { BreakEventRow, SessionRow, SessionSource } from './index';
import { affectedDays, recomputeDays, statsForRange } from './daily-stats';

/**
 * Writing sessions and break events.
 *
 * Every write also updates the daily rollup, which is what keeps the statistics
 * page off the raw rows.
 */

export async function addSession(
  draft: ClosedSessionDraft,
  source: SessionSource = 'timer',
): Promise<SessionRow> {
  const row: SessionRow = {
    id: draft.id,
    mode: draft.mode,
    phase: draft.phase,
    start: draft.start,
    end: draft.end,
    durationMs: draft.durationMs,
    pausedMs: draft.pausedMs,
    completed: draft.completed,
    source,
    dayKey: dayKey(draft.start),
    ...(draft.tagId ? { tagId: draft.tagId } : {}),
  };

  await db.sessions.put(row);
  await recomputeDays(affectedDays(row));
  return row;
}

/** For work you did but forgot to time. */
export async function addManualSession(input: {
  start: number;
  end: number;
  mode: Mode;
  tagId?: string;
  note?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
}): Promise<SessionRow> {
  const durationMs = Math.max(0, input.end - input.start);

  const row: SessionRow = {
    id: crypto.randomUUID(),
    mode: input.mode,
    phase: 'focus',
    start: input.start,
    end: input.end,
    durationMs,
    pausedMs: 0,
    completed: true,
    source: 'manual',
    dayKey: dayKey(input.start),
    ...(input.tagId ? { tagId: input.tagId } : {}),
    ...(input.note ? { note: input.note } : {}),
    ...(input.rating ? { rating: input.rating } : {}),
  };

  await db.sessions.put(row);
  await recomputeDays(affectedDays(row));
  return row;
}

/** Both the old and the new day are recomputed, in case the edit moved it. */
export async function updateSession(
  id: string,
  changes: Partial<Pick<SessionRow, 'start' | 'end' | 'tagId' | 'note' | 'rating' | 'mode'>>,
): Promise<SessionRow | undefined> {
  const existing = await db.sessions.get(id);
  if (!existing) return undefined;

  const next: SessionRow = { ...existing, ...changes };
  if (changes.start != null || changes.end != null) {
    next.durationMs = Math.max(0, next.end - next.start);
    next.dayKey = dayKey(next.start);
  }

  await db.sessions.put(next);
  await recomputeDays([...affectedDays(existing), ...affectedDays(next)]);
  return next;
}

export async function deleteSession(id: string): Promise<void> {
  const existing = await db.sessions.get(id);
  if (!existing) return;

  await db.sessions.delete(id);
  await recomputeDays(affectedDays(existing));
}

/** The stars and note from the popup. */
export async function reviewSession(
  sessionId: string,
  review: { rating?: 1 | 2 | 3 | 4 | 5; note?: string },
): Promise<void> {
  const changes: Partial<SessionRow> = {};

  if (review.rating != null) changes.rating = review.rating;

  if (review.note != null) {
    const note = review.note.trim().slice(0, 280);
    if (note) changes.note = note;
  }

  if (Object.keys(changes).length === 0) return;
  // Neither affects any total, so there is nothing to recompute.
  await db.sessions.update(sessionId, changes);
}

export async function addBreakEvent(event: {
  id: string;
  type: BreakKind;
  at: number;
  action: BreakAction;
  durationMs?: number;
}): Promise<BreakEventRow> {
  const row: BreakEventRow = {
    id: event.id,
    type: event.type,
    at: event.at,
    action: event.action,
    dayKey: dayKey(event.at),
    ...(event.durationMs == null ? {} : { durationMs: event.durationMs }),
  };

  await db.breakEvents.put(row);
  return row;
}

export interface DayTotals {
  dayKey: string;
  focusMs: number;
  pomodoroCount: number;
  sessionCount: number;
}

/** One day's totals, from the rollup. */
export async function totalsForDay(key: string): Promise<DayTotals> {
  const rows = await statsForRange(key, key);

  return rows.reduce<DayTotals>(
    (totals, row) => ({
      dayKey: key,
      focusMs: totals.focusMs + row.focusMs,
      pomodoroCount: totals.pomodoroCount + row.pomodoroCount,
      sessionCount: totals.sessionCount + row.sessionCount,
    }),
    { dayKey: key, focusMs: 0, pomodoroCount: 0, sessionCount: 0 },
  );
}
