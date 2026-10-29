import { useEffect, useRef, useState } from 'react';

export const MINIMUM_LOADING_MS = 5000;

// A single foreground timer, rather than a React update on every frame. Time
// hidden by a curtain or spent in background does not consume the five seconds.
export function useLoadingMinimum(presented: boolean, minimumMs = MINIMUM_LOADING_MS) {
  const elapsed = useRef(0);
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    if (!presented || complete) return;
    const started = Date.now();
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      elapsed.current = minimumMs;
      setComplete(true);
    }, Math.max(0, minimumMs - elapsed.current));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      elapsed.current = Math.min(minimumMs, elapsed.current + Math.max(0, Date.now() - started));
    };
  }, [presented, complete, minimumMs]);
  return minimumMs<=0||complete;
}
