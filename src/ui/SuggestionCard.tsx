import { i18n } from '@/i18n';
import { formatDurationShort } from '@/format';

interface Props {
  ms: number;
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * The Flowtime break suggestion: stop the clock and you are offered a break
 * proportional to what you just worked. It waits in storage, since the popup is
 * often shut, and expires after half an hour.
 */
export function SuggestionCard({ ms, onAccept, onDismiss }: Props) {
  return (
    <section class="card card--accent">
      <span class="card__title">
        {i18n.t('flowtime.suggestion', { duration: formatDurationShort(ms) })}
      </span>
      <div class="card__row">
        <button type="button" class="btn btn--small btn--solid" onClick={onAccept}>
          {i18n.t('action.startBreak')}
        </button>
        <button type="button" class="btn btn--small btn--quiet" onClick={onDismiss}>
          {i18n.t('flowtime.dismiss')}
        </button>
      </div>
    </section>
  );
}
