import { useCallback, useEffect, useState } from 'preact/hooks';
import { sendMessage } from '@/messaging';
import {
  readBreakSuggestion,
  readPendingReview,
  watchBreakSuggestion,
  watchPendingReview,
} from '@/storage/ui-queue';
import type { BreakSuggestion, PendingReview } from '@/storage/ui-queue';

/**
 * Picks up whatever was waiting for the popup: the rating question and the
 * Flowtime break suggestion. Writes go to the worker, which owns IndexedDB.
 */
export function useUiQueue() {
  const [review, setReview] = useState<PendingReview | null>(null);
  const [suggestion, setSuggestion] = useState<BreakSuggestion | null>(null);

  useEffect(() => {
    let alive = true;
    const now = () => Date.now();

    void readPendingReview(now()).then((value) => alive && setReview(value));
    void readBreakSuggestion(now()).then((value) => alive && setSuggestion(value));

    const unwatchReview = watchPendingReview(now, setReview);
    const unwatchSuggestion = watchBreakSuggestion(now, setSuggestion);

    return () => {
      alive = false;
      unwatchReview();
      unwatchSuggestion();
    };
  }, []);

  const submitReview = useCallback(
    (input: { sessionId: string; rating?: 1 | 2 | 3 | 4 | 5; note?: string }) => {
      setReview(null);
      void sendMessage('session.review', input).catch((error: unknown) =>
        console.error('[breather] could not save the review', error),
      );
    },
    [],
  );

  const dismissSuggestion = useCallback(() => {
    setSuggestion(null);
    void sendMessage('suggestion.clear', undefined).catch(() => undefined);
  }, []);

  return { review, suggestion, submitReview, dismissSuggestion };
}
