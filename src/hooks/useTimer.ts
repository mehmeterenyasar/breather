import { useCallback, useEffect, useState } from 'preact/hooks';
import { initialState } from '@/core/timer';
import type { TimerEvent, TimerState } from '@/core/timer';
import { sendMessage } from '@/messaging';
import { readTimerState, watchTimerState } from '@/storage/timer-state';
import { readTodaySummary, watchTodaySummary } from '@/storage/today-cache';
import type { TodaySummary } from '@/storage/today-cache';

export interface TimerController {
  state: TimerState;
  /** False until the first read lands, so the popup doesn't flicker. */
  ready: boolean;
  dispatch: (event: TimerEvent) => void;
}

/**
 * Reads the timer state from storage and sends commands to the worker.
 *
 * The two directions go different ways on purpose: reads come straight from
 * `storage`, so nothing waits on a sleeping worker, while writes go as messages,
 * so only one place ever sets an alarm.
 */
export function useTimer(): TimerController {
  const [state, setState] = useState<TimerState>(() => initialState());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    void readTimerState().then((value) => {
      if (!alive) return;
      setState(value);
      setReady(true);
    });

    // The phase may have ended while the worker slept, so nudge it to reconcile.
    void sendMessage('timer.sync', undefined)
      .then((value) => {
        if (alive) setState(value);
      })
      .catch((error: unknown) => console.warn('[breather] sync failed', error));

    const unwatch = watchTimerState((value) => setState(value));
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  const dispatch = useCallback((event: TimerEvent) => {
    void sendMessage('timer.dispatch', event)
      .then((next) => setState(next))
      .catch((error: unknown) => console.error('[breather] could not send command', error));
  }, []);

  return { state, ready, dispatch };
}

/** The strip along the bottom of the popup. No IndexedDB involved. */
export function useTodaySummary(): TodaySummary | null {
  const [summary, setSummary] = useState<TodaySummary | null>(null);

  useEffect(() => {
    let alive = true;

    void readTodaySummary(Date.now()).then((value) => {
      if (alive) setSummary(value);
    });

    const unwatch = watchTodaySummary(() => Date.now(), setSummary);
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  return summary;
}
