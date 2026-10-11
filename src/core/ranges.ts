import { addDays, dayKey, startOfDay } from './time';

/**
 * Date ranges for the statistics page.
 *
 * Weeks start on Monday. "This month" and "this year" are calendar ranges;
 * "last 30 days" is a rolling window that includes today.
 */

export const RANGE_IDS = ['today', 'week', 'month', 'last30', 'year', 'custom'] as const;
export type RangeId = (typeof RANGE_IDS)[number];

export interface DayRange {
  fromKey: string;
  toKey: string;
}

/** Monday of the week containing `ts`. */
function startOfWeek(ts: number): number {
  const date = new Date(startOfDay(ts));
  // getDay puts Sunday at 0, so shift it to make Monday the start.
  const back = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - back);
  return date.getTime();
}

export function resolveRange(id: Exclude<RangeId, 'custom'>, now: number): DayRange {
  const today = dayKey(now);

  switch (id) {
    case 'today':
      return { fromKey: today, toKey: today };
    case 'week':
      return { fromKey: dayKey(startOfWeek(now)), toKey: today };
    case 'month': {
      const date = new Date(startOfDay(now));
      date.setDate(1);
      return { fromKey: dayKey(date.getTime()), toKey: today };
    }
    case 'last30':
      return { fromKey: dayKey(addDays(now, -29)), toKey: today };
    case 'year': {
      const date = new Date(startOfDay(now));
      date.setMonth(0, 1);
      return { fromKey: dayKey(date.getTime()), toKey: today };
    }
  }
}

/** Custom range, with the ends swapped if they came in backwards. */
export function normalizeRange(fromKey: string, toKey: string): DayRange {
  return fromKey <= toKey ? { fromKey, toKey } : { fromKey: toKey, toKey: fromKey };
}

/** The trailing year the heatmap draws. */
export function trailingYear(now: number): DayRange {
  return { fromKey: dayKey(addDays(now, -364)), toKey: dayKey(now) };
}
