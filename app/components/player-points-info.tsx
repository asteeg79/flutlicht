import type { PointParts } from "@fm/core";

/** Punkte-Kurzinfo eines Spielers für die Aufstellung (Punkte-Chip und Auswahl). */
export interface PointsInfo {
  latest: {
    matchday: number;
    minutes: number;
    rating: number | null;
    parts: PointParts;
    base: number;
  } | null;
  season: {
    points: number;
    appearances: number;
    avgRating: number | null;
  } | null;
}

export function formatRating(r: number): string {
  return r.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
