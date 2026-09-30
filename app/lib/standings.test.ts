import { describe, expect, it, vi } from "vitest";
import { defaultLineup, type ManagerDoc, type MatchdayPoints } from "@fm/core";

vi.mock("@/lib/auth", () => ({ auth: async () => null }));
const { leagueTable, matchdayRanks, matchdayView } =
  await import("@/lib/standings");
const { players, SQUAD } = await import("@/test/fixtures");

// Standardaufstellung des Test-Kaders: Starter 1 (Verein 1), 11–14, 21–24, 31 (Verein 2), 32 (Verein 3).
const lineup = defaultLineup(
  SQUAD.map((id) => players.find((p) => p.id === id)!),
);
const manager = (userId: string, displayName: string): ManagerDoc => ({
  userId,
  email: `${displayName}@example.org`,
  displayName,
  teamName: `${displayName} FC`,
  passwordHash: "x",
  role: "player",
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
  firstMatchday: 9,
  squad: SQUAD,
  cash: 1,
  lineup,
  lineupHistory: {},
  transfers: [],
  transferBank: { matchday: 9, available: 2 },
});
const tom = manager("11111111-1111-4111-8111-111111111111", "Tom");
const ida = manager("22222222-2222-4222-8222-222222222222", "Ida");

const points = (status: MatchdayPoints["status"]): MatchdayPoints => ({
  matchday: 9,
  status,
  generatedAt: "2026-11-06T22:00:00Z",
  players: {
    "1": {
      eventId: 1,
      minutes: 90,
      started: true,
      rating: 7,
      parts: {
        rating: 5,
        goals: 0,
        assists: 0,
        cleanSheet: 0,
        conceded: 0,
        penSaved: 0,
        penMissed: 0,
        ownGoals: 0,
        cards: 0,
      },
      base: 5,
    },
  },
});
// Verein 1–2 spielt Freitag (gesperrt ab 18:00 UTC), Verein 3–4 Samstag.
const fixtures = [
  { home: 1, away: 2, kickoffUtc: "2026-11-06T19:30:00Z" },
  { home: 3, away: 4, kickoffUtc: "2026-11-07T14:30:00Z" },
].map((f, i) => ({
  matchday: 9,
  openligaMatchId: i,
  homeTeamId: f.home,
  awayTeamId: f.away,
  kickoffUtc: f.kickoffUtc,
  originalKickoffUtc: f.kickoffUtc,
  status: "scheduled" as const,
  dataState: "none" as const,
}));
const game = (status: MatchdayPoints["status"]) => ({
  players,
  teams: [],
  points: [points(status)],
  fixtures,
  season: { firstScoredMatchday: 8 },
});
const FRIDAY_EVENING = new Date("2026-11-06T20:00:00Z");

describe("matchdayView: Sichtbarkeit fremder Aufstellungen (KONZEPT 2.8)", () => {
  it("zeigt die eigene Aufstellung ganz, fremde nur mit gesperrten Spielern", () => {
    const view = matchdayView(
      9,
      [ida, tom],
      tom.userId,
      FRIDAY_EVENING,
      game("running"),
    );
    const [own, other] = view.managers;
    expect(own).toMatchObject({ displayName: "Tom", own: true, hidden: 0 });
    expect(own!.slots).toHaveLength(11);
    // Gesperrt sind am Freitagabend nur Spieler von Verein 1 und 2: TW 1, MF 21, ST 31.
    expect(other!.slots.map((s) => s.starter.id).sort()).toEqual([1, 21, 31]);
    expect(other).toMatchObject({ own: false, hidden: 8, total: 7 });
    expect(other!.slots.find((s) => s.starter.id === 31)!.captain).toBe(true);
  });

  it("zeigt nach der Finalisierung alle Spieler", () => {
    const view = matchdayView(
      9,
      [ida, tom],
      tom.userId,
      FRIDAY_EVENING,
      game("final"),
    );
    expect(
      view.managers.every((m) => m.hidden === 0 && m.slots.length === 11),
    ).toBe(true);
  });

  it("meldet Spieltage ohne Punkte als bevorstehend", () => {
    expect(
      matchdayView(10, [tom], tom.userId, FRIDAY_EVENING, game("running")),
    ).toEqual({
      matchday: 10,
      status: "upcoming",
      shadow: false,
      managers: [],
    });
  });
});

