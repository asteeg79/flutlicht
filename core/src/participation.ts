// Welche Spieltage für wen zählen (KONZEPT 2.7, 2.8). Eine Stelle für Tabelle, Prämie,
// Finalisierung, Erinnerungen und Ansichten, damit ein verschobener Saisonstart überall gilt.
import type { ManagerDoc } from "./schemas/manager";

/** Ab dem ersten gewerteten Spieltag der Saison zählt die Tabelle. */
export function isScoredMatchday(
  matchday: number,
  firstScoredMatchday: number,
): boolean {
  return matchday >= firstScoredMatchday;
}

/** Schattenbetrieb: der Spieltag davor, zur Probe berechnet, nie gewertet. */
export function isShadowMatchday(
  matchday: number,
  firstScoredMatchday: number,
): boolean {
  return matchday === firstScoredMatchday - 1;
}

/**
 * Wie ein Manager an einem Spieltag teilnimmt: gewertet ab dem späteren von seinem
 * ersten Spieltag und dem Saisonstart, im Schattenbetrieb am Spieltag davor, sofern
 * er schon zum Saisonstart dabei war.
 */
export function participation(
  manager: Pick<ManagerDoc, "firstMatchday">,
  matchday: number,
  firstScoredMatchday: number,
): "scored" | "shadow" | null {
  if (
    isScoredMatchday(matchday, firstScoredMatchday) &&
    matchday >= manager.firstMatchday
  )
    return "scored";
  if (
    isShadowMatchday(matchday, firstScoredMatchday) &&
    manager.firstMatchday <= firstScoredMatchday
  )
    return "shadow";
  return null;
}
