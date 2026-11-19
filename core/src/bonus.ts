// Spieltagsprämie (KONZEPT 2.7): Geld für Spieltagspunkte über dem Median der Liga.
// Der Spieltag vor dem ersten gewerteten läuft im Schattenbetrieb: berechnet, nicht gutgeschrieben.
import { MARKET } from "./config/market";
import type { Position } from "./config/rules";
import { clamp, median, round1 } from "./rounding";
import type { MatchdayPoints } from "./schemas/data";
import { roundScore, type ScoringManager } from "./standings";

/** Prämie in Mio.: 0,03 je Punkt über dem Median aller Teilnehmer, 0 bis 2 Mio. */
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
    const round = roundScore(m, md, positions, firstScoredMatchday);
    if (!round) continue;
    totals.set(m.userId, {
      total: round.score.total,
      shadow: round.kind === "shadow",
    });
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
