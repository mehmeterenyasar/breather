import { describe, expect, it } from 'vitest';
import {
  isMeetingUrl,
  isMuted,
  isWithinWorkHours,
  muteRemainingMs,
  muteUntilFor,
  remindersAllowed,
} from '@/core/dnd';
import type { WorkHoursConfig } from '@/core/dnd';
import { MINUTE_MS } from '@/core/time';
import { DEFAULT_SETTINGS } from '@/storage/schema';

// The suite runs with TZ=Europe/Berlin; see vitest.config.ts.
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0).getTime();

/** 2 March 2026 was a Monday. */
const MONDAY_10 = at(2026, 3, 2, 10);

describe('quick mute', () => {
  it('each preset lasts what it says', () => {
    expect(muteUntilFor('30m', MONDAY_10)).toBe(MONDAY_10 + 30 * MINUTE_MS);
    expect(muteUntilFor('1h', MONDAY_10)).toBe(MONDAY_10 + 60 * MINUTE_MS);
    expect(muteUntilFor('2h', MONDAY_10)).toBe(MONDAY_10 + 120 * MINUTE_MS);
  });

  it('"rest of today" means local midnight', () => {
    expect(muteUntilFor('today', MONDAY_10)).toBe(at(2026, 3, 3, 0));
  });

  it('expires on its own', () => {
    const until = muteUntilFor('30m', MONDAY_10);

    expect(isMuted(until, MONDAY_10 + 29 * MINUTE_MS)).toBe(true);
    expect(isMuted(until, until)).toBe(false);
    expect(isMuted(null, MONDAY_10)).toBe(false);
  });

  it('reports the time left', () => {
    const until = MONDAY_10 + 30 * MINUTE_MS;
    expect(muteRemainingMs(until, MONDAY_10)).toBe(30 * MINUTE_MS);
    expect(muteRemainingMs(until, until + 1000)).toBe(0);
    expect(muteRemainingMs(null, MONDAY_10)).toBe(0);
  });
});

describe('working hours', () => {
  const workHours: WorkHoursConfig = {
    enabled: true,
    days: DEFAULT_SETTINGS.dnd.workHours.days,
  };

  it('allows everything while switched off', () => {
    expect(isWithinWorkHours({ ...workHours, enabled: false }, at(2026, 3, 2, 3))).toBe(true);
  });

  it('counts 09:00 to 18:00 on a Monday as inside', () => {
    expect(isWithinWorkHours(workHours, at(2026, 3, 2, 8, 59))).toBe(false);
    expect(isWithinWorkHours(workHours, at(2026, 3, 2, 9))).toBe(true);
    expect(isWithinWorkHours(workHours, at(2026, 3, 2, 17, 59))).toBe(true);
    expect(isWithinWorkHours(workHours, at(2026, 3, 2, 18))).toBe(false);
  });

  it('says no on a day that is switched off', () => {
    // Saturday 7 March 2026, which is off by default.
    expect(isWithinWorkHours(workHours, at(2026, 3, 7, 12))).toBe(false);
  });

  it('handles a shift that runs past midnight', () => {
    const nightShift: WorkHoursConfig = {
      enabled: true,
      days: DEFAULT_SETTINGS.dnd.workHours.days.map(() => ({
        enabled: true,
        startMin: 22 * 60,
        endMin: 6 * 60,
      })),
    };

    expect(isWithinWorkHours(nightShift, at(2026, 3, 2, 23))).toBe(true);
    // 05:00 the next morning, still yesterday's shift.
    expect(isWithinWorkHours(nightShift, at(2026, 3, 3, 5))).toBe(true);
    expect(isWithinWorkHours(nightShift, at(2026, 3, 3, 7))).toBe(false);
  });

  it('does not carry a night shift over from a day that is off', () => {
    const days = DEFAULT_SETTINGS.dnd.workHours.days.map((_, index) => ({
      enabled: index !== 1, // Monday off
      startMin: 22 * 60,
      endMin: 6 * 60,
    }));

    // Tuesday 05:00 would continue Monday night, but Monday is off.
    expect(isWithinWorkHours({ enabled: true, days }, at(2026, 3, 3, 5))).toBe(false);
  });
});

describe('the reminder gates', () => {
  const workHours: WorkHoursConfig = { enabled: true, days: DEFAULT_SETTINGS.dnd.workHours.days };

  it('allows a reminder when all three are open', () => {
    expect(remindersAllowed({ muteUntil: null, workHours, meetingActive: false }, MONDAY_10)).toBe(
      true,
    );
  });

  it('blocks everything while muted', () => {
    expect(
      remindersAllowed(
        { muteUntil: MONDAY_10 + MINUTE_MS, workHours, meetingActive: false },
        MONDAY_10,
      ),
    ).toBe(false);
  });

  it('blocks reminders during a meeting', () => {
    expect(remindersAllowed({ muteUntil: null, workHours, meetingActive: true }, MONDAY_10)).toBe(
      false,
    );
  });

  it('blocks reminders outside working hours', () => {
    expect(
      remindersAllowed({ muteUntil: null, workHours, meetingActive: false }, at(2026, 3, 2, 20)),
    ).toBe(false);
  });
});

describe('matching meeting domains', () => {
  const domains = DEFAULT_SETTINGS.dnd.meetings.domains;

  it('matches the usual meeting URLs', () => {
    expect(isMeetingUrl('https://meet.google.com/abc-defg-hij', domains)).toBe(true);
    expect(isMeetingUrl('https://teams.microsoft.com/l/meetup', domains)).toBe(true);
  });

  it('matches subdomains too', () => {
    expect(isMeetingUrl('https://company.zoom.us/j/123', domains)).toBe(true);
  });

  it('is not fooled by a lookalike domain', () => {
    expect(isMeetingUrl('https://notzoom.us/j/123', domains)).toBe(false);
    expect(isMeetingUrl('https://meet.google.com.evil.test/', domains)).toBe(false);
  });

  it('ignores unrelated and malformed URLs', () => {
    expect(isMeetingUrl('https://example.com', domains)).toBe(false);
    expect(isMeetingUrl('bozuk-url', domains)).toBe(false);
    expect(isMeetingUrl('https://meet.google.com', [])).toBe(false);
  });

  it('ignores case and stray whitespace', () => {
    expect(isMeetingUrl('https://MEET.google.com/x', ['  Meet.Google.com '])).toBe(true);
  });
});
