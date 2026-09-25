import { describe, expect, it } from "vitest";
import type { Fixture, MatchdayPoints, Player } from "@fm/core";
import { overdueFixtures } from "../src/check-overdue";
import { manualNeeded } from "../src/build";
import { buildMarket } from "../src/steps/market";
import { buildPoints, type MatchData } from "../src/steps/points";
import { sanityCheck } from "../src/steps/sanity";

const player = (
  id: number,
  teamId: number,
  over: Partial<Player> = {},
): Player => ({
  id,
  name: `S${id}`,
  shortName: `S${id}`,
  teamId,
  position: "MID",
  birthDate: "2000-01-01",
  valueSource: "tm-crawl",
  price: 10,
  purchasable: true,
  active: true,
  ...over,
});
const fixture = (over: Partial<Fixture> = {}): Fixture => ({
  matchday: 1,
  openligaMatchId: 1,
  sofascoreEventId: 500,
  homeTeamId: 1,
  awayTeamId: 2,
  kickoffUtc: "2026-10-10T13:30:00Z",
  originalKickoffUtc: "2026-10-10T13:30:00Z",
  status: "finished",
  score: { home: 1, away: 0 },
  dataState: "final",
  ...over,
});
const lineupPlayer = (
  id: number,
  minutes: number,
  rating: number,
  extra = {},
) => ({
  player: { id, position: "M" },
  teamId: id < 100 ? 1 : 2,
  substitute: false,
  statistics: { minutesPlayed: minutes, rating, ...extra },
});
const sofascoreData: MatchData = {
  kind: "final",
  at: "2026-10-11T08:30:00Z",
  lineups: {
    home: { players: [lineupPlayer(10, 90, 7.5)] },
    away: { players: [lineupPlayer(110, 90, 6.0)] },
  },
  incidents: {
    incidents: [
      { incidentType: "goal", incidentClass: "regular", player: { id: 10 } },
      { incidentType: "mystery" },
    ],
  },
};
const players = [player(10, 1), player(110, 2), player(20, 1)];

describe("buildPoints", () => {
  it("rechnet Spielerpunkte je Spieltag und meldet Warnungen", () => {
    const warnings: string[] = [];
    const [md] = buildPoints(
      [fixture()],
      new Map([[500, sofascoreData]]),
      players,
      new Date("2026-10-11T09:00:00Z"),
      (w) => warnings.push(w),
    );
    expect(md).toMatchObject({
      matchday: 1,
      status: "final",
      generatedAt: "2026-10-11T08:30:00Z",
    });
    expect(md!.players["10"]).toMatchObject({
      eventId: 500,
      minutes: 90,
      base: 17,
    }); // 10 Note + 6 Tor + 1 zu null
    expect(md!.players["110"]!.parts.conceded).toBe(0);
    expect(warnings).toEqual([
      'Spiel 500: Unbekannter Incident-Typ "mystery", ignoriert',
    ]);
  });

  it("nimmt den Admin-Nachtrag vor Sofascore-Daten", () => {
    const manual: MatchData = {
      kind: "manual",
      at: "2026-10-12T08:00:00Z",
      match: {
        eventId: 500,
        enteredBy: "alex",
        enteredAt: "2026-10-12T08:00:00Z",
        score: { home: 0, away: 3 },
        players: [
          {
            playerId: 20,
            started: true,
            minutes: 90,
            rating: null,
            goals: 0,
            assists: 0,
            ownGoals: 0,
            yellow: false,
            yellowRed: false,
            red: false,
            penMissed: 0,
            penSaved: 0,
          },
        ],
      },
    };
    const [md] = buildPoints(
      [fixture({ dataState: "manual" })],
      new Map([[500, manual]]),
      players,
      new Date(),
      () => {},
    );
    expect(Object.keys(md!.players)).toEqual(["20"]);
    expect(md!.players["20"]!.parts.conceded).toBe(0); // MF: Gegentore zählen nicht
  });

  it("überspringt vorläufige Daten ohne Endstand und nicht begonnene Spieltage", () => {
    const warnings: string[] = [];
    const running = fixture({
      status: "live",
      score: undefined,
      dataState: "provisional",
    });
    const later = fixture({
      matchday: 2,
      status: "scheduled",
      score: undefined,
      dataState: "none",
      sofascoreEventId: 501,
    });
    const out = buildPoints(
      [running, later],
      new Map([[500, { ...sofascoreData, kind: "provisional" }]]),
      players,
      new Date("2026-10-10T15:00:00Z"),
      (w) => warnings.push(w),
    );
    expect(
      out.map((m) => [
        m.matchday,
        m.status,
        Object.keys(m.players).length,
        m.generatedAt,
      ]),
    ).toEqual([[1, "running", 0, "2026-10-10T15:00:00.000Z"]]);
    expect(warnings).toEqual([
      "Spiel 500: noch kein Endstand, wird übersprungen",
    ]);
  });
});