describe("matchdayView: Schattenbetrieb und Prämie (2.7)", () => {
  it("zeigt den Spieltag vor dem ersten gewerteten zur Probe, mit Prämie", () => {
    const g = { ...game("final"), season: { firstScoredMatchday: 10 } };
    const later = (m: ManagerDoc) => ({ ...m, firstMatchday: 10 });
    const view = matchdayView(
      9,
      [later(tom), later(ida)],
      tom.userId,
      FRIDAY_EVENING,
      g,
    );
    expect(view.shadow).toBe(true);
    expect(view.managers.map((m) => m.displayName)).toEqual(["Tom", "Ida"]);
    expect(view.managers[0]!.bonus).toMatchObject({ bonus: 0, shadow: true });
  });

  it("gewertete Spieltage sind kein Schattenbetrieb", () => {
    const view = matchdayView(
      9,
      [tom],
      tom.userId,
      FRIDAY_EVENING,
      game("final"),
    );
    expect(view.shadow).toBe(false);
    expect(view.managers[0]!.bonus).toMatchObject({ shadow: false });
  });
});

describe("leagueTable", () => {
  it("zählt Spieltage vor dem Saisonstart nicht, auch wenn der Manager früher begann", () => {
    const g = { ...game("final"), season: { firstScoredMatchday: 10 } };
    const t = leagueTable([tom, ida], g);
    expect(t.matchdays).toEqual([]);
    expect(t.rows.map((r) => r.total)).toEqual([0, 0]);
    expect(t.winners).toEqual({});
  });

  it("rechnet die Tabelle mit Namen und Spieltagssiegern", () => {
    const t = leagueTable([tom, ida], game("final"));
    expect(t.rows.map((r) => [r.rank, r.displayName, r.total])).toEqual([
      [1, "Tom", 7],
      [1, "Ida", 7],
    ]);
    expect(t.winners[9]).toEqual({
      matchday: 9,
      ids: [tom.userId, ida.userId],
      names: ["Tom", "Ida"],
      points: 7,
    });
  });
});

describe("leagueTable: Bewegung ▲/▼", () => {
  const md = (matchday: number, id: string, base: number): MatchdayPoints => {
    const p = points("final");
    return { ...p, matchday, players: { [id]: { ...p.players["1"]!, base } } };
  };
  it("vergleicht mit der Tabelle ohne den letzten gewerteten Spieltag", () => {
    // Tom: Kapitän 31 (ST); Ida: Kapitän 1 (TW). Spieltag 9 gewinnt Tom, 10 Ida deutlich.
    const idaCap = { ...ida, lineup: { ...lineup, captain: 1 } };
    const g = { ...game("final"), points: [md(9, "31", 10), md(10, "1", 30)] };
    const t = leagueTable([tom, idaCap], g);
    const by = new Map(t.rows.map((r) => [r.displayName, r]));
    expect(by.get("Ida")).toMatchObject({ rank: 1, movement: 1 });
    expect(by.get("Tom")).toMatchObject({ rank: 2, movement: -1 });
  });

  it("ohne Vorspieltag keine Bewegung", () => {
    const t = leagueTable([tom, ida], game("final"));
    expect(t.rows.every((r) => r.movement === null)).toBe(true);
  });
});

describe("matchdayRanks", () => {
  it("Rang nach Punkten, Gleichstand teilt sich den Platz", () => {
    const ranks = matchdayRanks([
      { userId: "a", total: 40 },
      { userId: "b", total: 55 },
      { userId: "c", total: 40 },
      { userId: "d", total: 12 },
    ]);
    expect([...ranks]).toEqual([
      ["a", 2],
      ["b", 1],
      ["c", 2],
      ["d", 4],
    ]);
  });
});
