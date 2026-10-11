import { i18n } from '@/i18n';
import { MODES } from '@/core/types';
import type { Mode } from '@/core/types';
import { modeLabel } from '@/format';

interface Props {
  mode: Mode;
  /** Switching mode mid-session would throw it away, so the tabs lock. */
  locked: boolean;
  onSelect: (mode: Mode) => void;
}

export function ModeTabs({ mode, locked, onSelect }: Props) {
  return (
    <div class="tabs" role="radiogroup" aria-label={i18n.t('a11y.modeTabs')}>
      {MODES.map((item) => {
        const selected = item === mode;
        return (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={selected}
            class={selected ? 'tabs__tab tabs__tab--on' : 'tabs__tab'}
            disabled={locked && !selected}
            title={locked && !selected ? i18n.t('popup.modeLocked') : undefined}
            onClick={() => onSelect(item)}
          >
            {modeLabel(item)}
          </button>
        );
      })}
    </div>
  );
}
