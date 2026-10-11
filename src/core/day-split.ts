import { dayKey, startOfNextDay } from './time';

/**
 * Splitting sessions that run past midnight.
 *
 * A session from 23:40 to 00:20 is twenty minutes of yesterday and twenty of
 * today. Anything else makes "how long did I focus today" wrong.
 */

export interface DaySlice {
  dayKey: string;

  start: number;

  end: number;
  /** Net time that falls on this day. */
  durationMs: number;
}

/** Cuts [start, end) at local midnights. */
export function splitRangeByDay(start: number, end: number): Array<{ start: number; end: number }> {
  if (!(end > start)) return [];

  const slices: Array<{ start: number; end: number }> = [];
  let cursor = start;
  // A "session" longer than a decade is corrupt data, not a long day.
  let guard = 0;

  while (cursor < end && guard++ < 4000) {
    const boundary = Math.min(startOfNextDay(cursor), end);
    slices.push({ start: cursor, end: boundary });
    cursor = boundary;
  }

  return slices;
}

/**
 * Spreads the session's net time across the days it touches.
 *
 * Pauses mean net time is usually shorter than the wall-clock span, so it gets
 * shared out in proportion to each slice. The last slice absorbs the rounding
 * remainder, which keeps the slices adding up to exactly durationMs.
 */
export function splitSessionByDay(session: {
  start: number;
  end: number;
  durationMs: number;
}): DaySlice[] {
  const { start, end, durationMs } = session;

  const ranges = splitRangeByDay(start, end);
  if (ranges.length === 0) {
    return durationMs > 0 ? [{ dayKey: dayKey(start), start, end: start, durationMs }] : [];
  }

  const span = end - start;
  let assigned = 0;

  return ranges.map((range, i) => {
    const isLast = i === ranges.length - 1;
    const portion = isLast
      ? durationMs - assigned
      : Math.round((durationMs * (range.end - range.start)) / span);
    assigned += portion;

    return {
      dayKey: dayKey(range.start),
      start: range.start,
      end: range.end,
      durationMs: portion,
    };
  });
}

/**
 * Same idea one level down: spread a day slice across the hours it covers,
 * which is what the weekday-by-hour heatmap needs. 09:40 to 10:20 is twenty
 * minutes in hour 9 and twenty in hour 10. The longest slice takes the
 * rounding remainder so the total still matches.
 */
export function distributeByHour(start: number, end: number, durationMs: number): number[] {
  const hours = new Array<number>(24).fill(0);
  if (durationMs <= 0) return hours;

  const span = end - start;
  if (span <= 0) {
    hours[new Date(start).getHours()] = durationMs;
    return hours;
  }

  let cursor = start;
  let assigned = 0;
  let longestHour = new Date(start).getHours();
  let longestSpan = 0;

  // A day slice tops out at 25 hours thanks to DST.
  let guard = 0;
  while (cursor < end && guard++ < 48) {
    const date = new Date(cursor);
    const hour = date.getHours();

    const nextHour = new Date(cursor);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);

    const boundary = Math.min(nextHour.getTime(), end);
    const chunk = boundary - cursor;

    const portion = Math.round((durationMs * chunk) / span);
    hours[hour] = (hours[hour] ?? 0) + portion;
    assigned += portion;

    if (chunk > longestSpan) {
      longestSpan = chunk;
      longestHour = hour;
    }

    cursor = boundary;
  }

  // Give the remainder to the longest slice.
  const remainder = durationMs - assigned;
  if (remainder !== 0) hours[longestHour] = (hours[longestHour] ?? 0) + remainder;

  return hours;
}
