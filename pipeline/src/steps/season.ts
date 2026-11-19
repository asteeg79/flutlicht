// Pipeline-Schritt season (KONZEPT 4.2, 7.1): vMax und Startbudget festschreiben.
import {
  RULES,
  selectRegulars,
  startBudget,
  type ManualSeason,
  type Player,
  type Season,
} from "@fm/core";

export const SEASON_CONSTANTS = {
  season: "2026/27",
  sofascoreTournamentId: 35,
  sofascoreSeasonId: 97464,
  openligaSeason: 2026,
  matchdays: 34,
} as const;

/**
 * Stammspieler sind die 11 Spieler je Verein mit den meisten Minuten aus dem Backfill.
 * Spieler ohne Marktwert zählen nicht mit, sonst verzerrt ihr Platzhalterpreis den Median.
 */
export function buildSeason(
  players: readonly Player[],
  minutes: ReadonlyMap<number, number>,
  manual: ManualSeason,
  vMaxEur: number,
): Season {
  const candidates = players.filter(
    (p) => p.active && p.valueSource !== "missing",
  );
  const regulars = selectRegulars(candidates, minutes);
  return {
    ...SEASON_CONSTANTS,
    postponedGraceDays: RULES.postponedGraceDays,
    firstScoredMatchday: manual.firstScoredMatchday,
    vMaxEur,
    startBudget:
      manual.startBudget ?? startBudget(regulars.map((p) => p.price)),
  };
}
