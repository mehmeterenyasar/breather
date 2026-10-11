import { useEffect, useState } from 'preact/hooks';

/**
 * Moves the seconds on screen.
 *
 * This is not the timer, only a repaint trigger: the remaining time is always
 * worked out from the state and `Date.now()`. When the popup closes the interval
 * dies with it and nothing is lost.
 */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      setNow(Date.now());
      return;
    }

    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);

  return now;
}
