/**
 * Parsing and validation for backup files. Kept free of browser APIs so the
 * import flow can be tested without one.
 *
 * Importing overwrites the user's data, so nothing is written until the file
 * has been through here and the preview has been shown.
 */

export const BACKUP_FORMAT = 1;
export const BACKUP_APP = 'breather';

export type BackupError = 'notJson' | 'notBackup' | 'unsupportedVersion' | 'empty';

export interface BackupData {
  app: string;
  format: number;
  exportedAt: number;
  settings?: unknown;
  sessions: unknown[];
  breakEvents: unknown[];
}

export interface BackupPreview {
  sessionCount: number;
  breakEventCount: number;
  hasSettings: boolean;
  exportedAt?: number;
  /** Oldest and newest session day in the file. */
  firstDay?: string;
  lastDay?: string;
}

export type ParseResult =
  { ok: true; data: BackupData; preview: BackupPreview } | { ok: false; error: BackupError };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function dayOf(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const key = value.dayKey;
  return typeof key === 'string' ? key : undefined;
}

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'notJson' };
  }

  if (!isRecord(raw) || raw.app !== BACKUP_APP) return { ok: false, error: 'notBackup' };

  const format = typeof raw.format === 'number' ? raw.format : 0;
  // Reading a file from a newer format would silently drop whatever we
  // don't understand yet.
  if (format > BACKUP_FORMAT) return { ok: false, error: 'unsupportedVersion' };

  const sessions = asArray(raw.sessions).filter(isRecord);
  const breakEvents = asArray(raw.breakEvents).filter(isRecord);
  const hasSettings = isRecord(raw.settings);

  if (sessions.length === 0 && breakEvents.length === 0 && !hasSettings) {
    return { ok: false, error: 'empty' };
  }

  const days = sessions
    .map(dayOf)
    .filter((key): key is string => key != null)
    .sort();

  return {
    ok: true,
    data: {
      app: BACKUP_APP,
      format: BACKUP_FORMAT,
      exportedAt: typeof raw.exportedAt === 'number' ? raw.exportedAt : 0,
      ...(hasSettings ? { settings: raw.settings } : {}),
      sessions,
      breakEvents,
    },
    preview: {
      sessionCount: sessions.length,
      breakEventCount: breakEvents.length,
      hasSettings,
      ...(typeof raw.exportedAt === 'number' ? { exportedAt: raw.exportedAt } : {}),
      ...(days[0] ? { firstDay: days[0] } : {}),
      ...(days.length > 0 ? { lastDay: days[days.length - 1] } : {}),
    },
  };
}

/** e.g. breather-backup-2026-10-09.json */
export function backupFileName(prefix: string, dayKey: string, extension: string): string {
  return `${prefix}-${dayKey}.${extension}`;
}
