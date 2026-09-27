import { describe, expect, it } from "vitest";
import {
  latestAppearance,
  playerSeason,
  type MatchdayPoints,
  type PlayerPoints,
  type PointParts,
} from "../src";

const ZERO: PointParts = {
  rating: 0,
  goals: 0,
  assists: 0,
  cleanSheet: 0,
  conceded: 0,
  penSaved: 0,
  penMissed: 0,
  ownGoals: 0,
  cards: 0,
};

function entry(
  minutes: number,
  rating: number | null,
  parts: Partial<PointParts>,
  base: number,
): PlayerPoints {
  return {
    eventId: 1,
    minutes,
    started: minutes > 0,
    rating,
    parts: { ...ZERO, ...parts },
    base,
  };
}

function md(
  matchday: number,
  status: MatchdayPoints["status"],
  players: Record<string, PlayerPoints>,
): MatchdayPoints {
  return { matchday, status, generatedAt: "2026-10-01T08:00:00Z", players };
}

const points = [
  md(2, "final", {
    "7": entry(90, 7.7, { rating: 12, cleanSheet: 5 }, 17),
  }),
  md(1, "final", {
    "7": entry(90, 6.9, { rating: 8, goals: 5, cards: -1 }, 12),
  }),
  md(3, "provisional", {
    "7": entry(0, null, {}, 0),
    "8": entry(20, 6.5, { rating: 1.5 }, 2),
  }),
];

describe("playerSeason", () => {
  it("summiert Punkte je Kategorie, Minuten und mittelt die Noten der Einsätze", () => {
    expect(playerSeason(points, 7)).toEqual({
      appearances: 2,
      minutes: 180,
      avgRating: 7.3,
      points: 29,
      parts: { ...ZERO, rating: 20, goals: 5, cleanSheet: 5, cards: -1 },
    });
  });

  it("ohne Einsatz: null", () => {
    expect(playerSeason(points, 99)).toBeNull();
    expect(
      playerSeason([md(1, "final", { "9": entry(0, null, {}, 0) })], 9),
    ).toBeNull();
  });

  it("Einsatz ohne Note zählt, geht aber nicht in den Notenschnitt", () => {
    const s = playerSeason(
      [md(1, "final", { "5": entry(10, null, { conceded: -1 }, -1) })],
      5,
    );
    expect(s).toMatchObject({ appearances: 1, avgRating: null, points: -1 });
  });
});

describe("latestAppearance", () => {
  it("nimmt den jüngsten Spieltag mit Eintrag, auch ohne Minuten", () => {
    expect(latestAppearance(points, 7)).toEqual({
      matchday: 3,
      status: "provisional",
      entry: entry(0, null, {}, 0),
    });
    expect(latestAppearance(points, 8)?.matchday).toBe(3);
    expect(latestAppearance(points, 99)).toBeNull();
  });
});
