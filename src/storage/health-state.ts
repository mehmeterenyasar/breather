import { storage } from 'wxt/utils/storage';
import { HEALTH_KINDS, initialHealthStore } from '@/core/health-schedule';
import type { HealthSettings, HealthStore } from '@/core/health-schedule';
import { dayKey } from '@/core/time';
import type { HealthKind } from '@/core/types';
import type { StretchId } from '@/core/stretches';

/**
 * Break counters live in `local`, not `sync`. Like the timer, they belong to the
 * machine you are actually sitting at.
 */

const KEY = 'local:healthState' as const;
const ACTIVE_KEY = 'local:activeBreak' as const;
const LAST_STRETCH_KEY = 'local:lastStretch' as const;

/** The break currently on screen. */
export interface ActiveBreak {
  /** Identifies the window, so a late result can't land on a newer break. */
  id: string;
  /** More than one when breaks were merged into a Pomodoro break. */
  kinds: HealthKind[];
  startedAt: number;
  /** When the host Pomodoro break ends, if this was merged into one. */
  hostPhaseEndsAt?: number;
  stretch?: StretchId;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

function normalizeStore(raw: unknown, settings: HealthSettings, now: number): HealthStore {
  if (!isRecord(raw) || !isRecord(raw.entries)) return initialHealthStore(settings, now);

  const entries = {} as HealthStore['entries'];
  for (const kind of HEALTH_KINDS) {
    const item = isRecord(raw.entries[kind]) ? (raw.entries[kind] as Record<string, unknown>) : {};
    entries[kind] = {
      nextDueAt: num(item.nextDueAt, now + settings[kind].everyMin * 60_000),
      deferred: item.deferred === true,
      snoozedToday: Math.max(0, Math.round(num(item.snoozedToday, 0))),
    };
  }

  return {
    dayKey: typeof raw.dayKey === 'string' ? raw.dayKey : dayKey(now),
    entries,
  };
}

export async function readHealthStore(settings: HealthSettings, now: number): Promise<HealthStore> {
  return normalizeStore(await storage.getItem<unknown>(KEY), settings, now);
}

export async function writeHealthStore(store: HealthStore): Promise<void> {
  await storage.setItem(KEY, store);
}

export async function readActiveBreak(): Promise<ActiveBreak | null> {
  const raw = await storage.getItem<unknown>(ACTIVE_KEY);
  if (!isRecord(raw) || typeof raw.id !== 'string' || !Array.isArray(raw.kinds)) return null;

  const kinds = raw.kinds.filter((kind): kind is HealthKind =>
    HEALTH_KINDS.includes(kind as HealthKind),
  );
  if (kinds.length === 0) return null;

  return {
    id: raw.id,
    kinds,
    startedAt: num(raw.startedAt, 0),
    ...(typeof raw.hostPhaseEndsAt === 'number' ? { hostPhaseEndsAt: raw.hostPhaseEndsAt } : {}),
    ...(typeof raw.stretch === 'string' ? { stretch: raw.stretch as StretchId } : {}),
  };
}

export async function writeActiveBreak(active: ActiveBreak): Promise<void> {
  await storage.setItem(ACTIVE_KEY, active);
}

export async function clearActiveBreak(): Promise<void> {
  await storage.removeItem(ACTIVE_KEY);
}

export function watchActiveBreak(callback: (active: ActiveBreak | null) => void): () => void {
  return storage.watch<unknown>(ACTIVE_KEY, () => {
    void readActiveBreak().then(callback);
  });
}

export async function readLastStretch(): Promise<StretchId | undefined> {
  const value = await storage.getItem<string>(LAST_STRETCH_KEY);
  return value ? (value as StretchId) : undefined;
}

export async function writeLastStretch(id: StretchId): Promise<void> {
  await storage.setItem(LAST_STRETCH_KEY, id);
}
