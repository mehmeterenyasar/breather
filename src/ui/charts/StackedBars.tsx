import type { DailyPoint } from '@/core/stats';
import type { Tag } from '@/core/types';

interface Props {
  points: DailyPoint[];
  tags: Tag[];
  /** 0 draws no goal line. */
  goalMs: number;
  height?: number;
  /** Used for the tooltips and the screen-reader text. */
  formatMs: (ms: number) => string;
  formatDay: (dayKey: string) => string;
  label: string;
}

/**
 * Focus time per day, stacked by tag, with the daily goal as a line.
 *
 * Written by hand because the shape needed is simple and a charting library
 * would weigh more than everything else in the options bundle put together.
 * Colours come from the theme tokens, so light and dark need no extra work.
 */
export function StackedBars({
  points,
  tags,
  goalMs,
  height = 160,
  formatMs,
  formatDay,
  label,
}: Props) {
  if (points.length === 0) return null;

  const width = 720;
  const max = Math.max(goalMs, ...points.map((point) => point.total), 1);
  const slot = width / points.length;
  const barWidth = Math.max(1, Math.min(18, slot * 0.72));

  const colorOf = (tagId: string) =>
    tagId === ''
      ? 'var(--track-strong)'
      : (tags.find((tag) => tag.id === tagId)?.color ?? 'var(--tone)');

  // Fixed order, or the stacks shuffle themselves from one day to the next.
  const order = ['', ...tags.map((tag) => tag.id)];

  return (
    <svg
      class="chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      style={{ height: `${height}px` }}
    >
      {goalMs > 0 && (
        <line
          class="chart__goal"
          x1="0"
          x2={width}
          y1={height - (goalMs / max) * height}
          y2={height - (goalMs / max) * height}
          vector-effect="non-scaling-stroke"
        />
      )}

      {points.map((point, index) => {
        const x = index * slot + (slot - barWidth) / 2;
        let y = height;

        return (
          <g key={point.dayKey}>
            <title>{`${formatDay(point.dayKey)} — ${formatMs(point.total)}`}</title>
            {order.map((tagId) => {
              const value = point.byTag[tagId] ?? 0;
              if (value <= 0) return null;

              const barHeight = (value / max) * height;
              y -= barHeight;

              return (
                <rect
                  key={tagId}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={colorOf(tagId)}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
