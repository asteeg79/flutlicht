// Sanity-Guard (KONZEPT 6.4): Abbruch ohne Schreiben bei offensichtlich kaputten Daten.
import {
  HAS_DATA,
  MARKET,
  type Fixture,
  type MatchdayPoints,
  type Player,
  type Team,
} from "@fm/core";

const MIN_TEAMS = 18;
const MIN_PLAYERS = 400;
const MIN_PLAYERS_WITH_MINUTES = 22;

export function sanityCheck(out: {
  teams: readonly Team[];
  players: readonly Player[];
  fixtures: readonly Fixture[];
  points: readonly MatchdayPoints[];
}): string[] {
  const errors: string[] = [];
  if (out.teams.length < MIN_TEAMS)
    errors.push(`nur ${out.teams.length} Vereine`);
  if (out.players.length < MIN_PLAYERS)
    errors.push(`nur ${out.players.length} Spieler`);
  for (const p of out.players) {
    if (p.price < MARKET.priceMin || p.price > MARKET.priceMax) {
      errors.push(
        `Preis ${p.price} von Spieler ${p.id} außerhalb [${MARKET.priceMin}, ${MARKET.priceMax}]`,
      );
    }
  }
  const played = new Map<number, number>();
  for (const md of out.points) {
    for (const pp of Object.values(md.players)) {
      if (pp.minutes > 0)
        played.set(pp.eventId, (played.get(pp.eventId) ?? 0) + 1);
    }
  }
  for (const f of out.fixtures) {
    if (f.status !== "finished" || f.sofascoreEventId === undefined) continue;
    if (!HAS_DATA.has(f.dataState)) continue;
    const n = played.get(f.sofascoreEventId) ?? 0;
    if (n < MIN_PLAYERS_WITH_MINUTES) {
      errors.push(
        `Spiel ${f.sofascoreEventId}: nur ${n} Spieler mit Einsatzminuten`,
      );
    }
  }
  return errors;
}
