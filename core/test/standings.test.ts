import { describe, expect, it } from "vitest";
import {
  matchdayRanks,
  roundScore,
  scoreLeague,
  standings,
  visibleScore,
  type Lineup,
  type MatchdayPoints,
} from "../src";
import { type ManagerScore } from "../src/points";
import { lineupForMatchday, type ScoringManager } from "../src/standings";
import { lineup442, positions } from "./helpers";

/** Spielerpunkte: [Basispunkte, Minuten, reale Startelf] */
function md(
  matchday: number,
  status: MatchdayPoints["status"],
  players: Record<number, [number, number, boolean]>,
): MatchdayPoints {
  return {
    matchday,
    status,
    generatedAt: "2026-11-02T08:00:00Z",
    players: Object.fromEntries(
      Object.entries(players).map(([id, [base, minutes, started]]) => [
        id,
        {
          eventId: 1,
          minutes,
          started,
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
          base,
        },
      ]),
    ),
  };
}

// Kader wie in helpers: TW 1–2, ABW 3–7, MF 8–12, ST 13–15; 4-4-2, Bank TW 2, B1–B3 = 7, 12, 15.
const MD8 = md(8, "final", {
  1: [5, 90, true],
  2: [3, 90, true],
  3: [4, 90, true],
  4: [2, 90, true],
  5: [0, 0, false],
  6: [6, 90, true],
  7: [1, 90, true],
  8: [7, 90, true],
  9: [3, 90, true],
  10: [-2, 90, true],
  11: [4, 90, true],
  12: [5, 90, true],
  13: [10, 90, true],
  14: [0, 0, false],
  15: [6, 30, false],
});
const MD9 = md(9, "final", {
  1: [2, 90, true],
  2: [1, 90, true],
  3: [5, 90, true],
  4: [5, 90, true],
  5: [5, 90, true],
  6: [5, 90, true],
  7: [2, 90, true],
  8: [5, 90, true],
  9: [5, 90, true],
  10: [5, 90, true],
  11: [5, 90, true],
  12: [2, 90, true],
  13: [3, 90, true],
  14: [8, 90, true],
  15: [2, 90, true],
});

const withCaptain = (captain: number, bench = lineup442.bench): Lineup => ({
  ...lineup442,
  captain,
  bench,
});
const benchB: Lineup["bench"] = { gk: 2, b: [12, 15, 7] };

const A: ScoringManager = {
  userId: "A",
  firstMatchday: 8,
  // Aktuell Kapitän 14; eingefroren waren 8 und 9 mit Kapitän 13.
  lineup: withCaptain(14),
  lineupHistory: { "8": withCaptain(13), "9": withCaptain(13) },
  transfers: [],
};
const B: ScoringManager = {
  userId: "B",
  firstMatchday: 8,
  lineup: withCaptain(14, benchB),
  lineupHistory: { "8": withCaptain(14, benchB), "9": withCaptain(14, benchB) },
  transfers: [
    {
      at: "2026-10-28T10:00:00Z",
      matchday: 8,
      out: 3,
      in: 3,
      priceOut: 1,
      priceIn: 1,
      free: false,
    },
    {
      at: "2026-11-04T10:00:00Z",
      matchday: 9,
      out: 3,
      in: 3,
      priceOut: 1,
      priceIn: 1,
      free: false,
    },
    {
      at: "2026-11-04T10:00:00Z",
      matchday: 9,
      out: 3,
      in: 3,
      priceOut: 1,
      priceIn: 1,
      free: true,
    },
  ],
};
// Nachzügler ab Spieltag 9, noch ohne eingefrorenen Stand.
const C: ScoringManager = {
  userId: "C",
  firstMatchday: 9,
  lineup: withCaptain(13),
  lineupHistory: {},
  transfers: [],
};

