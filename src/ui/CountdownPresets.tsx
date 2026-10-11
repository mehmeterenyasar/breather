import { i18n } from '@/i18n';
import { useState } from 'preact/hooks';
import {
  COUNTDOWN_PRESETS_MIN,
  MAX_DURATION_MIN,
  MIN_DURATION_MIN,
  clampDurationMin,
} from '@/core/presets';

interface Props {
  selectedMin: number;
  onSelect: (minutes: number) => void;
}

/**
 * Quick presets for the countdown, plus a custom length. Whatever is chosen is
 * written to `countdownDefaultMin`, so the popup opens on it next time.
 */
export function CountdownPresets({ selectedMin, onSelect }: Props) {
  const isPreset = COUNTDOWN_PRESETS_MIN.includes(
    selectedMin as (typeof COUNTDOWN_PRESETS_MIN)[number],
  );
  const [custom, setCustom] = useState(!isPreset);

  if (custom) {
    return (
      <div class="presets presets--custom">
        <label class="presets__label" for="countdown-custom">
          {i18n.t('countdown.customLabel')}
        </label>
        <input
          id="countdown-custom"
          class="presets__input num"
          type="number"
          min={MIN_DURATION_MIN}
          max={MAX_DURATION_MIN}
          value={selectedMin}
          autoFocus
          onInput={(event) => onSelect(clampDurationMin(Number(event.currentTarget.value)))}
        />
        <button type="button" class="btn btn--small btn--quiet" onClick={() => setCustom(false)}>
          {i18n.t('common.back')}
        </button>
      </div>
    );
  }

  return (
    <div class="presets" role="group" aria-label={i18n.t('countdown.customLabel')}>
      {COUNTDOWN_PRESETS_MIN.map((minutes) => (
        <button
          key={minutes}
          type="button"
          class={minutes === selectedMin ? 'presets__item presets__item--on' : 'presets__item'}
          aria-pressed={minutes === selectedMin}
          onClick={() => onSelect(minutes)}
        >
          <span class="num">{minutes}</span>
        </button>
      ))}
      <button type="button" class="presets__item" onClick={() => setCustom(true)}>
        {i18n.t('countdown.custom')}
      </button>
    </div>
  );
}
