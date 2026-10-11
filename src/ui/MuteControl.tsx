import { i18n } from '@/i18n';
import { useState } from 'preact/hooks';
import type { MutePreset } from '@/core/dnd';
import { formatDurationShort } from '@/format';

const PRESETS: Array<{
  preset: MutePreset;
  key: 'dnd.mute30' | 'dnd.mute1h' | 'dnd.mute2h' | 'dnd.muteToday';
}> = [
  { preset: '30m', key: 'dnd.mute30' },
  { preset: '1h', key: 'dnd.mute1h' },
  { preset: '2h', key: 'dnd.mute2h' },
  { preset: 'today', key: 'dnd.muteToday' },
];

interface Props {
  remainingMs: number;
  onMute: (preset: MutePreset) => void;
  onUnmute: () => void;
}

/**
 * Quick mute: one button, which opens into four durations. While muted the time
 * left shows on the button, so nobody wonders why the reminders went quiet.
 */
export function MuteControl({ remainingMs, onMute, onUnmute }: Props) {
  const [open, setOpen] = useState(false);

  if (remainingMs > 0) {
    return (
      <button type="button" class="tool tool--on" onClick={onUnmute}>
        <BellOff />
        {i18n.t('popup.muted', { duration: formatDurationShort(remainingMs) })}
      </button>
    );
  }

  if (!open) {
    return (
      <button type="button" class="tool" onClick={() => setOpen(true)}>
        <BellOff />
        {i18n.t('popup.mute')}
      </button>
    );
  }

  return (
    <div class="mutemenu" role="group" aria-label={i18n.t('popup.mute')}>
      {PRESETS.map((item) => (
        <button
          key={item.preset}
          type="button"
          class="mutemenu__item"
          onClick={() => {
            setOpen(false);
            onMute(item.preset);
          }}
        >
          {i18n.t(item.key)}
        </button>
      ))}
      <button
        type="button"
        class="mutemenu__item mutemenu__item--quiet"
        onClick={() => setOpen(false)}
      >
        {i18n.t('common.cancel')}
      </button>
    </div>
  );
}

function BellOff() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none">
      <path
        d="M8.2 5.2A5 5 0 0 1 17 8.5c0 3.5.8 5 1.7 6H7M4 4l16 16M10 19.5a2 2 0 0 0 4 0"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
