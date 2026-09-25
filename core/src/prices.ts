// Startpreise, Startbudget und Preisdynamik (KONZEPT 4).
import { MARKET } from "./config/market";
import type { Position } from "./config/rules";
import { clamp, round1 } from "./rounding";

/** Startpreis in Mio. aus dem Marktwert v (Wurzelskala, 4.1). */
export function startPrice(valueEur: number, vMaxEur: number): number {
  const raw = MARKET.startPriceScale * Math.sqrt(valueEur / vMaxEur);
  return clamp(round1(raw), MARKET.startPriceMin, MARKET.startPriceMax);
}

export const VALUE_SOURCES = [
  "manual",
  "tm-crawl",
  "dcaribou",
  "sofascore",
] as const;
export type ValueSourceName = (typeof VALUE_SOURCES)[number];

/**
 * Marktwert für den Startpreis nach Priorität (4.1): ein Admin-Wert gewinnt immer,
 * dann eigener Crawl, dcaribou, Sofascore. Werte ≤ 0 zählen als fehlend.
 */
export function chooseStartValue(
  values: Readonly<Record<ValueSourceName, number | undefined>>,
): { valueEur: number; source: ValueSourceName } | null {
  for (const source of VALUE_SOURCES) {
    const v = values[source];
    if (v !== undefined && v > 0) return { valueEur: v, source };
  }
  return null;
}

/**
 * Stammspieler (4.2): pro Verein die Spieler mit den meisten Einsatzminuten,
 * bei Gleichstand die kleinere ID zuerst.
 */
export function selectRegulars<P extends { id: number; teamId: number }>(
  players: readonly P[],
  minutes: ReadonlyMap<number, number>,
): P[] {
  const byTeam = new Map<number, P[]>();
  for (const p of players)
    byTeam.set(p.teamId, [...(byTeam.get(p.teamId) ?? []), p]);
  const mins = (p: P) => minutes.get(p.id) ?? 0;
  return [...byTeam.values()].flatMap((team) =>
    [...team]
      .sort((a, b) => mins(b) - mins(a) || a.id - b.id)
      .slice(0, MARKET.regularsPerClub),
  );
}

/** Startbudget in Mio. aus den Preisen der Stammspieler (4.2). */
export function startBudget(regularPrices: readonly number[]): number {
  if (regularPrices.length === 0) throw new Error("Keine Stammspieler-Preise");
  const step = MARKET.budgetStep;
  return Math.ceil((MARKET.budgetFactor * median(regularPrices)) / step) * step;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Erwartungswert E (4.3): Mittel der Basispunkte der letzten Einsätze.
 * `history` enthält die Basispunkte aller bisherigen Einsätze (> 0 Min.) in
 * zeitlicher Reihenfolge, ohne den aktuellen Spieltag.
 */
export function expectation(
  history: readonly number[],
  position: Position,
): number {
  const recent = history.slice(-MARKET.formWindow);
  if (recent.length === 0) return MARKET.defaultExpectation[position];
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

/** Neuer Preis nach einem finalen Spieltag mit Basispunkten P (4.3). */
export function nextPrice(price: number, P: number, E: number): number {
  const delta = clamp(
    (MARKET.deltaFactor * (P - E)) / MARKET.deltaDivisor,
    -MARKET.deltaCap,
    MARKET.deltaCap,
  );
  return clamp(round1(price * (1 + delta)), MARKET.priceMin, MARKET.priceMax);
}
