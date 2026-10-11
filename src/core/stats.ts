import { addDays, dayKey, dayKeyToTs, daysBetween, isWeekend } from './time';

/**
 * Everything the statistics page computes.
 *
 * Input is always pre-aggregated day rows, never raw sessions. That is the
 * whole reason the page opens instantly with years of history behind it: the
 * aggregation happens once, when a session closes.
 */

export interface DayAggregate {
  dayKey: string;
  /** Empty string means untagged. */
  tagId: string;
  focusMs: number;
  sessionCount: number;
  pomodoroCount: number;
  /** One entry per hour of the day. */
  hourMs: number[];
}

export interface RangeSummary {
  focusMs: number;
  sessionCount: number;

  avgSessionMs: number;
  pomodoroCount: number;
  /** Days in the range with any focus time. */
  activeDays: number;
}

export function summarize(rows: readonly DayAggregate[]): RangeSummary {
  const days = new Set<string>();
  let focusMs = 0;
  let sessionCount = 0;
  let pomodoroCount = 0;

  for (const row of rows) {
    focusMs += row.focusMs;
    sessionCount += row.sessionCount;
    pomodoroCount += row.pomodoroCount;
    if (row.focusMs > 0) days.add(row.dayKey);
  }

  return {
    focusMs,
    sessionCount,
    avgSessionMs: sessionCount > 0 ? Math.round(focusMs / sessionCount) : 0,
    pomodoroCount,
    activeDays: days.size,
  };
}

export interface DailyPoint {
  dayKey: string;
  total: number;
  /** Time per tag id. */
  byTag: Record<string, number>;
}

/**
 * Day-by-day series. Empty days are included as zeroes, because a gap in the
 * bar chart or the heatmap is information too.
 */
export function dailySeries(
  rows: readonly DayAggregate[],
  fromKey: string,
  toKey: string,
): DailyPoint[] {
  const byDay = new Map<string, DailyPoint>();

  const span = daysBetween(fromKey, toKey);
  let ts = dayKeyToTs(fromKey);
  for (let i = 0; i <= span; i++) {
    const key = dayKey(ts);
    byDay.set(key, { dayKey: key, total: 0, byTag: {} });
    ts = addDays(ts, 1);
  }

  for (const row of rows) {
    const point = byDay.get(row.dayKey);
    if (!point) continue;
    point.total += row.focusMs;
    point.byTag[row.tagId] = (point.byTag[row.tagId] ?? 0) + row.focusMs;
  }

  return [...byDay.values()];
}

export interface TagTotal {
  tagId: string;
  ms: number;
  /** Share of the total, 0 to 1. */
  share: number;
}

/** Tag totals, largest first. */
export function tagTotals(rows: readonly DayAggregate[]): TagTotal[] {
  const totals = new Map<string, number>();
  let grand = 0;

  for (const row of rows) {
    totals.set(row.tagId, (totals.get(row.tagId) ?? 0) + row.focusMs);
    grand += row.focusMs;
  }

  return [...totals.entries()]
    .filter(([, ms]) => ms > 0)
    .map(([tagId, ms]) => ({ tagId, ms, share: grand > 0 ? ms / grand : 0 }))
    .sort((a, b) => b.ms - a.ms);
}

/** Weekday by hour, [7][24] with Sunday at 0. Feeds the productive-hours card. */
export function weekdayHourMatrix(rows: readonly DayAggregate[]): number[][] {
  const matrix = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));

  for (const row of rows) {
    const weekday = new Date(dayKeyToTs(row.dayKey)).getDay();
    const line = matrix[weekday];
    if (!line) continue;

    for (let hour = 0; hour < 24; hour++) {
      line[hour] = (line[hour] ?? 0) + (row.hourMs[hour] ?? 0);
    }
  }

  return matrix;
}

export interface StreakResult {
  /** Unbroken run of days that hit the goal, counting back from today. */
  current: number;
  longest: number;
}

/**
 * Streaks.
 *
 * With weekends switched off they are skipped entirely: they neither break a
 * streak nor extend one. And today never breaks a streak just because the goal
 * hasn't been hit yet, since the day isn't over.
 */
export function streaks(
  points: readonly DailyPoint[],
  goalMs: number,
  options: { countWeekends: boolean; todayKey: string },
): StreakResult {
  if (goalMs <= 0) return { current: 0, longest: 0 };

  const met = (point: DailyPoint) => point.total >= goalMs;
  const counts = (point: DailyPoint) =>
    options.countWeekends || !isWeekend(dayKeyToTs(point.dayKey));

  let longest = 0;
  let running = 0;

  for (const point of points) {
    if (!counts(point)) continue;
    running = met(point) ? running + 1 : 0;
    longest = Math.max(longest, running);
  }

  // Current streak counts backwards from the end.
  let current = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i]!;
    if (!counts(point)) continue;

    if (met(point)) {
      current += 1;
      continue;
    }

    // Today is still in progress, so it doesn't count either way.
    if (point.dayKey === options.todayKey && current === 0) continue;
    break;
  }

  return { current, longest: Math.max(longest, current) };
}

export interface BreakCompliance {
  offered: number;
  taken: number;
  skipped: number;
  snoozed: number;
  auto: number;
}

export function emptyCompliance(): BreakCompliance {
  return { offered: 0, taken: 0, skipped: 0, snoozed: 0, auto: 0 };
}

/** Offered, taken, skipped, snoozed, per break kind. */
export function tallyBreaks(
  events: ReadonlyArray<{ type: string; action: string }>,
): Record<string, BreakCompliance> {
  const result: Record<string, BreakCompliance> = {};

  for (const event of events) {
    const bucket = (result[event.type] ??= emptyCompliance());
    if (event.action in bucket) {
      bucket[event.action as keyof BreakCompliance] += 1;
    }
  }

  return result;
}
