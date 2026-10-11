import { i18n } from '@/i18n';
import type { BreathFrame, BreathPhase } from '@/core/breath';

const PHASE_KEY = {
  inhale: 'break.breath.phase.inhale',
  inhale2: 'break.breath.phase.inhale2',
  hold: 'break.breath.phase.hold',
  exhale: 'break.breath.phase.exhale',
  holdAfter: 'break.breath.phase.holdAfter',
} as const satisfies Record<BreathPhase, string>;

export function breathPhaseLabel(phase: BreathPhase): string {
  return i18n.t(PHASE_KEY[phase]);
}

interface Props {
  frame: BreathFrame;
  rounds: number;
  /** Reduced motion: text and a bar instead of the circle. */
  reducedMotion: boolean;
  size?: number;
}

/**
 * Nefes rehberi.
 *
 * With `prefers-reduced-motion` the growing circle is replaced by the step name,
 * the seconds left and a bar. Same information, nothing moving.
 */
export function BreathCircle({ frame, rounds, reducedMotion, size = 220 }: Props) {
  const label = breathPhaseLabel(frame.phase);

  if (reducedMotion) {
    return (
      <div class="breath breath--still">
        <span class="breath__phase">{label}</span>
        <span class="breath__count num">{frame.secondsLeft}</span>
        <div class="breath__bar" role="presentation">
          <div class="breath__bar-fill" style={{ width: `${frame.phaseProgress * 100}%` }} />
        </div>
        <span class="breath__round">
          {i18n.t('break.breath.round', {
            current: String(Math.min(frame.round, rounds)),
            total: String(rounds),
          })}
        </span>
      </div>
    );
  }

  return (
    <div class="breath" style={{ width: `${size}px`, height: `${size}px` }}>
      <div class="breath__halo" style={{ transform: `scale(${frame.scale})` }} aria-hidden="true" />
      <div class="breath__disc" style={{ transform: `scale(${frame.scale})` }} aria-hidden="true" />
      <div class="breath__content">
        <span class="breath__phase">{label}</span>
        <span class="breath__count num">{frame.secondsLeft}</span>
      </div>
      <span class="breath__round">
        {i18n.t('break.breath.round', {
          current: String(Math.min(frame.round, rounds)),
          total: String(rounds),
        })}
      </span>
    </div>
  );
}
