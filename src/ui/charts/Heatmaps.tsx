import { dayKeyToTs } from '@/core/time';
import type { DailyPoint } from '@/core/stats';

/**
 * Heatmaps, as hand-written SVG.
 *
 * Intensity goes in five steps, built as `--tone` at varying opacity, which
 * means one palette works in both themes. Zero is drawn in the track colour
 * rather than left blank, so an empty day still reads as a day.
 */

const LEVELS = 4;

function levelOf(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(LEVELS, Math.ceil((value / max) * LEVELS));
}

const CELL = 11;
const GAP = 3;

interface YearProps {
  points: DailyPoint[];
  formatMs: (ms: number) => string;
  formatDay: (dayKey: string) => string;
  label: string;
}

/** A year, laid out like a contribution graph: a column per week. */
export function YearHeatmap({ points, formatMs, formatDay, label }: YearProps) {
  if (points.length === 0) return null;

  const max = Math.max(...points.map((point) => point.total), 1);

  // Shift so Monday is 0.
  const weekdayOf = (dayKey: string) => (new Date(dayKeyToTs(dayKey)).getDay() + 6) % 7;

  const leading = weekdayOf(points[0]!.dayKey);
  const columns = Math.ceil((leading + points.length) / 7);

  const width = columns * (CELL + GAP);
  const height = 7 * (CELL + GAP);

  return (
    <svg
      class="heatmap"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={label}
    >
      {points.map((point, index) => {
        const offset = leading + index;
        const column = Math.floor(offset / 7);
        const row = offset % 7;

        return (
          <rect
            key={point.dayKey}
            x={column * (CELL + GAP)}
            y={row * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx="2.5"
            class={`heatmap__cell heatmap__cell--l${levelOf(point.total, max)}`}
          >
            <title>{`${formatDay(point.dayKey)} — ${formatMs(point.total)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

interface HourProps {
  matrix: number[][];
  /** Day names from Sunday, matching `getDay`. */
  dayNames: string[];
  formatMs: (ms: number) => string;
  label: string;
}

/** Day of week against hour of day: where the good hours actually are. */
export function HourHeatmap({ matrix, dayNames, formatMs, label }: HourProps) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const max = Math.max(1, ...matrix.flat());

  const width = 24 * (CELL + GAP);
  const height = 7 * (CELL + GAP);

  return (
    <div class="hourmap">
      <ol class="hourmap__days" aria-hidden="true">
        {order.map((day) => (
          <li key={day}>{dayNames[day]?.slice(0, 2)}</li>
        ))}
      </ol>

      <div class="hourmap__grid">
        <svg
          class="heatmap"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMinYMid meet"
          role="img"
          aria-label={label}
        >
          {order.map((day, row) =>
            Array.from({ length: 24 }, (_, hour) => {
              const value = matrix[day]?.[hour] ?? 0;
              return (
                <rect
                  key={`${day}-${hour}`}
                  x={hour * (CELL + GAP)}
                  y={row * (CELL + GAP)}
                  width={CELL}
                  height={CELL}
                  rx="2.5"
                  class={`heatmap__cell heatmap__cell--l${levelOf(value, max)}`}
                >
                  <title>{`${dayNames[day] ?? ''} ${String(hour).padStart(2, '0')}:00 — ${formatMs(value)}`}</title>
                </rect>
              );
            }),
          )}
        </svg>

        <ol class="hourmap__hours" aria-hidden="true">
          {[0, 6, 12, 18].map((hour) => (
            <li key={hour}>{String(hour).padStart(2, '0')}</li>
          ))}
          <li>24</li>
        </ol>
      </div>
    </div>
  );
}
