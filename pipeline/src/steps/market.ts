// Pipeline-Schritt market (KONZEPT 4.3, 6.5 Schritt 5): Preise Spieltag für Spieltag fortschreiben.
import {
  expectation,
  nextPrice,
  type MarketHistory,
  type MatchdayPoints,
  type Player,
} from "@fm/core";

/**
 * Nur finale Spieltage ab dem ersten gewerteten Spieltag bewegen Preise. Der Erwartungswert E
 * nutzt alle bisherigen finalen Einsätze, auch die vor dem ersten gewerteten Spieltag.
 * Spieler ohne Marktwert und Spieler ohne Einsatz behalten ihren Preis.
 */
export function buildMarket(
  players: readonly Player[],
  points: readonly MatchdayPoints[],
  firstScoredMatchday: number,
): { history: MarketHistory; prices: Map<number, number> } {
  const byId = new Map(players.map((p) => [p.id, p]));
  const prices = new Map(players.map((p) => [p.id, p.price]));
  const appearances = new Map<number, number[]>();
  const history: MarketHistory = {};

  for (const md of [...points].sort((a, b) => a.matchday - b.matchday)) {
    if (md.status !== "final") continue;
    for (const [key, pp] of Object.entries(md.players)) {
      if (pp.minutes <= 0) continue;
      const id = Number(key);
      const past = appearances.get(id) ?? [];
      const player = byId.get(id);
      if (
        md.matchday >= firstScoredMatchday &&
        player &&
        player.valueSource !== "missing"
      ) {
        const price = nextPrice(
          prices.get(id)!,
          pp.base,
          expectation(past, player.position),
        );
        prices.set(id, price);
        (history[key] ??= []).push({ matchday: md.matchday, price });
      }
      appearances.set(id, [...past, pp.base]);
    }
  }
  return { history, prices };
}
