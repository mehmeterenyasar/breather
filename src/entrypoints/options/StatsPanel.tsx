import { i18n } from '@/i18n';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { RANGE_IDS, normalizeRange, resolveRange, trailingYear } from '@/core/ranges';
import type { RangeId } from '@/core/ranges';
import {
  dailySeries,
  summarize,
  tagTotals,
  tallyBreaks,
  streaks,
  weekdayHourMatrix,
} from '@/core/stats';
import { MINUTE_MS, dayKey, dayKeyToTs, minutesToMs } from '@/core/time';
import type { BreakKind } from '@/core/types';
import { aggregatesForRange, breakEventsForRange, sessionsForRange } from '@/db/queries';
import type { SessionRow } from '@/db';
import { addManualSession, deleteSession } from '@/db/sessions';
import { formatDurationShort, modeLabel } from '@/format';
import type { Settings } from '@/storage/schema';
import { HourHeatmap, YearHeatmap } from '@/ui/charts/Heatmaps';
import { StackedBars } from '@/ui/charts/StackedBars';
import { TagBars } from '@/ui/charts/TagBars';

/**
 * Statistics.
 *
 * The cards and charts read the daily rollup, a few rows per day. Raw sessions
 * are fetched only for the list at the bottom, and only a page at a time. That
 * is what keeps the page instant with five thousand sessions behind it.
 */

const PAGE_SIZE = 25;

const RANGE_KEY = {
  today: 'stats.range.today',
  week: 'stats.range.week',
  month: 'stats.range.month',
  last30: 'stats.range.last30',
  year: 'stats.range.year',
  custom: 'stats.range.custom',
} as const satisfies Record<RangeId, string>;

const BREAK_KEY = {
  eye: 'break.eye.title',
  breath: 'break.breath.title',
  posture: 'break.posture.title',
  water: 'break.water.title',
  pomodoro: 'phase.shortBreak',
} as const satisfies Record<BreakKind, string>;

interface Props {
  settings: Settings;
}

export function StatsPanel({ settings }: Props) {
  const [rangeId, setRangeId] = useState<RangeId>('last30');
  const [custom, setCustom] = useState(() => {
    const today = dayKey(Date.now());
    return { fromKey: today, toKey: today };
  });
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  const range =
    rangeId === 'custom'
      ? normalizeRange(custom.fromKey, custom.toKey)
      : resolveRange(rangeId, Date.now());

  const [data, setData] = useState<StatsData | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const goalMs = minutesToMs(settings.goals.dailyFocusMin);
  const countWeekends = settings.goals.countWeekends;

  useEffect(() => {
    let alive = true;
    void loadStats({
      fromKey: range.fromKey,
      toKey: range.toKey,
      tagId: tagFilter,
      limit: visible,
      goalMs,
      countWeekends,
    }).then((result) => {
      if (alive) setData(result);
    });
    return () => {
      alive = false;
    };
  }, [range.fromKey, range.toKey, tagFilter, visible, reloadToken, goalMs, countWeekends]);

  const reload = () => setReloadToken((value) => value + 1);
  const dayNames = useMemo(() => weekdayNames(), []);

  if (!data) return <section class="panel__body" aria-busy="true" />;

  const hasData = data.summary.sessionCount > 0;

  return (
    <section class="panel__body">
      <header class="panel__head">
        <h1 class="panel__title">{i18n.t('options.nav.stats')}</h1>
        {import.meta.env.DEV && data.elapsedMs != null && (
          <span
            class="panel__meta num"
            title={i18n.t('dev.measure', { ms: String(data.elapsedMs) })}
          >
            {data.elapsedMs} ms
          </span>
        )}
      </header>

      <div class="filters">
        <div class="segmented" role="group" aria-label={i18n.t('options.nav.stats')}>
          {RANGE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              class={id === rangeId ? 'segmented__item segmented__item--on' : 'segmented__item'}
              aria-pressed={id === rangeId}
              onClick={() => {
                setRangeId(id);
                setVisible(PAGE_SIZE);
              }}
            >
              {i18n.t(RANGE_KEY[id])}
            </button>
          ))}
        </div>

        {rangeId === 'custom' && (
          <div class="filters__custom">
            <input
              type="date"
              class="field"
              value={custom.fromKey}
              onInput={(event) =>
                setCustom((value) => ({ ...value, fromKey: event.currentTarget.value }))
              }
            />
            <input
              type="date"
              class="field"
              value={custom.toKey}
              onInput={(event) =>
                setCustom((value) => ({ ...value, toKey: event.currentTarget.value }))
              }
            />
          </div>
        )}

        <select
          class="field"
          value={tagFilter ?? 'all'}
          aria-label={i18n.t('stats.allTags')}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setTagFilter(value === 'all' ? undefined : value);
            setVisible(PAGE_SIZE);
          }}
        >
          <option value="all">{i18n.t('stats.allTags')}</option>
          <option value="">{i18n.t('common.untagged')}</option>
          {settings.tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </div>

      {!hasData ? (
        <div class="empty">
          <p class="empty__title">{i18n.t('stats.empty.title')}</p>
          <p class="empty__body">{i18n.t('stats.empty.body')}</p>
        </div>
      ) : (
        <>
          <ul class="summary">
            <Metric
              label={i18n.t('stats.summary.focus')}
              value={formatDurationShort(data.summary.focusMs)}
            />
            <Metric
              label={i18n.t('stats.summary.sessions')}
              value={String(data.summary.sessionCount)}
            />
            <Metric
              label={i18n.t('stats.summary.average')}
              value={formatDurationShort(data.summary.avgSessionMs)}
            />
            <Metric
              label={i18n.t('stats.summary.pomodoros')}
              value={String(data.summary.pomodoroCount)}
            />
            <Metric
              label={i18n.t('stats.summary.streakCurrent')}
              value={i18n.t('stats.summary.days', { count: String(data.streak.current) })}
            />
            <Metric
              label={i18n.t('stats.summary.streak')}
              value={i18n.t('stats.summary.days', { count: String(data.streak.longest) })}
            />
          </ul>

          <Card
            title={i18n.t('stats.chart.daily')}
            note={i18n.t('stats.goalLine', { duration: formatDurationShort(goalMs) })}
          >
            <StackedBars
              points={data.points}
              tags={settings.tags}
              goalMs={goalMs}
              formatMs={formatDurationShort}
              formatDay={formatDay}
              label={i18n.t('stats.chart.daily')}
            />
          </Card>

          <Card title={i18n.t('stats.chart.year')}>
            <YearHeatmap
              points={data.yearPoints}
              formatMs={formatDurationShort}
              formatDay={formatDay}
              label={i18n.t('stats.chart.year')}
            />
          </Card>

          <Card title={i18n.t('stats.chart.hours')}>
            <HourHeatmap
              matrix={data.matrix}
              dayNames={dayNames}
              formatMs={formatDurationShort}
              label={i18n.t('stats.chart.hours')}
            />
          </Card>

          <Card title={i18n.t('stats.chart.tags')}>
            <TagBars
              totals={data.tagTotals}
              tags={settings.tags}
              untaggedLabel={i18n.t('common.untagged')}
              formatMs={formatDurationShort}
            />
          </Card>

          <Card title={i18n.t('stats.chart.breaks')}>
            <BreakTable tally={data.breaks} />
          </Card>

          <Card title={i18n.t('stats.chart.sessions')}>
            <SessionTable
              rows={data.sessions}
              total={data.sessionTotal}
              settings={settings}
              onChanged={reload}
              onShowMore={() => setVisible((value) => value + PAGE_SIZE)}
            />
          </Card>
        </>
      )}
    </section>
  );
}

