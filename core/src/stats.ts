// Kennzahlen je Spieler für Markt und Profil (KONZEPT 8.1): Punkte und Form.
import { MARKET } from "./config/market";
import type { MatchdayPoints } from "./schemas/data";

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
