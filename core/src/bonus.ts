// Spieltagsprämie (KONZEPT 2.7): Geld für Spieltagspunkte über dem Median der Liga.
// Der Spieltag vor dem ersten gewerteten läuft im Schattenbetrieb: berechnet, nicht gutgeschrieben.
import { MARKET } from "./config/market";
import type { Position } from "./config/rules";
import { scoreManager } from "./points";
import { clamp, round1 } from "./rounding";
import type { MatchdayPoints } from "./schemas/data";
import { lineupForMatchday, type ScoringManager } from "./standings";

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Prämie in Mio.: 0,02 je Punkt über dem Median aller Teilnehmer, 0 bis 2 Mio. */
export function matchdayBonus(
  total: number,
  allTotals: readonly number[],
): number {
  if (allTotals.length === 0) return 0;
  return clamp(
    round1(MARKET.bonusPerPoint * (total - median(allTotals))),
    0,
    MARKET.bonusCap,
  );
}

/**
 * Wie ein Manager an einem Spieltag teilnimmt: gewertet ab seinem ersten Spieltag
 * (frühestens dem ersten gewerteten der Saison), im Schattenbetrieb am Spieltag davor,
 * sofern er schon zum Saisonstart dabei war.
 */
export function participation(
  manager: Pick<ScoringManager, "firstMatchday">,
  matchday: number,
  firstScoredMatchday: number,
): "scored" | "shadow" | null {
  if (matchday >= firstScoredMatchday && matchday >= manager.firstMatchday)
    return "scored";
  if (
    matchday === firstScoredMatchday - 1 &&
    manager.firstMatchday <= firstScoredMatchday
  )
    return "shadow";
  return null;
}

export interface MatchdayBonus {
  total: number;
  median: number;
  bonus: number;
  shadow: boolean;
}

/** Punkte, Median und Prämie je teilnehmendem Manager (mit Aufstellung) an einem Spieltag. */
export function matchdayBonuses(
  managers: readonly ScoringManager[],
  md: MatchdayPoints,
  positions: ReadonlyMap<number, Position>,
  firstScoredMatchday: number,
): Map<string, MatchdayBonus> {
  const totals = new Map<string, { total: number; shadow: boolean }>();
  for (const m of managers) {
    const kind = participation(m, md.matchday, firstScoredMatchday);
    const lineup = kind && lineupForMatchday(m, md.matchday, md.status);
    if (!lineup) continue;
    const { total } = scoreManager(
      md.matchday,
      lineup,
      md.players,
      m.transfers,
      positions,
    );
    totals.set(m.userId, { total, shadow: kind === "shadow" });
  }
  const all = [...totals.values()].map((t) => t.total);
  const mid = median(all);
  return new Map(
    [...totals].map(([id, t]) => [
      id,
      {
        total: t.total,
        median: mid,
        bonus: matchdayBonus(t.total, all),
        shadow: t.shadow,
      },
    ]),
  );
}
