import { describe, expect, it } from 'vitest';
import {
  dailySeries,
  streaks,
  summarize,
  tagTotals,
  tallyBreaks,
  weekdayHourMatrix,
} from '@/core/stats';
import type { DayAggregate } from '@/core/stats';
import { HOUR_MS, MINUTE_MS } from '@/core/time';
import { normalizeRange, resolveRange, trailingYear } from '@/core/ranges';

const hours = (pairs: Record<number, number> = {}): number[] =>
  Array.from({ length: 24 }, (_, hour) => pairs[hour] ?? 0);

const row = (
  dayKey: string,
  tagId: string,
  focusMs: number,
  extra: Partial<DayAggregate> = {},
): DayAggregate => ({
  dayKey,
  tagId,
  focusMs,
  sessionCount: 1,
  pomodoroCount: 0,
  hourMs: hours(),
  ...extra,
});

describe('the summary', () => {
  it('adds up the totals and the average', () => {
    const rows = [
      row('2026-03-02', '', 30 * MINUTE_MS, { sessionCount: 2, pomodoroCount: 1 }),
      row('2026-03-03', 'code', 60 * MINUTE_MS, { sessionCount: 2, pomodoroCount: 2 }),
    ];

    expect(summarize(rows)).toEqual({
      focusMs: 90 * MINUTE_MS,
      sessionCount: 4,
      avgSessionMs: 22.5 * MINUTE_MS,
      pomodoroCount: 3,
      activeDays: 2,
    });
  });

  it('returns zeros for an empty range', () => {
    expect(summarize([])).toEqual({
      focusMs: 0,
      sessionCount: 0,
      avgSessionMs: 0,
      pomodoroCount: 0,
      activeDays: 0,
    });
  });

  it('does not count a day with no focus as an active day', () => {
    expect(summarize([row('2026-03-02', '', 0, { sessionCount: 0 })]).activeDays).toBe(0);
  });
});

describe('the daily series', () => {
  it('includes the days with no data', () => {
    const series = dailySeries([row('2026-03-03', '', 30 * MINUTE_MS)], '2026-03-01', '2026-03-05');

    expect(series).toHaveLength(5);
    expect(series.map((point) => point.total)).toEqual([0, 0, 30 * MINUTE_MS, 0, 0]);
  });

  it('keeps the tags of one day apart and also sums them', () => {
    const series = dailySeries(
      [row('2026-03-02', 'code', 20 * MINUTE_MS), row('2026-03-02', 'study', 10 * MINUTE_MS)],
      '2026-03-02',
      '2026-03-02',
    );

    expect(series[0]?.total).toBe(30 * MINUTE_MS);
    expect(series[0]?.byTag).toEqual({ code: 20 * MINUTE_MS, study: 10 * MINUTE_MS });
  });

  it('ignores rows outside the range', () => {
    const series = dailySeries([row('2026-02-01', '', 99)], '2026-03-01', '2026-03-02');
    expect(series.every((point) => point.total === 0)).toBe(true);
  });
});

describe('the tag breakdown', () => {
  it('sorts by time and works out each share', () => {
    const totals = tagTotals([
      row('2026-03-02', 'code', 60 * MINUTE_MS),
      row('2026-03-02', 'study', 20 * MINUTE_MS),
      row('2026-03-03', 'code', 20 * MINUTE_MS),
    ]);

    expect(totals.map((item) => item.tagId)).toEqual(['code', 'study']);
    expect(totals[0]?.ms).toBe(80 * MINUTE_MS);
    expect(totals[0]?.share).toBeCloseTo(0.8);
    expect(totals[1]?.share).toBeCloseTo(0.2);
  });

  it('leaves out tags with no time against them', () => {
    expect(tagTotals([row('2026-03-02', 'code', 0)])).toEqual([]);
  });
});

describe('the day-by-hour heatmap', () => {
  it('puts the hours on the right day', () => {
    // Monday 2 March 2026, which is getDay 1.
    const matrix = weekdayHourMatrix([
      row('2026-03-02', '', HOUR_MS, { hourMs: hours({ 9: HOUR_MS }) }),
      row('2026-03-09', '', HOUR_MS, { hourMs: hours({ 9: HOUR_MS }) }),
    ]);

    expect(matrix[1]?.[9]).toBe(2 * HOUR_MS);
    expect(matrix[0]?.[9]).toBe(0);
    expect(matrix).toHaveLength(7);
    expect(matrix[0]).toHaveLength(24);
  });
});

