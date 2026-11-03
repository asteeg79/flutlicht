"use client";

import { useEffect, useRef, useState } from "react";
import { tween } from "@/lib/count-up";

/**
 * Zahl, die bei Änderungen in `ms` zur neuen rollt (requestAnimationFrame).
 */
export function useCountUp(value: number, ms = 550): number {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    const start = performance.now();
    let raf = requestAnimationFrame(function step(t) {
      const v = tween(from, value, t - start, ms);
      current.current = v;
      setShown(v);
      if (v !== value) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}