describe("Szenario: 3 Manager über 2 Spieltage (Abnahme M8)", () => {
  const scores = scoreLeague([A, B, C], [MD8, MD9], positions, 8);
  const table = standings(
    scores,
    new Map([
      [8, "final"],
      [9, "final"],
    ]),
  );

  it("Spieltag 8: Auto-Wechsel, Kapitän, Bank-Reihenfolge und Transferabzug", () => {
    // A: 7+6+4 + (5 ohne Einsatz → B1=7: 1) + 8 + 9+5+0+6 + 12 + (14 ohne Einsatz → 15: 6, kein Bonus) = 64;
    //    Kapitän 13 spielt → +12 = 76
    expect(scores.get("A")!.get(8)!.total).toBe(76);
    const a8 = scores.get("A")!.get(8)!;
    expect(
      a8.slots
        .filter((s) => s.subbedIn)
        .map((s) => [s.starterId, s.playerId, s.points]),
    ).toEqual([
      [5, 7, 1],
      [14, 15, 6],
    ]);
    // B: Bank 12, 15, 7 → für ABW 5 rückt erst B3 (7) nach, ebenfalls 64; Kapitän 14 ohne Einsatz → keine
    //    Verdopplung; 1 bezahlter Transfer → −5 = 59
    expect(scores.get("B")!.get(8)).toMatchObject({
      total: 59,
      captainBonus: 0,
      transferPenalty: 5,
    });
    // C startet erst an Spieltag 9.
    expect(scores.get("C")!.has(8)).toBe(false);
  });

  it("Spieltag 9: eingefrorene Aufstellungen, Gleichstand an der Spitze", () => {
    // Alle Starter spielen: 4 + 4×7 + 4×7 + 5 + 10 = 75
    expect(scores.get("A")!.get(9)!.total).toBe(80); // Kapitän 13 laut lineupHistory: +5
    expect(scores.get("B")!.get(9)!.total).toBe(80); // Kapitän 14: +10, 1 bezahlter Transfer −5
    expect(scores.get("C")!.get(9)!.total).toBe(80); // aktuelle Aufstellung, Kapitän 13: +5
    expect(table.winners).toEqual({ 8: ["A"], 9: ["A", "B", "C"] });
  });

  it("Gesamttabelle", () => {
    expect(
      table.rows.map((r) => [r.rank, r.userId, r.total, r.wins, r.best]),
    ).toEqual([
      [1, "A", 156, 2, 80],
      [2, "B", 139, 1, 80],
      [3, "C", 80, 1, 80],
    ]);
    expect(table.rows[0]!.byMatchday).toEqual({ 8: 76, 9: 80 });
  });
});

describe("standings: Tie-Break (KONZEPT 2.8)", () => {
  const score = (total: number) => ({ total }) as ManagerScore;
  const league = (entries: Record<string, number[]>) =>
    new Map(
      Object.entries(entries).map(([id, totals]) => [
        id,
        new Map(totals.map((t, i) => [i + 1, score(t)])),
      ]),
    );
  const allFinal = (n: number) =>
    new Map(Array.from({ length: n }, (_, i) => [i + 1, "final" as const]));

  it("entscheidet bei gleicher Summe nach Spieltagssiegen", () => {
    const t = standings(
      league({ X: [10, 10, 40], Y: [20, 20, 20] }),
      allFinal(3),
    );
    expect(t.rows.map((r) => [r.userId, r.rank, r.wins])).toEqual([
      ["Y", 1, 2],
      ["X", 2, 1],
    ]);
  });

  it("dann nach dem höchsten Einzelspieltag, sonst gleichauf", () => {
    const t = standings(
      league({
        X: [30, 10, 20],
        Y: [10, 30, 20],
        Z: [25, 15, 20],
        W: [0, 0, 0],
      }),
      allFinal(3),
    );
    // Siege: X (Sp. 1 + 3), Y (Sp. 2 + 3), Z (Sp. 3) → X, Y je 2 mit Bestwert 30 gleichauf, Z mit 1 dahinter
    expect(t.rows.map((r) => [r.userId, r.rank])).toEqual([
      ["X", 1],
      ["Y", 1],
      ["Z", 3],
      ["W", 4],
    ]);
  });

  it("zählt Siege nur an finalen Spieltagen", () => {
    const t = standings(
      league({ X: [5, 50], Y: [10, 0] }),
      new Map([
        [1, "final"],
        [2, "running"],
      ]),
    );
    expect(t.winners).toEqual({ 1: ["Y"] });
    expect(t.rows[0]).toMatchObject({ userId: "X", total: 55, wins: 0 });
  });

  it("führt Manager ohne gewerteten Spieltag mit 0", () => {
    const t = standings(new Map([["X", new Map()]]), new Map());
    expect(t.rows).toEqual([
      { userId: "X", rank: 1, total: 0, wins: 0, best: 0, byMatchday: {} },
    ]);
  });
});

