// Kennzahlen je Spieler für Markt und Profil (KONZEPT 8.1): Punkte und Form.
import { MARKET } from "./config/market";
import type { MatchdayPoints, PlayerPoints, PointParts } from "./schemas/data";

export interface PlayerStats {
  /** Summe der Basispunkte aller Einsätze. */
  points: number;
  appearances: number;
  /** Ø Basispunkte der letzten 5 Einsätze; null ohne Einsatz. */
  form: number | null;
}

export function playerStats(
  points: readonly MatchdayPoints[],
): Map<number, PlayerStats> {
  const history = new Map<number, number[]>();
  for (const md of [...points].sort((a, b) => a.matchday - b.matchday)) {
    for (const [id, pp] of Object.entries(md.players)) {
      if (pp.minutes <= 0) continue;
      const list = history.get(Number(id)) ?? [];
      list.push(pp.base);
      history.set(Number(id), list);
    }
  }
  const out = new Map<number, PlayerStats>();
  for (const [id, bases] of history) {
    const recent = bases.slice(-MARKET.formWindow);
    out.set(id, {
      points: bases.reduce((a, b) => a + b, 0),
      appearances: bases.length,
      form: recent.reduce((a, b) => a + b, 0) / recent.length,
    });
  }
  return out;
}

export interface PlayerSeason {
  appearances: number;
  minutes: number;
  /** Ø Sofascore-Note der Einsätze mit Note, zwei Nachkommastellen; null ohne Note. */
  avgRating: number | null;
  /** Summe der Basispunkte (gerundet je Spiel, wie in `playerStats`). */
  points: number;
  /** Summe der ungerundeten Einzelteile, zwei Nachkommastellen. */
  parts: PointParts;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Wie ein Spieler über die Saison zu seinen Punkten kam; null ohne Einsatz. */
export function playerSeason(
  points: readonly MatchdayPoints[],
  playerId: number,
): PlayerSeason | null {
  const played = points
    .map((md) => md.players[String(playerId)])
    .filter((pp): pp is PlayerPoints => pp !== undefined && pp.minutes > 0);
  if (played.length === 0) return null;
  const ratings = played.flatMap((pp) =>
    pp.rating === null ? [] : [pp.rating],
  );
  const parts = { ...played[0]!.parts };
  for (const key of Object.keys(parts) as (keyof PointParts)[]) {
    parts[key] = round2(played.reduce((sum, pp) => sum + pp.parts[key], 0));
  }
  return {
    appearances: played.length,
    minutes: played.reduce((sum, pp) => sum + pp.minutes, 0),
    avgRating:
      ratings.length === 0
        ? null
        : round2(ratings.reduce((a, b) => a + b, 0) / ratings.length),
    points: played.reduce((sum, pp) => sum + pp.base, 0),
    parts,
  };
}

/** Jüngster Spieltag, für den es einen Eintrag gibt (auch 0 Minuten). */
export function latestAppearance(
  points: readonly MatchdayPoints[],
  playerId: number,
): {
  matchday: number;
  status: MatchdayPoints["status"];
  entry: PlayerPoints;
} | null {
  let best: MatchdayPoints | null = null;
  for (const md of points) {
    if (md.players[String(playerId)] && (!best || md.matchday > best.matchday))
      best = md;
  }
  return best
    ? {
        matchday: best.matchday,
        status: best.status,
        entry: best.players[String(playerId)]!,
      }
    : null;
}
