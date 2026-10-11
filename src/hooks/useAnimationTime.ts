import { useEffect, useState } from 'preact/hooks';

/**
 * A timestamp that updates every frame, for the breathing circle. The popup is
 * happy with once a second and uses `useNow` instead, and so is this one when
 * reduced motion is on.
 */
export function useAnimationTime(active: boolean, reducedMotion = false): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;

    if (reducedMotion) {
      const id = window.setInterval(() => setNow(Date.now()), 250);
      return () => window.clearInterval(id);
    }

    let frame = 0;
    const tick = () => {
      setNow(Date.now());
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active, reducedMotion]);

  return now;
}

/**
 * Watches `prefers-reduced-motion`.
 *
 * Every target browser has `matchMedia`, but a missing one reads as "no
 * preference" rather than throwing: an animation playing is a better outcome
 * than the break window never opening at all.
 */
export function usePrefersReducedMotion(): boolean {
  const query = (): MediaQueryList | null =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  const [reduced, setReduced] = useState(() => query()?.matches ?? false);

  useEffect(() => {
    const media = query();
    if (!media) return;

    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return reduced;
}