interface StatsData {
  summary: ReturnType<typeof summarize>;
  points: ReturnType<typeof dailySeries>;
  yearPoints: ReturnType<typeof dailySeries>;
  matrix: number[][];
  tagTotals: ReturnType<typeof tagTotals>;
  streak: ReturnType<typeof streaks>;
  breaks: ReturnType<typeof tallyBreaks>;
  sessions: SessionRow[];
  sessionTotal: number;
  elapsedMs?: number;
}

async function loadStats(options: {
  fromKey: string;
  toKey: string;
  tagId: string | undefined;
  limit: number;
  goalMs: number;
  countWeekends: boolean;
}): Promise<StatsData> {
  const { fromKey, toKey, tagId, limit } = options;
  const startedAt = performance.now();
  const now = Date.now();
  const year = trailingYear(now);

  const filter = tagId === undefined ? { fromKey, toKey } : { fromKey, toKey, tagId };

  const [rows, yearRows, events, page] = await Promise.all([
    aggregatesForRange(filter),
    aggregatesForRange(tagId === undefined ? year : { ...year, tagId }),
    breakEventsForRange({ fromKey, toKey }),
    sessionsForRange(filter, { offset: 0, limit }),
  ]);

  const points = dailySeries(rows, fromKey, toKey);

  return {
    summary: summarize(rows),
    points,
    yearPoints: dailySeries(yearRows, year.fromKey, year.toKey),
    matrix: weekdayHourMatrix(rows),
    tagTotals: tagTotals(rows),
    streak: streaks(points, options.goalMs, {
      countWeekends: options.countWeekends,
      todayKey: dayKey(now),
    }),
    breaks: tallyBreaks(events),
    sessions: page.rows,
    sessionTotal: page.total,
    elapsedMs: Math.round(performance.now() - startedAt),
  };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <li class="summary__item">
      <span class="summary__value num">{value}</span>
      <span class="summary__label">{label}</span>
    </li>
  );
}

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ComponentChildren;
}) {
  return (
    <section class="block">
      <header class="block__head">
        <h2 class="block__title">{title}</h2>
        {note && <span class="block__note">{note}</span>}
      </header>
      {children}
    </section>
  );
}

