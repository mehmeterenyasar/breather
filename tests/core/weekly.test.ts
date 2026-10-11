import { describe, expect, it } from 'vitest';
import {
  isWorthReporting,
  lastFullWeek,
  nextWeeklyReportAt,
  startOfWeek,
  weekBefore,
  weeklySummary,
} from '@/core/weekly';
import type { DayAggregate } from '@/core/stats';
import { HOUR_MS, dayKey } from '@/core/time';

// The suite runs with TZ=Europe/Berlin; see vitest.config.ts.

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0, 0).getTime();

const row = (day: string, focusMs: number, sessionCount = 1): DayAggregate => ({
  dayKey: day,
  tagId: '',
  focusMs,
  sessionCount,
  pomodoroCount: 0,
  hourMs: new Array<number>(24).fill(0),
});

describe('week boundaries', () => {
  it('put the start of the week on Monday', () => {
    // Wednesday 4 March 2026.
    expect(dayKey(startOfWeek(at(2026, 3, 4)))).toBe('2026-03-02');
    // Sunday belongs to the same week.
    expect(dayKey(startOfWeek(at(2026, 3, 8)))).toBe('2026-03-02');
    // Monday is its own start.
    expect(dayKey(startOfWeek(at(2026, 3, 9)))).toBe('2026-03-09');
  });

  it('make the last full week the previous one, not the current one', () => {
    expect(lastFullWeek(at(2026, 3, 4))).toEqual({
      fromKey: '2026-02-23',
      toKey: '2026-03-01',
    });
  });

  it('step back seven days for the week before', () => {
    expect(weekBefore({ fromKey: '2026-02-23', toKey: '2026-03-01' })).toEqual({
      fromKey: '2026-02-16',
      toKey: '2026-02-22',
    });
  });
});

describe('the weekly summary', () => {
  const week = [row('2026-02-23', 2 * HOUR_MS), row('2026-02-25', 3 * HOUR_MS, 4)];

  it('counts the total, the sessions and the active days', () => {
    const summary = weeklySummary(week, []);

    expect(summary.focusMs).toBe(5 * HOUR_MS);
    expect(summary.sessionCount).toBe(5);
    expect(summary.activeDays).toBe(2);
  });

  it('compares against the week before as a percentage', () => {
    const previous = [row('2026-02-16', 4 * HOUR_MS)];
    expect(weeklySummary(week, previous).deltaPercent).toBe(25);

    const higher = [row('2026-02-16', 10 * HOUR_MS)];
    expect(weeklySummary(week, higher).deltaPercent).toBe(-50);
  });

  it('skips the percentage when the previous week was empty', () => {
    // There is no percentage rise from zero, so the message drops the clause.
    expect(weeklySummary(week, []).deltaPercent).toBeNull();
  });

  it('is not worth sending for an empty week', () => {
    expect(isWorthReporting(weeklySummary([], []))).toBe(false);
    expect(isWorthReporting(weeklySummary([row('2026-02-23', 0)], []))).toBe(false);
    expect(isWorthReporting(weeklySummary(week, []))).toBe(true);
  });
});

describe('when the notification goes out', () => {
  it('is today if it is Monday and the hour has not passed', () => {
    // Monday 2 March 2026 at 07:00, so 09:00 is still ahead.
    const monday7 = at(2026, 3, 2, 7);
    expect(nextWeeklyReportAt(monday7, 9)).toBe(at(2026, 3, 2, 9));
  });

  it('is next Monday once the hour has passed', () => {
    const monday10 = at(2026, 3, 2, 10);
    expect(nextWeeklyReportAt(monday10, 9)).toBe(at(2026, 3, 9, 9));
  });

  it('aims at next Monday from midweek', () => {
    expect(nextWeeklyReportAt(at(2026, 3, 5), 9)).toBe(at(2026, 3, 9, 9));
  });

  it('aims at tomorrow on a Sunday evening', () => {
    expect(nextWeeklyReportAt(at(2026, 3, 8, 22), 9)).toBe(at(2026, 3, 9, 9));
  });
});
