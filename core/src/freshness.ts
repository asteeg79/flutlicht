// Spiele, die beendet sein müssten, aber noch keine Daten haben (KONZEPT 5.8, 6.3, M4).
// Genutzt vom Überfällig-Alarm der Pipeline und vom Frische-Banner der App.
import type { Fixture } from "./schemas/data";

/** Angenommene Spieldauer ab Anpfiff inklusive Pause und Nachspielzeit. */
export const MATCH_DURATION_MS = 2 * 60 * 60 * 1000;

/**
 * Spiele ohne Daten (`pending`), die seit mehr als `graceMs` beendet sind; ältere als
 * `windowMs` nach Anpfiff zählen nicht mehr (die stehen in review/manual-needed.json).
 */
export function awaitingData(
  fixtures: readonly Fixture[],
  now: Date,
  graceMs: number,
  windowMs: number,
): Fixture[] {
  return fixtures.filter((f) => {
    const age = now.getTime() - Date.parse(f.kickoffUtc);
    return (
      f.dataState === "pending" &&
      age > MATCH_DURATION_MS + graceMs &&
      age <= windowMs
    );
  });
}
