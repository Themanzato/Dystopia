import { useEffect, useRef, useState } from 'react';

export const MINIMUM_LOADING_MS = 5000;

// A single foreground timer, rather than a React update on every frame. Time
// hidden by a curtain or spent in background does not consume the five seconds.
export function useLoadingMinimum(presented: boolean) {
  const elapsed = useRef(0);
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    if (!presented || complete) return;
    const started = Date.now();
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      elapsed.current = MINIMUM_LOADING_MS;
      setComplete(true);
    }, Math.max(0, MINIMUM_LOADING_MS - elapsed.current));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      elapsed.current = Math.min(MINIMUM_LOADING_MS, elapsed.current + Math.max(0, Date.now() - started));
    };
  }, [presented, complete]);
  return complete;
}