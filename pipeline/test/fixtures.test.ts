import { describe, expect, it } from "vitest";
import { mergeOriginalKickoffs } from "../src/fetch-openligadb";
import { buildFixtures, type OpenligaMatch } from "../src/steps/fixtures";

const teams = [
  { id: 2672, name: "Bayern", shortName: "Bayern", openligaTeamId: 40 },
  { id: 2677, name: "Stuttgart", shortName: "Stuttgart", openligaTeamId: 16 },
];
const match = (over: Partial<OpenligaMatch> = {}): OpenligaMatch => ({
  matchID: 1,
  matchDateTimeUTC: "2026-10-10T13:30:00Z",
  group: { groupOrderID: 5 },
  team1: { teamId: 40 },
  team2: { teamId: 16 },
  matchIsFinished: false,
  matchResults: [],
  ...over,
});
const build = (
  m: OpenligaMatch,
  extra: Partial<Parameters<typeof buildFixtures>[0]> = {},
) =>
  buildFixtures({
    matches: [m],
    originals: {},
    rounds: [{ id: 99, matchday: 5, homeTeamId: 2672, awayTeamId: 2677 }],
    teams,
    dataKindOf: () => undefined,
    now: new Date("2026-10-10T12:00:00Z"),
    ...extra,
  })[0]!;

describe("buildFixtures", () => {
  it("übersetzt OpenLigaDB-Vereine in Sofascore-IDs und ordnet das Event zu", () => {
    expect(build(match())).toEqual({
      matchday: 5,
      openligaMatchId: 1,
      sofascoreEventId: 99,
      homeTeamId: 2672,
      awayTeamId: 2677,
      kickoffUtc: "2026-10-10T13:30:00Z",
      originalKickoffUtc: "2026-10-10T13:30:00Z",
      status: "scheduled",
      dataState: "none",
    });
  });

  it("setzt Endstand, live und Datenstand", () => {
    const finished = match({
      matchIsFinished: true,
      matchResults: [
        { resultTypeID: 1, pointsTeam1: 1, pointsTeam2: 0 },
        { resultTypeID: 2, pointsTeam1: 2, pointsTeam2: 1 },
      ],
    });
    expect(build(finished)).toMatchObject({
      status: "finished",
      score: { home: 2, away: 1 },
      dataState: "pending",
    });
    expect(build(finished, { dataKindOf: () => "final" }).dataState).toBe(
      "final",
    );
    expect(
      build(match(), { now: new Date("2026-10-10T14:00:00Z") }).status,
    ).toBe("live");
  });

  it("erkennt ein um mehr als 3 Tage verlegtes Spiel", () => {
    const f = build(match({ matchDateTimeUTC: "2026-11-20T19:30:00Z" }), {
      originals: { "1": "2026-10-10T13:30:00Z" },
    });
    expect(f).toMatchObject({
      status: "postponed",
      originalKickoffUtc: "2026-10-10T13:30:00Z",
    });
  });

  it("bricht ab, wenn ein Verein in teams.json fehlt", () => {
    expect(() => build(match({ team2: { teamId: 1 } }))).toThrow(/teams.json/);
  });
});

describe("mergeOriginalKickoffs", () => {
  it("behält bekannte Zeiten und ergänzt neue", () => {
    const merged = mergeOriginalKickoffs({ "2": "2026-10-10T13:30:00Z" }, [
      { matchID: 2, matchDateTimeUTC: "2026-11-20T19:30:00Z" },
      { matchID: 1, matchDateTimeUTC: "2026-10-09T18:30:00Z" },
    ]);
    expect(merged).toEqual({
      "1": "2026-10-09T18:30:00Z",
      "2": "2026-10-10T13:30:00Z",
    });
    expect(Object.keys(merged)).toEqual(["1", "2"]);
  });
});
