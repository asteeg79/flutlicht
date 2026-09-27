// Rundung (KONZEPT 3.1, 3.4, 4.1). Das Epsilon fängt Fließkomma-Reste wie 2.4999999999 ab.
const EPSILON = 1e-9;

/** Rundet auf eine Ganzzahl, .5 jeweils von der Null weg (−1.5 → −2). */
export function roundHalfAwayFromZero(x: number): number {
  const r = Math.sign(x) * Math.floor(Math.abs(x) + 0.5 + EPSILON);
  return r === 0 ? 0 : r;
}

/** Rundet auf eine Nachkommastelle, .05 aufwärts (6.25 → 6.3). */
export function round1(x: number): number {
  return Math.floor(x * 10 + 0.5 + EPSILON) / 10;
}

export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/** Median; 0 bei leerer Liste. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** a − b in Mio., exakt über Zehntel. */
export function subtractMio(a: number, b: number): number {
  return (toTenths(a) - toTenths(b)) / 10;
}

/** Mio.-Betrag in ganze Zehntel, damit Summen von Preisen exakt bleiben. */
export function toTenths(mio: number): number {
  return Math.round(mio * 10);
}
