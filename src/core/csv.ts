/**
 * CSV export. Escaping follows RFC 4180: fields containing a comma, a double
 * quote or a line break get quoted, and inner quotes are doubled. Rows end with
 * CRLF because that is what Excel expects.
 */

const DELIMITER = ',';
const NEWLINE = '\r\n';

/** Without the BOM, Excel guesses the encoding and mangles accented text. */
export const CSV_BOM = '﻿';

export function escapeCsvField(value: unknown): string {
  if (value == null) return '';

  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;

  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsvRow(fields: readonly unknown[]): string {
  return fields.map(escapeCsvField).join(DELIMITER);
}

export function toCsv(header: readonly string[], rows: ReadonlyArray<readonly unknown[]>): string {
  return CSV_BOM + [toCsvRow(header), ...rows.map(toCsvRow)].join(NEWLINE) + NEWLINE;
}

export interface SessionCsvInput {
  start: number;
  end: number;
  mode: string;
  durationMs: number;
  pausedMs: number;
  tagName: string;
  note?: string;
  rating?: number;
  completed: boolean;
  source: string;
}

/** Local time as 2026-03-02 09:00, which spreadsheets parse without help. */
function localStamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const round1 = (ms: number) => Math.round(ms / 6000) / 10;

export function sessionsToCsv(
  sessions: readonly SessionCsvInput[],
  header: readonly string[],
): string {
  return toCsv(
    header,
    sessions.map((session) => [
      localStamp(session.start),
      localStamp(session.end),
      session.mode,
      round1(session.durationMs),
      round1(session.pausedMs),
      session.tagName,
      session.rating ?? '',
      session.note ?? '',
      session.completed ? 1 : 0,
      session.source,
    ]),
  );
}
