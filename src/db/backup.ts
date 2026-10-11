import { BACKUP_APP, BACKUP_FORMAT } from '@/core/backup-format';
import type { BackupData } from '@/core/backup-format';
import { dayKey } from '@/core/time';
import { readSettings, writeSettings } from '@/storage/settings';
import { migrateSettings } from '@/storage/schema';
import { db } from './index';
import type { BreakEventRow, SessionRow } from './index';
import { rebuildAllStats } from './daily-stats';

/**
 * Export gives you either a complete JSON backup (settings, sessions, break
 * events) or a CSV of just the sessions, for a spreadsheet.
 *
 * Import either merges, updating rows that share an id and adding the rest, or
 * replaces everything. Both rebuild the rollup table afterwards.
 */

export async function exportBackup(): Promise<BackupData & { settings: unknown }> {
  const [settings, sessions, breakEvents] = await Promise.all([
    readSettings(),
    db.sessions.toArray(),
    db.breakEvents.toArray(),
  ]);

  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt: Date.now(),
    settings,
    sessions,
    breakEvents,
  };
}

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  sessions: number;
  breakEvents: number;
  settingsRestored: boolean;
  days: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** Anything that doesn't make sense as a session is thrown away, not guessed at. */
function toSession(raw: unknown): SessionRow | null {
  if (!isRecord(raw)) return null;

  const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
  const start = num(raw.start, -1);
  const end = num(raw.end, -1);
  if (!id || start < 0 || end < start) return null;

  return {
    id,
    mode: (raw.mode as SessionRow['mode']) ?? 'pomodoro',
    phase: (raw.phase as SessionRow['phase']) ?? 'focus',
    start,
    end,
    durationMs: Math.max(0, num(raw.durationMs, end - start)),
    pausedMs: Math.max(0, num(raw.pausedMs)),
    completed: raw.completed !== false,
    source: 'import',
    dayKey: typeof raw.dayKey === 'string' ? raw.dayKey : dayKey(start),
    ...(typeof raw.tagId === 'string' ? { tagId: raw.tagId } : {}),
    ...(typeof raw.note === 'string' ? { note: raw.note } : {}),
    ...(typeof raw.rating === 'number' ? { rating: raw.rating as SessionRow['rating'] } : {}),
  };
}

function toBreakEvent(raw: unknown): BreakEventRow | null {
  if (!isRecord(raw)) return null;

  const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
  const at = num(raw.at, -1);
  if (!id || at < 0) return null;

  return {
    id,
    type: (raw.type as BreakEventRow['type']) ?? 'eye',
    at,
    action: (raw.action as BreakEventRow['action']) ?? 'offered',
    dayKey: typeof raw.dayKey === 'string' ? raw.dayKey : dayKey(at),
    ...(typeof raw.durationMs === 'number' ? { durationMs: raw.durationMs } : {}),
  };
}

export async function importBackup(data: BackupData, mode: ImportMode): Promise<ImportResult> {
  const sessions = data.sessions.map(toSession).filter((row): row is SessionRow => row != null);
  const events = data.breakEvents
    .map(toBreakEvent)
    .filter((row): row is BreakEventRow => row != null);

  await db.transaction('rw', db.sessions, db.breakEvents, db.dailyStats, async () => {
    if (mode === 'replace') {
      await db.sessions.clear();
      await db.breakEvents.clear();
      await db.dailyStats.clear();
    }

    if (sessions.length > 0) await db.sessions.bulkPut(sessions);
    if (events.length > 0) await db.breakEvents.bulkPut(events);
  });

  let settingsRestored = false;
  if (data.settings != null) {
    await writeSettings(migrateSettings(data.settings));
    settingsRestored = true;
  }

  const days = await rebuildAllStats();

  return { sessions: sessions.length, breakEvents: events.length, settingsRestored, days };
}

/** Wipes the history but keeps the settings; the confirm dialog says so. */
export async function wipeHistory(): Promise<void> {
  await db.transaction('rw', db.sessions, db.breakEvents, db.dailyStats, async () => {
    await db.sessions.clear();
    await db.breakEvents.clear();
    await db.dailyStats.clear();
  });
}
