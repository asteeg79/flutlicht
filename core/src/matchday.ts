// Gewertete Spiele und Status eines Spieltags (KONZEPT 2.1, 2.9).
import { RULES } from "./config/rules";
import type { Fixture } from "./schemas/data";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Zählt das Spiel für seinen Spieltag? Nur, wenn es höchstens 3 Tage nach dem ursprünglichen Termin stattfindet. */
export function fixtureCounts(
  f: Pick<Fixture, "kickoffUtc" | "originalKickoffUtc">,
): boolean {
  return (
    Date.parse(f.kickoffUtc) - Date.parse(f.originalKickoffUtc) <=
    RULES.postponedGraceDays * DAY_MS
  );
}

const HAS_DATA = new Set(["provisional", "final", "manual"]);

/**
 * Status aus Sicht der Daten: final, wenn alle gewerteten Spiele finale oder manuelle
 * Daten haben; provisional, wenn alle beendet sind und Daten haben; running, sobald ein
 * gewertetes Spiel läuft, beendet ist oder Daten hat; sonst null (noch nicht begonnen).
 */
export function matchdayStatus(
  fixtures: readonly Pick<
    Fixture,
    "kickoffUtc" | "originalKickoffUtc" | "status" | "dataState"
  >[],
): "running" | "provisional" | "final" | null {
  const counted = fixtures.filter(fixtureCounts);
  if (counted.length === 0) return null;
  if (counted.every((f) => f.dataState === "final" || f.dataState === "manual"))
    return "final";
  if (
    counted.every((f) => f.status === "finished" && HAS_DATA.has(f.dataState))
  )
    return "provisional";
  if (
    counted.some((f) => f.status !== "scheduled" || HAS_DATA.has(f.dataState))
  )
    return "running";
  return null;
}
