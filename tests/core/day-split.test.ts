import { describe, expect, it } from 'vitest';
import { splitRangeByDay, splitSessionByDay } from '@/core/day-split';
import { HOUR_MS, MINUTE_MS } from '@/core/time';

// The suite runs with TZ=Europe/Berlin; see vitest.config.ts.

const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0).getTime();

describe('splitting a range by day', () => {
  it('leaves a range inside one day as one slice', () => {
    const start = at(2026, 5, 10, 9);
    const end = at(2026, 5, 10, 10);

    expect(splitRangeByDay(start, end)).toEqual([{ start, end }]);
  });

  it('splits a range that crosses midnight in two', () => {
    const start = at(2026, 5, 10, 23, 40);
    const end = at(2026, 5, 11, 0, 20);
    const midnight = at(2026, 5, 11, 0);

    expect(splitRangeByDay(start, end)).toEqual([
      { start, end: midnight },
      { start: midnight, end },
    ]);
  });

  it('gives a slice per day across several days', () => {
    const slices = splitRangeByDay(at(2026, 5, 10, 22), at(2026, 5, 13, 3));
    expect(slices).toHaveLength(4);
    expect(slices[0]?.start).toBe(at(2026, 5, 10, 22));
    expect(slices[3]?.end).toBe(at(2026, 5, 13, 3));
  });

  it('produces nothing for an empty or backwards range', () => {
    const t = at(2026, 5, 10, 9);
    expect(splitRangeByDay(t, t)).toEqual([]);
    expect(splitRangeByDay(t, t - 1000)).toEqual([]);
  });
});

describe('splitting a session by day', () => {
  it('divides a session over midnight between the two days', () => {
    const slices = splitSessionByDay({
      start: at(2026, 5, 10, 23, 40),
      end: at(2026, 5, 11, 0, 20),
      durationMs: 40 * MINUTE_MS,
    });

    expect(slices).toHaveLength(2);
    expect(slices[0]).toMatchObject({ dayKey: '2026-05-10', durationMs: 20 * MINUTE_MS });
    expect(slices[1]).toMatchObject({ dayKey: '2026-05-11', durationMs: 20 * MINUTE_MS });
  });

  it('shares the net time in proportion to the slices', () => {
    // Two hours between 23:00 and 01:00, but only 60 minutes of work.
    const slices = splitSessionByDay({
      start: at(2026, 5, 10, 23),
      end: at(2026, 5, 11, 1),
      durationMs: 60 * MINUTE_MS,
    });

    expect(slices.map((s) => s.durationMs)).toEqual([30 * MINUTE_MS, 30 * MINUTE_MS]);
  });

  it('loses nothing to rounding: the slices sum to the net duration', () => {
    const durationMs = 3_333_333;
    const slices = splitSessionByDay({
      start: at(2026, 5, 10, 22, 17),
      end: at(2026, 5, 11, 1, 43),
      durationMs,
    });

    expect(slices.reduce((sum, s) => sum + s.durationMs, 0)).toBe(durationMs);
  });

  it('leaves a session inside one day alone', () => {
    const slices = splitSessionByDay({
      start: at(2026, 5, 10, 9),
      end: at(2026, 5, 10, 9, 25),
      durationMs: 25 * MINUTE_MS,
    });

    expect(slices).toEqual([
      {
        dayKey: '2026-05-10',
        start: at(2026, 5, 10, 9),
        end: at(2026, 5, 10, 9, 25),
        durationMs: 25 * MINUTE_MS,
      },
    ]);
  });

  it('gets the 23 hour DST day right', () => {
    // 29 March 2026: the clocks go forward, so that day is 23 hours long.
    const slices = splitSessionByDay({
      start: at(2026, 3, 28, 23),
      end: at(2026, 3, 29, 12),
      durationMs: 12 * HOUR_MS,
    });

    expect(slices.map((s) => s.dayKey)).toEqual(['2026-03-28', '2026-03-29']);
    expect(slices.reduce((sum, s) => sum + s.durationMs, 0)).toBe(12 * HOUR_MS);
  });

  it('assigns a zero-length session to the day it started', () => {
    const start = at(2026, 5, 10, 9);
    expect(splitSessionByDay({ start, end: start, durationMs: 5 * MINUTE_MS })).toEqual([
      { dayKey: '2026-05-10', start, end: start, durationMs: 5 * MINUTE_MS },
    ]);
  });
});
