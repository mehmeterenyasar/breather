import { addDays, dayKey, startOfDay } from './time';
import type { DayAggregate } from './stats';

/**
 * The Monday morning summary: last week's total and how it compares with the
 * week before. One sentence, no streak badges, no confetti.
 */

/** Monday 00:00 of the week containing `ts`. */
export function startOfWeek(ts: number): number {
  const date = new Date(startOfDay(ts));
  const back = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - back);
  return date.getTime();
}

export interface WeekRange {
  fromKey: string;
  toKey: string;
}

/** The last complete week, Monday to Sunday. Not the one in progress. */
export function lastFullWeek(now: number): WeekRange {
  const thisWeekStart = startOfWeek(now);
  const start = addDays(thisWeekStart, -7);
  return { fromKey: dayKey(start), toKey: dayKey(addDays(start, 6)) };
}

/** And the one before that. */
export function weekBefore(range: WeekRange): WeekRange {
  const start = addDays(new Date(`${range.fromKey}T00:00:00`).getTime(), -7);
  return { fromKey: dayKey(start), toKey: dayKey(addDays(start, 6)) };
}

export interface WeeklySummary {
  focusMs: number;
  previousMs: number;
  /** Percentage change, or null when there is nothing to compare against. */
  deltaPercent: number | null;
  sessionCount: number;
  activeDays: number;
}

const sum = (rows: readonly DayAggregate[]) => rows.reduce((total, row) => total + row.focusMs, 0);

export function weeklySummary(
  thisWeek: readonly DayAggregate[],
  previousWeek: readonly DayAggregate[],
): WeeklySummary {
  const focusMs = sum(thisWeek);
  const previousMs = sum(previousWeek);

  const days = new Set(thisWeek.filter((row) => row.focusMs > 0).map((row) => row.dayKey));

  return {
    focusMs,
    previousMs,
    // No percentage exists for a rise from zero, so the message drops the
    // comparison clause instead of inventing one.
    deltaPercent: previousMs > 0 ? Math.round(((focusMs - previousMs) / previousMs) * 100) : null,
    sessionCount: thisWeek.reduce((total, row) => total + row.sessionCount, 0),
    activeDays: days.size,
  };
}

/** Nobody wants a notification saying "you focused for 0 minutes". */
export function isWorthReporting(summary: WeeklySummary): boolean {
  return summary.focusMs > 0;
}

/** Next Monday at the given hour, or today if that hour hasn't passed yet. */
export function nextWeeklyReportAt(now: number, hour: number): number {
  const candidate = new Date(startOfWeek(now));
  candidate.setHours(hour, 0, 0, 0);

  if (candidate.getTime() > now) return candidate.getTime();

  const next = new Date(addDays(candidate.getTime(), 7));
  next.setHours(hour, 0, 0, 0);
  return next.getTime();
}
