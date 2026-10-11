import { describe, expect, it } from 'vitest';
import { CSV_BOM, escapeCsvField, sessionsToCsv, toCsv } from '@/core/csv';
import { BACKUP_APP, BACKUP_FORMAT, backupFileName, parseBackup } from '@/core/backup-format';
import { MINUTE_MS } from '@/core/time';
import { distributeByHour } from '@/core/day-split';

describe('CSV escaping', () => {
  it('leaves plain text alone', () => {
    expect(escapeCsvField('Kod')).toBe('Kod');
    expect(escapeCsvField(42)).toBe('42');
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('quotes fields containing a comma, a quote or a newline', () => {
    expect(escapeCsvField('Code, study')).toBe('"Code, study"');
    expect(escapeCsvField('two\nlines')).toBe('"two\nlines"');
    expect(escapeCsvField('that went "fine"')).toBe('"that went ""fine"""');
  });

  it('writes a BOM, or Excel mangles the accents', () => {
    const csv = toCsv(['Durée'], [['25 min']]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toContain('Durée');
  });

  it('separates rows with CRLF', () => {
    expect(toCsv(['a', 'b'], [['1', '2']])).toBe(`${CSV_BOM}a,b\r\n1,2\r\n`);
  });

  it('writes the expected columns for a session', () => {
    const csv = sessionsToCsv(
      [
        {
          start: new Date(2026, 2, 2, 9, 0).getTime(),
          end: new Date(2026, 2, 2, 9, 25).getTime(),
          mode: 'pomodoro',
          durationMs: 25 * MINUTE_MS,
          pausedMs: 0,
          tagName: 'Kod, ders',
          note: 'derin "odak"',
          rating: 4,
          completed: true,
          source: 'timer',
        },
      ],
      [
        'start',
        'end',
        'mode',
        'duration',
        'paused',
        'tag',
        'rating',
        'note',
        'completed',
        'source',
      ],
    );

    const lines = csv.replace(CSV_BOM, '').trim().split('\r\n');
    expect(lines[1]).toBe(
      '2026-03-02 09:00,2026-03-02 09:25,pomodoro,25,0,"Kod, ders",4,"derin ""odak""",1,timer',
    );
  });
});

describe('reading a backup file', () => {
  const valid = JSON.stringify({
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt: 1_800_000_000_000,
    settings: { version: 1 },
    sessions: [
      { id: 'a', start: 1, end: 2, dayKey: '2026-03-02' },
      { id: 'b', start: 3, end: 4, dayKey: '2026-03-05' },
    ],
    breakEvents: [{ id: 'e', at: 5 }],
  });

  it('produces a preview for a valid backup', () => {
    const result = parseBackup(valid);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.preview).toMatchObject({
      sessionCount: 2,
      breakEventCount: 1,
      hasSettings: true,
      firstDay: '2026-03-02',
      lastDay: '2026-03-05',
    });
  });

  it('rejects a file that is not JSON', () => {
    expect(parseBackup('this is not a backup')).toEqual({ ok: false, error: 'notJson' });
  });

  it("rejects another application's JSON", () => {
    expect(parseBackup('{"app":"baska"}')).toEqual({ ok: false, error: 'notBackup' });
    expect(parseBackup('[]')).toEqual({ ok: false, error: 'notBackup' });
  });

  it('rejects a backup from a newer version', () => {
    const future = JSON.stringify({ app: BACKUP_APP, format: 99, sessions: [], breakEvents: [] });
    expect(parseBackup(future)).toEqual({ ok: false, error: 'unsupportedVersion' });
  });

  it('rejects an empty backup', () => {
    const empty = JSON.stringify({ app: BACKUP_APP, format: 1, sessions: [], breakEvents: [] });
    expect(parseBackup(empty)).toEqual({ ok: false, error: 'empty' });
  });

  it('drops the rows that do not make sense', () => {
    const messy = JSON.stringify({
      app: BACKUP_APP,
      format: 1,
      sessions: [{ id: 'a', start: 1, end: 2 }, 'nonsense', 42, null],
      breakEvents: 'not an array',
    });

    const result = parseBackup(messy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.breakEvents).toEqual([]);
  });

  it('puts the day in the file name', () => {
    expect(backupFileName('breather-backup', '2026-03-02', 'json')).toBe(
      'breather-backup-2026-03-02.json',
    );
  });
});

describe('spreading a session across hours', () => {
  const at = (h: number, m = 0) => new Date(2026, 2, 2, h, m, 0, 0).getTime();

  it('puts a session inside one hour into one bucket', () => {
    const hours = distributeByHour(at(9, 10), at(9, 40), 30 * MINUTE_MS);

    expect(hours[9]).toBe(30 * MINUTE_MS);
    expect(hours.reduce((sum, value) => sum + value, 0)).toBe(30 * MINUTE_MS);
  });

  it('splits a session that crosses the hour', () => {
    const hours = distributeByHour(at(9, 40), at(10, 20), 40 * MINUTE_MS);

    expect(hours[9]).toBe(20 * MINUTE_MS);
    expect(hours[10]).toBe(20 * MINUTE_MS);
  });

  it('shares the net time proportionally when there were pauses', () => {
    // Two hours on the wall clock, 60 minutes of actual work.
    const hours = distributeByHour(at(9), at(11), 60 * MINUTE_MS);

    expect(hours[9]).toBe(30 * MINUTE_MS);
    expect(hours[10]).toBe(30 * MINUTE_MS);
  });

  it('always adds up to the net duration', () => {
    const duration = 3_333_333;
    const hours = distributeByHour(at(8, 17), at(12, 43), duration);

    expect(hours.reduce((sum, value) => sum + value, 0)).toBe(duration);
    expect(hours).toHaveLength(24);
  });

  it('gives an empty result for no duration', () => {
    expect(distributeByHour(at(9), at(10), 0).every((value) => value === 0)).toBe(true);
  });
});
