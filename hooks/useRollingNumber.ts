"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

function easeOut(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/**
 * Rolls an integer toward `value`. The first paint shows `value`, so a
 * screen reader that lands on the number hears the finished count. Nothing
 * is exposed as a live region, so intermediate frames are not announced.
 * Reduced motion snaps.
 */
export function useRollingNumber(value: number, durationMs: number): number {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const displayedRef = useRef(value);

  useEffect(() => {
    if (reduce || durationMs <= 0 || displayedRef.current === value) {
      displayedRef.current = value;
      setDisplay(value);
      return;
    }

    const from = displayedRef.current;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const next = Math.round(from + (value - from) * easeOut(progress));
      displayedRef.current = next;
      setDisplay(next);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      displayedRef.current = value;
      setDisplay(value);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, reduce, value]);

  return display;
}
