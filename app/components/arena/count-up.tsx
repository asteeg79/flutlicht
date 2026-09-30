"use client";

import { useState } from "react";
import { useCountUp } from "@/hooks/useCountUp";

/**
 * Zahl, die zur neuen hochzählt, deutsch formatiert. `flash`: beim Wechsel kurz
 * aufblitzen (Guthaben nach einem Deal, Live-Punkte bei neuen Daten).
 */
export function CountUp({
  value,
  decimals = 0,
  ms = 550,
  flash = false,
}: {
  value: number;
  decimals?: 0 | 1;
  ms?: number;
  flash?: boolean;
}) {
  const shown = useCountUp(value, ms);
  // Zählt die Wechsel mit; erst ab dem ersten Wechsel blitzt es (nicht beim Laden).
  const [seen, setSeen] = useState({ value, changes: 0 });
  if (seen.value !== value) setSeen({ value, changes: seen.changes + 1 });
  const text = shown.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span
      key={flash ? seen.changes : undefined}
      className={`arena-anim inline-block tabular-nums ${flash && seen.changes > 0 ? "animate-[arena-flash_.7s_ease-out_both]" : ""}`}
    >
      {text.replace("-", "−")}
    </span>
  );
}
