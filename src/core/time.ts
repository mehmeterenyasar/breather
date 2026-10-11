/**
 * Time helpers. Nothing here reads the clock, every function takes the epoch
 * milliseconds it needs; the lint config enforces that.
 *
 * `dayKey` is deliberately local: a "day" to the user is a calendar day where
 * they are sitting, not a UTC one. The tests pin a timezone so this stays
 * predictable.
 */

export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const minutesToMs = (min: number): number => Math.round(min * MINUTE_MS);
export const msToMinutes = (ms: number): number => ms / MINUTE_MS;

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Local calendar day as 'YYYY-MM-DD'. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Back the other way: the local midnight that day started at. */
export function dayKeyToTs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0).getTime();
}

/** Start of the local day. Zeroing the time fields survives DST. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Start of the next local day, including 23 and 25 hour DST days. */
export function startOfNextDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Days between two day keys. */
export function daysBetween(aKey: string, bKey: string): number {
  const a = dayKeyToTs(aKey);
  const b = dayKeyToTs(bKey);
  return Math.round((b - a) / DAY_MS);
}

export function weekday(ts: number): number {
  return new Date(ts).getDay();
}

export function isWeekend(ts: number): boolean {
  const w = weekday(ts);
  return w === 0 || w === 6;
}

/** Minutes into the local day. */
export function minutesOfDay(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * mm:ss, or h:mm:ss past the hour. Seconds round up so a fresh 25 minute timer
 * reads 25:00 rather than 24:59.
 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / SECOND_MS));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

/** Badge text: four characters at most, and no words to translate. */
export function formatBadge(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / MINUTE_MS));
  return min > 99 ? '99+' : String(min);
}
