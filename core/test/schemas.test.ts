import { describe, expect, it } from "vitest";
import {
  Fixture,
  ManagerDoc,
  ManualMatch,
  MatchdayPoints,
  Meta,
  Player,
  Season,
} from "../src";
import { lineup442 } from "./helpers";

const manager = {
  userId: "7f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  email: "alex@example.org",
  displayName: "Alex",
  teamName: "Flutlicht FC",
  passwordHash: "scrypt$32768$8$1$c2FsdA==$aGFzaA==",
  role: "admin",
  createdAt: "2026-09-25T10:00:00Z",
  updatedAt: "2026-09-25T10:00:00Z",
  firstMatchday: 6,
  squad: Array.from({ length: 15 }, (_, i) => i + 1),
  cash: 1.5,
  lineup: lineup442,
  lineupHistory: { "5": lineup442 },
  transfers: [],
  transferBank: { matchday: 6, available: 2 },
};

describe("Schemas (KONZEPT 7)", () => {
  it("akzeptiert ein Manager-Dokument, auch ohne Erstkader", () => {
    expect(ManagerDoc.parse(manager).email).toBe("alex@example.org");
    expect(
      ManagerDoc.safeParse({ ...manager, squad: [], lineup: null }).success,
    ).toBe(true);
  });

  it("weist einen Kader mit 14 Spielern und eine volle Transferbank über 3 ab", () => {
    expect(
      ManagerDoc.safeParse({ ...manager, squad: manager.squad.slice(1) })
        .success,
    ).toBe(false);
    expect(
      ManagerDoc.safeParse({
        ...manager,
        transferBank: { matchday: 6, available: 4 },
      }).success,
    ).toBe(false);
  });

  it("prüft Spieler, Spiele, Saison und Meta", () => {
    const player = {
      id: 1,
      name: "Max Muster",
      shortName: "M. Muster",
      teamId: 2672,
      position: "MID",
      birthDate: "2000-01-31",
      valueSource: "dcaribou",
      price: 6.3,
      purchasable: true,
      active: true,
    };
    expect(Player.safeParse(player).success).toBe(true);
    expect(Player.safeParse({ ...player, price: 30.1 }).success).toBe(false);
    expect(Player.safeParse({ ...player, position: "ST" }).success).toBe(false);

    const fixture = {
      matchday: 1,
      openligaMatchId: 1,
      sofascoreEventId: 16434087,
      homeTeamId: 2672,
      awayTeamId: 2677,
      kickoffUtc: "2026-08-28T18:30:00Z",
      originalKickoffUtc: "2026-08-28T18:30:00Z",
      status: "finished",
      score: { home: 2, away: 1 },
      dataState: "final",
    };
    expect(Fixture.safeParse(fixture).success).toBe(true);
    expect(
      Fixture.safeParse({ ...fixture, kickoffUtc: "28.08.2026" }).success,
    ).toBe(false);

    expect(
      Season.safeParse({
        season: "2026/27",
        sofascoreTournamentId: 35,
        sofascoreSeasonId: 97464,
        openligaSeason: 2026,
        firstScoredMatchday: 6,
        vMaxEur: 140_000_000,
        startBudget: 65,
        matchdays: 34,
        postponedGraceDays: 3,
      }).success,
    ).toBe(true);
    expect(
      Meta.safeParse({
        dataVersion: "abc",
        generatedAt: "2026-09-25T10:00:00Z",
        lastFinalMatchday: null,
      }).success,
    ).toBe(true);
  });

  it("prüft Spieltagspunkte und den Admin-Nachtrag", () => {
    const parts = {
      rating: 13,
      goals: 5,
      assists: 4,
      cleanSheet: 0,
      conceded: 0,
      penSaved: 0,
      penMissed: 0,
      ownGoals: 0,
      cards: -1,
    };
    const points = {
      matchday: 1,
      status: "final",
      generatedAt: "2026-09-25T10:00:00Z",
      players: {
        "123": {
          eventId: 1,
          minutes: 90,
          started: true,
          rating: 7.8,
          parts,
          base: 21,
        },
      },
    };
    expect(MatchdayPoints.safeParse(points).success).toBe(true);
    expect(
      MatchdayPoints.safeParse({
        ...points,
        players: { abc: points.players["123"] },
      }).success,
    ).toBe(false);

    const manual = {
      eventId: 1,
      enteredBy: "alex",
      enteredAt: "2026-09-25T10:00:00Z",
      score: { home: 1, away: 0 },
      players: [
        {
          playerId: 5,
          started: true,
          minutes: 90,
          rating: null,
          goals: 1,
          assists: 0,
          ownGoals: 0,
          yellow: false,
          yellowRed: false,
          red: false,
          penMissed: 0,
          penSaved: 0,
        },
      ],
    };
    expect(ManualMatch.safeParse(manual).success).toBe(true);
    expect(
      ManualMatch.safeParse({ ...manual, score: { home: -1, away: 0 } })
        .success,
    ).toBe(false);
  });
});

describe("Push-Anmeldungen je Gerät", () => {
  const device = (n: number) => ({
    endpoint: `https://push.example.org/${n}`,
    keys: { p256dh: "p", auth: "a" },
  });
  const prefs = { reminder: true, daily: false, final: true };

  it("übernimmt die einzelne Anmeldung alter Dokumente als ein Gerät", () => {
    const old = { ...manager, push: { subscription: device(1), prefs } };
    expect(ManagerDoc.parse(old).push).toEqual({
      subscriptions: [device(1)],
      prefs,
    });
  });

  it("hält mehrere Geräte, aber mindestens eines", () => {
    const two = { subscriptions: [device(1), device(2)], prefs };
    expect(ManagerDoc.parse({ ...manager, push: two }).push).toEqual(two);
    expect(
      ManagerDoc.safeParse({ ...manager, push: { subscriptions: [], prefs } })
        .success,
    ).toBe(false);
  });
});