describe('streaks', () => {
  const goal = 60 * MINUTE_MS;

  const series = (totals: number[], startDay = 2) =>
    totals.map((total, index) => ({
      dayKey: `2026-03-${String(startDay + index).padStart(2, '0')}`,
      total,
      byTag: {},
    }));

  it('count the consecutive days that met the goal', () => {
    const points = series([goal, goal, goal]);
    expect(streaks(points, goal, { countWeekends: true, todayKey: '2026-03-04' })).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it('are broken by a day under the goal', () => {
    const points = series([goal, 0, goal, goal]);
    expect(streaks(points, goal, { countWeekends: true, todayKey: '2026-03-05' })).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it('survive a today that has not reached the goal yet', () => {
    // 2-4 March met the goal; 5 March is today and has not yet.
    const points = series([goal, goal, goal, 0]);
    expect(streaks(points, goal, { countWeekends: true, todayKey: '2026-03-05' }).current).toBe(3);
  });

  it('neither break nor extend over a weekend that is excluded', () => {
    // Friday 6 March, the weekend, then Monday 9 March.
    const points = [
      { dayKey: '2026-03-06', total: goal, byTag: {} },
      { dayKey: '2026-03-07', total: 0, byTag: {} },
      { dayKey: '2026-03-08', total: 0, byTag: {} },
      { dayKey: '2026-03-09', total: goal, byTag: {} },
    ];

    expect(streaks(points, goal, { countWeekends: false, todayKey: '2026-03-09' }).current).toBe(2);
    expect(streaks(points, goal, { countWeekends: true, todayKey: '2026-03-09' }).current).toBe(1);
  });

  it('are not calculated without a goal', () => {
    expect(streaks(series([goal, goal]), 0, { countWeekends: true, todayKey: 'x' })).toEqual({
      current: 0,
      longest: 0,
    });
  });

  it('track the longest separately from the current one', () => {
    const points = series([goal, goal, goal, 0, goal]);
    const result = streaks(points, goal, { countWeekends: true, todayKey: '2026-03-06' });

    expect(result.longest).toBe(3);
    expect(result.current).toBe(1);
  });
});

describe('break compliance', () => {
  it('counts by kind and by what was done', () => {
    const tally = tallyBreaks([
      { type: 'eye', action: 'offered' },
      { type: 'eye', action: 'taken' },
      { type: 'eye', action: 'skipped' },
      { type: 'water', action: 'taken' },
      { type: 'eye', action: 'bilinmeyen' },
    ]);

    expect(tally.eye).toEqual({ offered: 1, taken: 1, skipped: 1, snoozed: 0, auto: 0 });
    expect(tally.water?.taken).toBe(1);
  });
});

describe('the date ranges', () => {
  // TZ=Europe/Berlin, and 4 March 2026 was a Wednesday.
  const wednesday = new Date(2026, 2, 4, 15, 0, 0, 0).getTime();

  it('make today a single day', () => {
    expect(resolveRange('today', wednesday)).toEqual({
      fromKey: '2026-03-04',
      toKey: '2026-03-04',
    });
  });

  it('start the week on Monday', () => {
    expect(resolveRange('week', wednesday).fromKey).toBe('2026-03-02');
  });

  it('start this month on the first of the month', () => {
    expect(resolveRange('month', wednesday).fromKey).toBe('2026-03-01');
  });

  it('include today in the last 30 days', () => {
    const range = resolveRange('last30', wednesday);
    expect(range.fromKey).toBe('2026-02-03');
    expect(range.toKey).toBe('2026-03-04');
  });

  it('start this year on 1 January', () => {
    expect(resolveRange('year', wednesday).fromKey).toBe('2026-01-01');
  });

  it('give the heatmap the last 365 days', () => {
    const range = trailingYear(wednesday);
    expect(range.fromKey).toBe('2025-03-05');
    expect(range.toKey).toBe('2026-03-04');
  });

  it('put a backwards custom range the right way round', () => {
    expect(normalizeRange('2026-03-10', '2026-03-01')).toEqual({
      fromKey: '2026-03-01',
      toKey: '2026-03-10',
    });
  });
});