const pp = (base: number, minutes = 90) => ({
  eventId: 1,
  minutes,
  started: true,
  rating: 7,
  parts: {
    rating: 0,
    goals: 0,
    assists: 0,
    cleanSheet: 0,
    conceded: 0,
    penSaved: 0,
    penMissed: 0,
    ownGoals: 0,
    cards: 0,
  },
  base,
});
const md = (
  matchday: number,
  status: MatchdayPoints["status"],
  entries: Record<string, ReturnType<typeof pp>>,
): MatchdayPoints => ({
  matchday,
  status,
  generatedAt: "2026-10-11T08:30:00Z",
  players: entries,
});

describe("buildMarket (KONZEPT 4.3)", () => {
  it("bewegt Preise erst ab dem ersten gewerteten Spieltag, E aus allen Einsätzen davor", () => {
    const points = [
      md(1, "final", { "10": pp(6) }),
      md(2, "final", { "10": pp(18), "110": pp(0, 0) }),
      md(3, "provisional", { "10": pp(40) }),
    ];
    const { history, prices } = buildMarket(players, points, 2);
    expect(history).toEqual({ "10": [{ matchday: 2, price: 10.5 }] }); // E = 6, P = 18 → +4.8 %
    expect(prices.get(10)).toBe(10.5);
    expect(prices.get(110)).toBe(10);
  });

  it("nimmt ohne Einsatz-Historie den Standardwert und lässt Spieler ohne Marktwert aus", () => {
    const withMissing = [
      ...players,
      player(30, 1, { valueSource: "missing", price: 0.5 }),
    ];
    const { history } = buildMarket(
      withMissing,
      [md(8, "final", { "10": pp(4), "30": pp(20) })],
      8,
    );
    expect(history).toEqual({ "10": [{ matchday: 8, price: 10 }] }); // E = 4 → Δ 0
  });
});

describe("sanityCheck (KONZEPT 6.4)", () => {
  it("meldet zu wenige Vereine, Spieler, Preise außerhalb der Grenzen und dünne Spiele", () => {
    const errors = sanityCheck({
      teams: [],
      players: [player(1, 1, { price: 31 })],
      fixtures: [fixture()],
      points: [md(1, "final", { "10": { ...pp(5), eventId: 500 } })],
    });
    expect(errors).toEqual([
      "nur 0 Vereine",
      "nur 1 Spieler",
      "Preis 31 von Spieler 1 außerhalb [0.5, 30]",
      "Spiel 500: nur 1 Spieler mit Einsatzminuten",
    ]);
  });
});

describe("manualNeeded und overdueFixtures (KONZEPT 5.8, M4)", () => {
  const pending = fixture({
    dataState: "pending",
    kickoffUtc: "2026-10-10T13:30:00Z",
  });
  it("listet Spiele ohne Daten erst nach 3 Tagen für den Nachtrag", () => {
    expect(manualNeeded([pending], new Date("2026-10-13T13:30:00Z"))).toEqual(
      [],
    );
    expect(
      manualNeeded([pending], new Date("2026-10-13T13:31:00Z")),
    ).toHaveLength(1);
  });
  it("alarmiert zwischen 5 Stunden und 3 Tagen nach Anpfiff", () => {
    expect(
      overdueFixtures([pending], new Date("2026-10-10T18:30:00Z")),
    ).toEqual([]);
    expect(
      overdueFixtures([pending], new Date("2026-10-10T18:31:00Z")),
    ).toHaveLength(1);
    expect(
      overdueFixtures([pending], new Date("2026-10-13T13:31:00Z")),
    ).toEqual([]);
    expect(
      overdueFixtures([fixture()], new Date("2026-10-10T20:00:00Z")),
    ).toEqual([]);
  });
});
