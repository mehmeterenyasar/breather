import { STRETCH_REGION } from '@/core/stretches';
import type { StretchId } from '@/core/stretches';

interface Props {
  stretch: StretchId;
  size?: number;
}

/**
 * One plain figure with the relevant part thickened and tinted, rather than six
 * separate illustrations. Smaller, and it reads in either theme.
 */
export function StretchFigure({ stretch, size = 132 }: Props) {
  const region = STRETCH_REGION[stretch];
  const on = (value: typeof region) =>
    region === value ? 'figure__part figure__part--on' : 'figure__part';

  return (
    <svg
      class="figure"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      {/* head */}
      <circle class={on('head')} cx="60" cy="26" r="12" />
      {/* torso */}
      <path class={on('torso')} d="M60 38 L60 72" stroke-linecap="round" />
      {/* arms */}
      <path class={on('arms')} d="M60 48 L38 60 M60 48 L82 60" stroke-linecap="round" />
      {/* hands */}
      <circle class={on('hands')} cx="36" cy="62" r="4.5" />
      <circle class={on('hands')} cx="84" cy="62" r="4.5" />
      {/* legs */}
      <path class={on('legs')} d="M60 72 L46 100 M60 72 L74 100" stroke-linecap="round" />
    </svg>
  );
}
