"use client";

import { useEffect, useRef, useState } from "react";
import { tween } from "@/lib/count-up";

/**
 * Zahl, die bei Änderungen in `ms` zur neuen rollt (requestAnimationFrame).
 * Bei prefers-reduced-motion springt sie direkt.
 */
export function useCountUp(value: number, ms = 550): number {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reduced ? 0 : ms;
    const start = performance.now();
    let raf = requestAnimationFrame(function step(t) {
      const v = tween(from, value, t - start, duration);
      current.current = v;
      setShown(v);
      if (v !== value) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}