function BreakTable({ tally }: { tally: ReturnType<typeof tallyBreaks> }) {
  const kinds = Object.keys(tally) as BreakKind[];
  if (kinds.length === 0) return <p class="muted">—</p>;

  return (
    <table class="table">
      <thead>
        <tr>
          <th>{i18n.t('stats.breaks.kind')}</th>
          <th class="num">{i18n.t('stats.breaks.offered')}</th>
          <th class="num">{i18n.t('stats.breaks.taken')}</th>
          <th class="num">{i18n.t('stats.breaks.skipped')}</th>
          <th class="num">{i18n.t('stats.breaks.snoozed')}</th>
          <th class="num">{i18n.t('stats.breaks.auto')}</th>
        </tr>
      </thead>
      <tbody>
        {kinds.map((kind) => {
          const row = tally[kind]!;
          return (
            <tr key={kind}>
              <td>{i18n.t(BREAK_KEY[kind] ?? 'stats.breaks.kind')}</td>
              <td class="num">{row.offered}</td>
              <td class="num">{row.taken}</td>
              <td class="num">{row.skipped}</td>
              <td class="num">{row.snoozed}</td>
              <td class="num">{row.auto}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SessionTable({
  rows,
  total,
  settings,
  onChanged,
  onShowMore,
}: {
  rows: SessionRow[];
  total: number;
  settings: Settings;
  onChanged: () => void;
  onShowMore: () => void;
}) {
  const [adding, setAdding] = useState(false);

  const tagName = (id: string | undefined) =>
    id ? (settings.tags.find((tag) => tag.id === id)?.name ?? id) : i18n.t('common.untagged');

  return (
    <>
      <table class="table">
        <thead>
          <tr>
            <th>{i18n.t('stats.table.date')}</th>
            <th>{i18n.t('stats.table.mode')}</th>
            <th>{i18n.t('stats.table.tag')}</th>
            <th class="num">{i18n.t('stats.table.duration')}</th>
            <th class="num">{i18n.t('stats.table.rating')}</th>
            <th>{i18n.t('stats.table.note')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td class="num">{formatStamp(row.start)}</td>
              <td>{modeLabel(row.mode)}</td>
              <td>{tagName(row.tagId)}</td>
              <td class="num">{formatDurationShort(row.durationMs)}</td>
              <td class="num">{row.rating ? '★'.repeat(row.rating) : ''}</td>
              <td class="table__note" title={row.note}>
                {row.note ?? ''}
              </td>
              <td>
                <button
                  type="button"
                  class="linkbtn linkbtn--danger"
                  onClick={() => {
                    if (!window.confirm(i18n.t('stats.table.deleteConfirm'))) return;
                    void deleteSession(row.id).then(onChanged);
                  }}
                >
                  {i18n.t('stats.table.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div class="block__foot">
        <span class="muted num">
          {i18n.t('stats.table.count', { shown: String(rows.length), total: String(total) })}
        </span>

        {rows.length < total && (
          <button type="button" class="linkbtn" onClick={onShowMore}>
            {i18n.t('stats.table.showMore')}
          </button>
        )}

        <button type="button" class="linkbtn" onClick={() => setAdding((value) => !value)}>
          {i18n.t('stats.table.addManual')}
        </button>
      </div>

      {adding && (
        <ManualForm
          settings={settings}
          onDone={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function ManualForm({ settings, onDone }: { settings: Settings; onDone: () => void }) {
  const [start, setStart] = useState(() => toLocalInput(Date.now() - 60 * MINUTE_MS));
  const [minutes, setMinutes] = useState(25);
  const [tagId, setTagId] = useState('');

  function submit(event: Event) {
    event.preventDefault();
    const startMs = new Date(start).getTime();
    if (!Number.isFinite(startMs)) return;

    void addManualSession({
      start: startMs,
      end: startMs + minutesToMs(minutes),
      mode: 'stopwatch',
      ...(tagId ? { tagId } : {}),
    }).then(onDone);
  }

  return (
    <form class="manual" onSubmit={submit}>
      <label class="manual__field">
        <span>{i18n.t('stats.manual.start')}</span>
        <input
          class="field"
          type="datetime-local"
          value={start}
          onInput={(event) => setStart(event.currentTarget.value)}
        />
      </label>

      <label class="manual__field">
        <span>{i18n.t('stats.manual.duration')}</span>
        <input
          class="field num"
          type="number"
          min={1}
          max={1440}
          value={minutes}
          onInput={(event) => setMinutes(Number(event.currentTarget.value))}
        />
      </label>

      <label class="manual__field">
        <span>{i18n.t('stats.table.tag')}</span>
        <select
          class="field"
          value={tagId}
          onChange={(event) => setTagId(event.currentTarget.value)}
        >
          <option value="">{i18n.t('common.untagged')}</option>
          {settings.tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" class="btn btn--small btn--solid">
        {i18n.t('common.add')}
      </button>
    </form>
  );
}

function formatDay(key: string): string {
  return new Date(dayKeyToTs(key)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

function formatStamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalInput(ts: number): string {
  const date = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Day names in the browser's language, Sunday first to match `getDay`. */
function weekdayNames(): string[] {
  const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  // 4 January 1970 was a Sunday.
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(Date.UTC(1970, 0, 4 + index, 12))),
  );
}
