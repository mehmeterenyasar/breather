import type { ComponentChildren } from 'preact';

interface Props {
  /** `null` for counting-up modes, which have no progress to show. */
  progress: number | null;
  size: number;
  /** Reads out the remaining time. */
  label: string;
  children?: ComponentChildren;
}

/**
 * The colour comes from `--tone`, which `tokens.css` resolves to the focus or
 * break tone according to the `data-phase` on the container.
 */
export function ProgressRing({ progress, size, label, children }: Props) {
  const stroke = Math.round(size * 0.075);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = progress == null ? 0 : Math.min(1, Math.max(0, progress));

  return (
    <div class="ring" style={{ width: `${size}px`, height: `${size}px` }}>
      <svg
        class="ring__svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label}
      >
        <circle
          class="ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke-width={stroke}
        />
        {progress != null && (
          <circle
            class="ring__value"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke-width={stroke}
            stroke-linecap="round"
            stroke-dasharray={circumference}
            stroke-dashoffset={circumference * (1 - filled)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div class="ring__content">{children}</div>
    </div>
  );
}
