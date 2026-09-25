// Die Fußballwelt aus data/ (KONZEPT 6.3): per statischem import gebündelt,
// beim Modulstart einmal mit den core-Schemas validiert. Nur serverseitig verwenden.
import "server-only";
import { z } from "zod";
import {
  Fixtures,
  MarketHistory,
  MatchdayPoints,
  Meta,
  Players,
  Season,
  Teams,
} from "@fm/core";
import fixtures from "@/generated/data/fixtures.json";
import history from "@/generated/data/market/history.json";
import meta from "@/generated/data/meta.json";
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
};

/** Finalisierte Spieltage → Zeitpunkt der Finalisierung (Stand der finalen Daten). */
export function finals(): Map<number, Date> {
  return new Map(
    gameData.points
      .filter((p) => p.status === "final")
      .map((p) => [p.matchday, new Date(p.generatedAt)]),
  );
}
