// Die Fußballwelt aus data/ (KONZEPT 6.3): per statischem import gebündelt,
// beim Modulstart einmal mit den core-Schemas validiert. Nur serverseitig verwenden.
import "server-only";
import { z } from "zod";
import {
  finalizedAt,
  Fixtures,
  ManualNeeded,
  MappingReview,
  MissingValues,
  MarketHistory,
  MatchdayPoints,
  Meta,
  Players,
  playerStats,
  Season,
  Teams,
  type Fixture,
} from "@fm/core";
import fixtures from "@/generated/data/fixtures.json";
import history from "@/generated/data/market/history.json";
import meta from "@/generated/data/meta.json";
import reviewManual from "@/generated/data/review/manual-needed.json";
import reviewMapping from "@/generated/data/review/mapping.json";
import reviewValues from "@/generated/data/review/missing-values.json";
import players from "@/generated/data/players.json";
import points from "@/generated/data/points.json";
import season from "@/generated/data/season.json";
import teams from "@/generated/data/teams.json";

export const gameData = {
  season: Season.parse(season),
  teams: Teams.parse(teams),
  players: Players.parse(players),
  fixtures: Fixtures.parse(fixtures),
  points: z.array(MatchdayPoints).parse(points),
  history: MarketHistory.parse(history),
  meta: Meta.parse(meta),
  review: {
    mapping: MappingReview.parse(reviewMapping),
    missingValues: MissingValues.parse(reviewValues),
    manualNeeded: ManualNeeded.parse(reviewManual),
  },
};

// Einmal je Deployment abgeleitet: gameData ändert sich zur Laufzeit nicht.
export const playerById = new Map(gameData.players.map((p) => [p.id, p]));
export const teamById = new Map(gameData.teams.map((t) => [t.id, t]));
export const positionById = new Map(
  gameData.players.map((p) => [p.id, p.position]),
);
export const statsById = playerStats(gameData.points);

/** Finalisierte Spieltage → Zeitpunkt der Finalisierung (core/finalizedAt). */
export function finals(): Map<number, Date> {
  return finalizedAt(gameData.points);
}

/** Gegner aus Sicht von `teamId` mit Heim/Auswärts: „Bayern (H)“. */
export function opponentLabel(
  f: Pick<Fixture, "homeTeamId" | "awayTeamId">,
  teamId: number,
): string {
  const home = f.homeTeamId === teamId;
  const other = teamById.get(home ? f.awayTeamId : f.homeTeamId);
  return `${other?.shortName ?? ""} (${home ? "H" : "A"})`;
}