describe("lineupForMatchday (KONZEPT 8.4)", () => {
  it("nimmt für finale Spieltage die eingefrorene, sonst die aktuelle Aufstellung", () => {
    expect(lineupForMatchday(A, 8, "final")!.captain).toBe(13);
    expect(lineupForMatchday(A, 10, "running")!.captain).toBe(14);
    expect(lineupForMatchday(C, 9, "final")!.captain).toBe(13);
  });

  it("zählt erst ab dem Saisonstart, auch wenn der Manager früher begonnen hat", () => {
    // Saisonstart nachträglich von 8 auf 9 verschoben: A (erster Spieltag 8) bekommt für 8 nichts.
    const scores = scoreLeague([A, C], [MD8, MD9], positions, 9);
    expect([...scores.get("A")!.keys()]).toEqual([9]);
    expect([...scores.get("C")!.keys()]).toEqual([9]);
  });

  it("wertet Manager ohne Aufstellung nicht", () => {
    const empty: ScoringManager = { ...C, lineup: null };
    expect(scoreLeague([empty], [MD9], positions, 8).get("C")!.size).toBe(0);
  });
});

describe("roundScore: wer an einem Spieltag mit welcher Aufstellung wie viele Punkte hat", () => {
  it("gewertet ab dem ersten Spieltag, mit der eingefrorenen Aufstellung", () => {
    const r = roundScore(A, MD8, positions, 8);
    expect(r?.kind).toBe("scored");
    expect(r?.lineup.captain).toBe(13);
    expect(r?.score.total).toBe(76);
  });

  it("Schattenbetrieb am Spieltag vor dem ersten gewerteten, Nachzügler nicht", () => {
    expect(roundScore(A, MD8, positions, 9)?.kind).toBe("shadow");
    expect(roundScore(C, MD8, positions, 8)).toBeNull();
    expect(
      roundScore({ ...A, lineup: null, lineupHistory: {} }, MD8, positions, 8),
    ).toBeNull();
  });
});

describe("visibleScore: fremde Aufstellungen erst ab der Sperre (KONZEPT 2.8)", () => {
  const running = { ...MD8, status: "running" as const };
  const round = roundScore(A, running, positions, 8)!;

  it("fremd und laufend: nur gesperrte Starter, Kapitänsbonus erst mit gesperrtem Kapitän", () => {
    const v = visibleScore(round, {
      own: false,
      status: "running",
      locked: new Set([1, 3]),
    });
    expect(v.slots.map((s) => s.starterId)).toEqual([1, 3]);
    expect(v.hidden).toBe(9);
    expect(v.captainBonus).toBe(0);
    const withCaptain = visibleScore(round, {
      own: false,
      status: "running",
      locked: new Set([1, 3, 14]),
    });
    expect(withCaptain.captainBonus).toBe(round.score.captainBonus);
  });

  it("eigene Aufstellung und finale Spieltage: alles sichtbar", () => {
    for (const v of [
      visibleScore(round, { own: true, status: "running", locked: new Set() }),
      visibleScore(round, { own: false, status: "final", locked: new Set() }),
    ]) {
      expect(v.slots).toHaveLength(11);
      expect(v.hidden).toBe(0);
    }
  });
});

describe("standings bis zu einem Spieltag", () => {
  it("lässt spätere Spieltage weg (Bewegung ▲/▼, Endergebnis-Push)", () => {
    const scores = scoreLeague([A, B, C], [MD8, MD9], positions, 8);
    const statusOf = new Map([
      [8, "final" as const],
      [9, "final" as const],
    ]);
    const upTo8 = standings(scores, statusOf, 8);
    expect(Object.keys(upTo8.winners)).toEqual(["8"]);
    expect(
      upTo8.rows.every((r) =>
        Object.keys(r.byMatchday).every((md) => md === "8"),
      ),
    ).toBe(true);
    expect(standings(scores, statusOf, 9)).toEqual(standings(scores, statusOf));
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
