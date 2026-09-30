// Hochzählen von Zahlen (Arena 8, Feinschliff 4): ease-out 1 − (1 − p)³.

export function easeOutCubic(p: number): number {
  const t = Math.min(1, Math.max(0, p));
  return 1 - (1 - t) ** 3;
}

/** Wert nach `elapsed` ms eines Übergangs von `from` nach `to` über `ms`. */
export function tween(from: number, to: number, elapsed: number, ms: number) {
  if (ms <= 0 || elapsed >= ms) return to;
  return from + (to - from) * easeOutCubic(elapsed / ms);
}
