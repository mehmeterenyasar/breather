import { i18n } from '@/i18n';
import { useEffect, useRef, useState } from 'preact/hooks';
import { BRAND } from '@/brand';
import { backupFileName, parseBackup } from '@/core/backup-format';
import type { BackupData, BackupError, BackupPreview } from '@/core/backup-format';
import { sessionsToCsv } from '@/core/csv';
import { dayKey } from '@/core/time';
import { db } from '@/db';
import { exportBackup, importBackup, wipeHistory } from '@/db/backup';
import type { ImportMode } from '@/db/backup';
import { dataCounts } from '@/db/queries';
import type { Settings } from '@/storage/schema';

/**
 * Export is a Blob and an `<a download>`; nothing leaves the machine. Import
 * shows a preview first, and writes nothing until the user has seen what it is
 * about to do.
 */

const ERROR_KEY = {
  notJson: 'data.error.notJson',
  notBackup: 'data.error.notBackup',
  unsupportedVersion: 'data.error.unsupportedVersion',
  empty: 'data.error.empty',
} as const satisfies Record<BackupError, string>;

interface Props {
  settings: Settings;
}

export function DataPanel({ settings }: Props) {
  const [counts, setCounts] = useState({ sessions: 0, breakEvents: 0 });
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<{ data: BackupData; preview: BackupPreview } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => void dataCounts().then(setCounts);

  useEffect(refresh, []);

  function download(content: string, fileName: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    // Revoke it, or the blob stays in memory for the life of the page.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportJson() {
    const backup = await exportBackup();
    download(
      JSON.stringify(backup, null, 2),
      backupFileName(BRAND.backupPrefix, dayKey(Date.now()), 'json'),
      'application/json',
    );
  }

  async function exportCsv() {
    const sessions = await db.sessions.orderBy('start').reverse().toArray();
    const tagName = (id: string | undefined) =>
      id ? (settings.tags.find((tag) => tag.id === id)?.name ?? id) : '';

    const csv = sessionsToCsv(
      sessions.map((session) => ({
        start: session.start,
        end: session.end,
        mode: session.mode,
        durationMs: session.durationMs,
        pausedMs: session.pausedMs,
        tagName: tagName(session.tagId),
        ...(session.note == null ? {} : { note: session.note }),
        ...(session.rating == null ? {} : { rating: session.rating }),
        completed: session.completed,
        source: session.source,
      })),
      [
        i18n.t('stats.manual.start'),
        i18n.t('stats.table.date'),
        i18n.t('stats.table.mode'),
        i18n.t('stats.table.duration'),
        i18n.t('phase.paused'),
        i18n.t('stats.table.tag'),
        i18n.t('stats.table.rating'),
        i18n.t('stats.table.note'),
        i18n.t('common.done'),
        'source',
      ],
    );

    download(csv, backupFileName(BRAND.backupPrefix, dayKey(Date.now()), 'csv'), 'text/csv');
  }

  async function chooseFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    setError(null);
    setStatus(null);

    const result = parseBackup(await file.text());
    if (!result.ok) {
      setError(i18n.t(ERROR_KEY[result.error]));
      return;
    }

    setPending({ data: result.data, preview: result.preview });
  }

  async function runImport(mode: ImportMode) {
    if (!pending) return;

    const result = await importBackup(pending.data, mode);
    setPending(null);
    setStatus(
      i18n.t('data.importDone', {
        sessions: String(result.sessions),
        events: String(result.breakEvents),
      }),
    );
    refresh();
  }

  async function wipe() {
    if (!window.confirm(i18n.t('data.wipeConfirm'))) return;
    await wipeHistory();
    setStatus(i18n.t('data.wipeDone'));
    refresh();
  }

  return (
    <section class="panel__body">
      <header class="panel__head">
        <h1 class="panel__title">{i18n.t('data.title')}</h1>
        <span class="panel__meta num">
          {i18n.t('data.counts', {
            sessions: String(counts.sessions),
            events: String(counts.breakEvents),
          })}
        </span>
      </header>

      {status && <p class="notice notice--ok">{status}</p>}
      {error && <p class="notice notice--error">{error}</p>}

      <section class="block">
        <header class="block__head">
          <h2 class="block__title">{i18n.t('data.exportTitle')}</h2>
        </header>
        <p class="muted">{i18n.t('data.exportBody')}</p>
        <div class="row">
          <button type="button" class="btn btn--small btn--solid" onClick={() => void exportJson()}>
            {i18n.t('data.exportJson')}
          </button>
          <button type="button" class="btn btn--small" onClick={() => void exportCsv()}>
            {i18n.t('data.exportCsv')}
          </button>
        </div>
      </section>

      <section class="block">
        <header class="block__head">
          <h2 class="block__title">{i18n.t('data.importTitle')}</h2>
        </header>
        <p class="muted">{i18n.t('data.importBody')}</p>

        {pending ? (
          <div class="preview">
            <ul class="preview__list">
              <li>
                {i18n.t('data.preview.sessions', { count: String(pending.preview.sessionCount) })}
              </li>
              <li>
                {i18n.t('data.preview.events', { count: String(pending.preview.breakEventCount) })}
              </li>
              {pending.preview.hasSettings && <li>{i18n.t('data.preview.settings')}</li>}
              {pending.preview.firstDay && pending.preview.lastDay && (
                <li class="num">
                  {i18n.t('data.preview.range', {
                    from: pending.preview.firstDay,
                    to: pending.preview.lastDay,
                  })}
                </li>
              )}
            </ul>

            <div class="row">
              <button
                type="button"
                class="btn btn--small btn--solid"
                onClick={() => void runImport('merge')}
              >
                {i18n.t('data.importMerge')}
              </button>
              <button
                type="button"
                class="btn btn--small btn--danger"
                onClick={() => void runImport('replace')}
              >
                {i18n.t('data.importReplace')}
              </button>
              <button type="button" class="linkbtn" onClick={() => setPending(null)}>
                {i18n.t('data.importCancel')}
              </button>
            </div>
          </div>
        ) : (
          <div class="row">
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              class="sr-only"
              onChange={(event) => void chooseFile(event)}
            />
            <button type="button" class="btn btn--small" onClick={() => fileInput.current?.click()}>
              {i18n.t('data.importChoose')}
            </button>
          </div>
        )}
      </section>

      <section class="block block--danger">
        <header class="block__head">
          <h2 class="block__title">{i18n.t('data.wipeTitle')}</h2>
        </header>
        <p class="muted">{i18n.t('data.wipeBody')}</p>
        <div class="row">
          <button type="button" class="btn btn--small btn--danger" onClick={() => void wipe()}>
            {i18n.t('data.wipeAction')}
          </button>
        </div>
      </section>

      {import.meta.env.DEV && <DevTools onChanged={refresh} />}
    </section>
  );
}

/** Development only; `import.meta.env.DEV` removes this from a release build. */
function DevTools({ onChanged }: { onChanged: () => void }) {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: 'seed' | 'clear') {
    setBusy(true);
    try {
      const module = await import('@/db/seed.dev');
      if (action === 'seed') {
        const outcome = await module.seedFakeData();
        setResult(
          i18n.t('dev.result', {
            sessions: String(outcome.sessions),
            days: String(outcome.days),
            ms: String(outcome.elapsedMs),
          }),
        );
      } else {
        const removed = await module.clearFakeData();
        setResult(String(removed));
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section class="block">
      <header class="block__head">
        <h2 class="block__title">{i18n.t('dev.title')}</h2>
      </header>
      <p class="muted">{i18n.t('dev.body')}</p>
      <div class="row">
        <button
          type="button"
          class="btn btn--small"
          disabled={busy}
          onClick={() => void run('seed')}
        >
          {i18n.t('dev.seed')}
        </button>
        <button
          type="button"
          class="btn btn--small"
          disabled={busy}
          onClick={() => void run('clear')}
        >
          {i18n.t('dev.clear')}
        </button>
      </div>
      {result && <p class="notice notice--ok num">{result}</p>}
    </section>
  );
}
