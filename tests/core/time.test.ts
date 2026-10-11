import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  HOUR_MS,
  addDays,
  dayKey,
  dayKeyToTs,
  daysBetween,
  formatBadge,
  formatClock,
  isWeekend,
  minutesOfDay,
  minutesToMs,
  startOfDay,
  startOfNextDay,
  weekday,
} from '@/core/time';

// The suite runs with TZ=Europe/Berlin; see vitest.config.ts.

describe('day keys', () => {
  it('follow the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59, 59).getTime())).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 0, 6, 0, 0, 1).getTime())).toBe('2026-01-06');
    expect(dayKey(new Date(2026, 9, 9, 12, 0, 0).getTime())).toBe('2026-10-09');
  });

  it('round-trip to a timestamp and back', () => {
    const ts = new Date(2026, 4, 17, 14, 30).getTime();
    expect(dayKeyToTs(dayKey(ts))).toBe(startOfDay(ts));
  });

  it('give the number of days between two of them', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-01-10', '2026-01-10')).toBe(0);
    expect(daysBetween('2026-01-10', '2026-01-01')).toBe(-9);
  });

  it('report the weekday and the minute of the day', () => {
    const saturday = new Date(2026, 9, 10, 8, 15).getTime();
    const monday = new Date(2026, 9, 12, 8, 15).getTime();

    expect(weekday(saturday)).toBe(6);
    expect(isWeekend(saturday)).toBe(true);
    expect(isWeekend(monday)).toBe(false);
    expect(minutesOfDay(monday)).toBe(8 * 60 + 15);
  });
});

describe('DST transitions', () => {
  it('make the spring day 23 hours without moving its start', () => {
    // 29 March 2026: Europe moves 02:00 to 03:00.
    const during = new Date(2026, 2, 29, 12, 0).getTime();
    const start = startOfDay(during);
    const next = startOfNextDay(during);

    expect(dayKey(start)).toBe('2026-03-29');
    expect(dayKey(next)).toBe('2026-03-30');
    expect(next - start).toBe(23 * HOUR_MS);
  });

  it('make the autumn day 25 hours', () => {
    // 25 October 2026: the clocks go back from 03:00 to 02:00.
    const during = new Date(2026, 9, 25, 12, 0).getTime();
    expect(startOfNextDay(during) - startOfDay(during)).toBe(25 * HOUR_MS);
  });

  it('are why addDays adds a calendar day and not 24 hours', () => {
    const before = new Date(2026, 2, 28, 12, 0).getTime();
    const after = addDays(before, 1);

    expect(dayKey(after)).toBe('2026-03-29');
    expect(after - before).toBe(23 * HOUR_MS);
    expect(DAY_MS).toBe(24 * HOUR_MS);
  });
});

describe('formatting', () => {
  it('gives mm:ss, and h:mm:ss past the hour', () => {
    expect(formatClock(25 * 60 * 1000)).toBe('25:00');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-5000)).toBe('00:00');
    expect(formatClock(59_000)).toBe('00:59');
    expect(formatClock(60 * 60 * 1000)).toBe('1:00:00');
    expect(formatClock(90 * 60 * 1000 + 5000)).toBe('1:30:05');
  });

  it('rounds seconds up so a fresh timer reads a whole minute', () => {
    expect(formatClock(minutesToMs(25) - 1)).toBe('25:00');
    expect(formatClock(1)).toBe('00:01');
  });

  it('keeps the badge to four characters', () => {
    expect(formatBadge(minutesToMs(25))).toBe('25');
    expect(formatBadge(1)).toBe('1');
    expect(formatBadge(0)).toBe('0');
    expect(formatBadge(minutesToMs(100))).toBe('99+');
  });
});
