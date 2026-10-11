import { i18n } from '@/i18n';
import { useState } from 'preact/hooks';
import { formatDurationShort } from '@/format';
import type { PendingReview } from '@/storage/ui-queue';

type Rating = 1 | 2 | 3 | 4 | 5;
const RATINGS: Rating[] = [1, 2, 3, 4, 5];

interface Props {
  review: PendingReview;
  onSubmit: (input: { rating?: Rating; note?: string }) => void;
  onSkip: () => void;
}

/**
 * How did that go? A rating in one click, and a note if you feel like it.
 *
 * The popup is usually shut when a session ends, so the question waits in
 * storage and gets asked next time it opens. Both fields are optional: tapping
 * a star closes the card, and Skip closes it without writing anything.
 */
export function ReviewCard({ review, onSubmit, onSkip }: Props) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [note, setNote] = useState('');

  function choose(value: Rating) {
    setRating(value);
    // With no note to type, one click should be the whole interaction.
    if (!note.trim()) onSubmit({ rating: value });
  }

  return (
    <section class="card" aria-label={i18n.t('review.question')}>
      <header class="card__head">
        <span class="card__title">{i18n.t('review.question')}</span>
        <span class="card__meta num">
          {i18n.t('review.summary', { duration: formatDurationShort(review.durationMs) })}
        </span>
      </header>

      <div class="stars" role="group">
        {RATINGS.map((value) => (
          <button
            key={value}
            type="button"
            class={
              rating != null && value <= rating ? 'stars__item stars__item--on' : 'stars__item'
            }
            aria-label={i18n.t('a11y.rate', { count: String(value) })}
            onClick={() => choose(value)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M12 3.6l2.5 5.3 5.7.8-4.1 4 1 5.7-5.1-2.8-5.1 2.8 1-5.7-4.1-4 5.7-.8z" />
            </svg>
          </button>
        ))}
      </div>

      <div class="card__row">
        <input
          class="card__input"
          type="text"
          value={note}
          maxLength={140}
          placeholder={i18n.t('review.notePlaceholder')}
          aria-label={i18n.t('review.notePlaceholder')}
          onInput={(event) => setNote(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSubmit({ rating: rating ?? undefined, note });
            }
          }}
        />
        {note.trim() ? (
          <button
            type="button"
            class="btn btn--small"
            onClick={() => onSubmit({ rating: rating ?? undefined, note })}
          >
            {i18n.t('common.save')}
          </button>
        ) : (
          <button type="button" class="btn btn--small btn--quiet" onClick={onSkip}>
            {i18n.t('common.skip')}
          </button>
        )}
      </div>
    </section>
  );
}
