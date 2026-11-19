import { describe, expect, it } from "vitest";
import {
  matchdayBonuses,
  median,
  type ManagerDoc,
  type MatchdayPoints,
  matchdayCalendar,
  matchdayFinalizer,
} from "../src";
import { matchdayBonus } from "../src/bonus";
import { participation } from "../src/participation";
import { finalizeManager } from "../src/tick";
import { lineup442, positions, SQUAD_IDS } from "./helpers";

describe("median", () => {
  it("ungerade, gerade und leer", () => {
    expect(median([115, 80, 90])).toBe(90);
    expect(median([130, 80, 100, 90])).toBe(95);
    expect(median([])).toBe(0);
  });
});

describe("matchdayBonus (Spieltagsprämie, KONZEPT 2.7)", () => {
  it("0,03 Mio. je Punkt über dem Median, auf 0,1 gerundet", () => {
    expect(matchdayBonus(110, [80, 90, 110])).toBe(0.6);
    expect(matchdayBonus(125, [80, 90, 100, 125])).toBe(0.9);
    expect(matchdayBonus(100, [80, 90, 100, 125])).toBe(0.2); // 5 × 0,03 = 0,15
    expect(matchdayBonus(102, [90, 102, 80])).toBe(0.4); // 12 × 0,03 = 0,36
    expect(matchdayBonus(101, [90, 101, 80])).toBe(0.3); // 11 × 0,03 = 0,33
  });

  it("nie negativ, höchstens 2 Mio.", () => {
    expect(matchdayBonus(80, [80, 90, 115])).toBe(0);
    expect(matchdayBonus(90, [80, 90, 115])).toBe(0);
    expect(matchdayBonus(250, [0, 0, 250])).toBe(2);
    expect(matchdayBonus(100, [100])).toBe(0);
  });
});

const doc = (userId: string, over: Partial<ManagerDoc> = {}): ManagerDoc => ({
  userId,
  email: `${userId}@example.org`,
  displayName: userId,
  teamName: `${userId} FC`,
  passwordHash: "x",
  role: "player",
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
  firstMatchday: 8,
  squad: SQUAD_IDS,
  cash: 1,
  lineup: lineup442,
  lineupHistory: {},
  transfers: [],
  transferBank: { matchday: 9, available: 2 },
  ...over,
});

describe("participation", () => {
  it("gewertet ab dem eigenen ersten Spieltag, Schatten am Spieltag davor, Nachzügler nicht", () => {
    expect(participation(doc("a"), 8, 8)).toBe("scored");
    expect(participation(doc("a"), 7, 8)).toBe("shadow");
    expect(participation(doc("a"), 6, 8)).toBeNull();
    expect(participation(doc("d", { firstMatchday: 12 }), 7, 8)).toBeNull();
    expect(participation(doc("d", { firstMatchday: 12 }), 11, 8)).toBeNull();
    expect(participation(doc("d", { firstMatchday: 12 }), 12, 8)).toBe(
      "scored",
    );
  });
});

describe("matchdayBonuses", () => {
  // Basispunkte = ID; Kapitän zählt doppelt → Gesamtpunkte hängen am Kapitän.
  const md = (matchday: number): MatchdayPoints => ({
    matchday,
    status: "final",
    generatedAt: "2026-11-02T07:00:00Z",
    players: Object.fromEntries(
      SQUAD_IDS.map((id) => [
        String(id),
        {
          eventId: 1,
          minutes: 90,
          started: true,
          rating: null,
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
          base: id === 13 ? 60 : id,
        },
      ]),
    ),
  });
  // Starter 1,3,4,5,6,8,9,10,11,13,14: 131 Basis + 22 Startelf = 153; Kapitän zählt doppelt.
  const managers = [
    doc("a", { lineup: { ...lineup442, captain: 13 } }), // 153 + 62 = 215
    doc("b", { lineup: { ...lineup442, captain: 1 } }), // 153 + 3 = 156
    doc("c", { lineup: { ...lineup442, captain: 14 } }), // 153 + 16 = 169
    doc("x", { lineup: null, squad: [] }),
    doc("late", { firstMatchday: 12 }),
  ];

  it("gewerteter Spieltag: Median der Teilnehmer, Prämie je Manager", () => {
    const r = matchdayBonuses(managers, md(8), positions, 8);
    expect([...r.keys()]).toEqual(["a", "b", "c"]);
    expect(r.get("a")).toEqual({
      total: 215,
      median: 169,
      bonus: 1.4,
      shadow: false,
    });
    expect(r.get("b")?.bonus).toBe(0);
    expect(r.get("c")?.bonus).toBe(0);
  });

  it("Spieltag vor dem ersten gewerteten: Schattenbetrieb", () => {
    const r = matchdayBonuses(managers, md(7), positions, 8);
    expect(r.get("a")).toMatchObject({ bonus: 1.4, shadow: true });
    expect(r.has("late")).toBe(false);
  });

  it("frühere Spieltage: keine Prämie", () => {
    expect(matchdayBonuses(managers, md(6), positions, 8).size).toBe(0);
  });

  it("matchdayFinalizer: Prämie aus allen Managern, gebucht auf das frisch geladene Dokument", () => {
    const calendar = matchdayCalendar([], new Map());
    const finalize = matchdayFinalizer(
      managers,
      8,
      [md(8)],
      positions,
      calendar,
      8,
    );
    // Zwischen Liste und Speichern hat „a“ den Kapitän gewechselt; die Prämie bleibt die der Liste.
    const fresh = { ...managers[0]!, lineup: { ...lineup442, captain: 1 } };
    const next = finalize(fresh);
    expect(next.matchdayBonuses).toEqual({ "8": 1.4 });
    expect(next.cash).toBe(2.4);
    expect(next.lineupHistory["8"]?.captain).toBe(1);
    expect(finalize(managers[1]!).matchdayBonuses).toEqual({ "8": 0 });
  });
});

describe("finalizeManager mit Prämie", () => {
  const fixtures = [
    { matchday: 7, kickoffUtc: "2026-10-23T18:30:00Z" },
    { matchday: 8, kickoffUtc: "2026-10-30T19:30:00Z" },
    { matchday: 9, kickoffUtc: "2026-11-06T19:30:00Z" },
  ];
  const finals = new Map([
    [7, new Date("2026-10-26T07:00:00Z")],
    [8, new Date("2026-11-02T07:00:00Z")],
  ]);
  const calendar = matchdayCalendar(
    fixtures.map((f) => ({
      ...f,
      homeTeamId: 1,
      awayTeamId: 2,
      status: "scheduled" as const,
    })),
    finals,
  );

  it("schreibt die Prämie genau einmal gut", () => {
    const a = doc("a", { transferBank: { matchday: 8, available: 2 } });
    const next = finalizeManager(a, 8, calendar, {
      firstScoredMatchday: 8,
      bonus: 0.5,
    });
    expect(next.cash).toBe(1.5);
    expect(next.matchdayBonuses).toEqual({ "8": 0.5 });
    const again = finalizeManager(next, 8, calendar, {
      firstScoredMatchday: 8,
      bonus: 0.5,
    });
    expect(again.cash).toBe(1.5);
  });

  it("Schattenbetrieb: nichts gutschreiben, aber die Aufstellung einfrieren", () => {
    const a = doc("a", { transferBank: { matchday: 7, available: 2 } });
    const next = finalizeManager(a, 7, calendar, {
      firstScoredMatchday: 8,
      bonus: 0.9,
    });
    expect(next.cash).toBe(1);
    expect(next.matchdayBonuses).toBeUndefined();
    expect(next.lineupHistory["7"]).toEqual(lineup442);
  });
});
