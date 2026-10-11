import { MINUTE_MS, minutesOfDay, weekday } from './time';

/**
 * Three independent gates stand between a due reminder and the screen: quick
 * mute, working hours, and meeting detection. All three have to be open.
 */

export type MutePreset = '30m' | '1h' | '2h' | 'today';

export interface WorkHoursDayConfig {
  enabled: boolean;
  /** Minutes into the day, so 09:00 is 540. */
  startMin: number;
  endMin: number;
}

export interface WorkHoursConfig {
  enabled: boolean;
  /** Sunday first, matching Date#getDay. */
  days: WorkHoursDayConfig[];
}

/** When the mute lifts. "End of day" means local midnight. */
export function muteUntilFor(preset: MutePreset, now: number): number {
  switch (preset) {
    case '30m':
      return now + 30 * MINUTE_MS;
    case '1h':
      return now + 60 * MINUTE_MS;
    case '2h':
      return now + 120 * MINUTE_MS;
    case 'today': {
      const end = new Date(now);
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      return end.getTime();
    }
  }
}

export function isMuted(muteUntil: number | null, now: number): boolean {
  return muteUntil != null && muteUntil > now;
}

export function muteRemainingMs(muteUntil: number | null, now: number): number {
  if (!isMuted(muteUntil, now)) return 0;
  return (muteUntil as number) - now;
}

/**
 * Overnight shifts (22:00 to 06:00, say) are the awkward case: at 05:00 you are
 * inside yesterday's range, not today's, so both get checked.
 */
export function isWithinWorkHours(config: WorkHoursConfig, now: number): boolean {
  if (!config.enabled) return true;

  const minute = minutesOfDay(now);
  const today = config.days[weekday(now)];

  if (today?.enabled) {
    const overnight = today.endMin <= today.startMin;
    if (overnight ? minute >= today.startMin : minute >= today.startMin && minute < today.endMin) {
      return true;
    }
  }

  // Still inside last night's shift.
  const yesterdayIndex = (weekday(now) + 6) % 7;
  const yesterday = config.days[yesterdayIndex];
  if (yesterday?.enabled && yesterday.endMin <= yesterday.startMin && minute < yesterday.endMin) {
    return true;
  }

  return false;
}

export interface ReminderGate {
  muteUntil: number | null;
  workHours: WorkHoursConfig;
  /** Decided by the caller, since finding out needs the `tabs` permission. */
  meetingActive: boolean;
}

export function remindersAllowed(gate: ReminderGate, now: number): boolean {
  if (isMuted(gate.muteUntil, now)) return false;
  if (gate.meetingActive) return false;
  return isWithinWorkHours(gate.workHours, now);
}

/** Does this URL belong to one of the meeting domains? */
export function isMeetingUrl(url: string, domains: readonly string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  return domains.some((raw) => {
    const domain = raw.trim().toLowerCase();
    if (!domain) return false;
    return host === domain || host.endsWith(`.${domain}`);
  });
}
