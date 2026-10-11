import Dexie from 'dexie';
import type { Table } from 'dexie';
import { BRAND } from '@/brand';
import type { BreakAction, BreakKind, Mode, Phase } from '@/core/types';

/**
 * The Dexie schema.
 *
 * Years of sessions can pile up here, so every query the app makes has an index
 * behind it: `start` and `dayKey` for ranges, the compound `[dayKey+tagId]` for
 * the per-tag breakdown.
 *
 * `dailyStats` is a materialised rollup rather than real data. The statistics
 * page reads a handful of rows per day instead of scanning thousands of
 * sessions, and if it ever goes wrong it can be rebuilt from the sessions.
 */

export type SessionSource = 'timer' | 'manual' | 'import';

export interface SessionRow {
  id: string;
  mode: Mode;
  phase: Phase;
  start: number;
  end: number;
  /** Net of pauses. */
  durationMs: number;
  pausedMs: number;
  tagId?: string;
  note?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  /** False when it was ended early or skipped. */
  completed: boolean;
  source: SessionSource;
  /** Local day the session *started*. Ones crossing midnight get split later. */
  dayKey: string;
}

export interface BreakEventRow {
  id: string;
  type: BreakKind;
  at: number;
  action: BreakAction;
  durationMs?: number;
  dayKey: string;
}

export interface DailyStatRow {
  dayKey: string;
  /** '' means untagged. */
  tagId: string;
  focusMs: number;
  sessionCount: number;
  pomodoroCount: number;
  /** Focus time spread across the 24 hours of the day. */
  hourMs: number[];
}

class BreatherDatabase extends Dexie {
  sessions!: Table<SessionRow, string>;
  breakEvents!: Table<BreakEventRow, string>;
  dailyStats!: Table<DailyStatRow, [string, string]>;

  constructor() {
    super(BRAND.dbName);

    this.version(1).stores({
      sessions: 'id, start, end, dayKey, tagId, mode, [dayKey+tagId], [start+tagId]',
      breakEvents: 'id, at, type, dayKey, [type+at], [dayKey+type]',
      dailyStats: '[dayKey+tagId], dayKey, tagId',
    });
  }
}

export const db = new BreatherDatabase();
