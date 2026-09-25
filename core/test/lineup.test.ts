import { describe, expect, it } from "vitest";
import {
  FORMATIONS,
  diffLineupRespectsLocks,
  formationCounts,
  validateLineup,
  type Lineup,
} from "../src";
import { lineup442, squadPlayers } from "./helpers";

const codes = (l: Lineup) => validateLineup(l, squadPlayers).map((v) => v.code);

describe("formationCounts", () => {
  it.each(FORMATIONS)("%s ergibt 11 Starter mit 1 TW", (f) => {
    const c = formationCounts(f);
    expect(c.GK).toBe(1);
    expect(c.GK + c.DEF + c.MID + c.FWD).toBe(11);
  });
});

describe("validateLineup (KONZEPT 2.3, 2.4)", () => {
  it("akzeptiert eine gültige 4-4-2-Aufstellung", () => {
    expect(codes(lineup442)).toEqual([]);
  });

  it("akzeptiert einen gültigen Formationswechsel auf 3-5-2", () => {
    const l: Lineup = {
      formation: "3-5-2",
      starters: [1, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14],
      bench: { gk: 2, b: [6, 7, 15] },
      captain: 13,
    };
    expect(codes(l)).toEqual([]);
  });

  it("weist eine Startelf ab, die nicht zur Formation passt", () => {
    expect(codes({ ...lineup442, formation: "3-4-3" })).toEqual(["formation"]);
  });

  it("verlangt genau die Spieler des Kaders", () => {
    expect(codes({ ...lineup442, bench: { gk: 2, b: [7, 12, 99] } })).toEqual([
      "lineup-players",
    ]);
    expect(codes({ ...lineup442, bench: { gk: 2, b: [7, 12, 12] } })).toEqual([
      "lineup-players",
    ]);
  });

  it("verlangt einen Torwart als Ersatz-TW", () => {
    const l: Lineup = { ...lineup442, bench: { gk: 7, b: [2, 12, 15] } };
    expect(codes(l)).toEqual(["bench-gk"]);
  });

  it("verlangt den Kapitän in der Startelf", () => {
    expect(codes({ ...lineup442, captain: 15 })).toEqual(["captain"]);
  });
});

describe("diffLineupRespectsLocks (KONZEPT 2.5)", () => {
  const swap = (l: Lineup, a: number, b: number): Lineup => {
    const s = (id: number) => (id === a ? b : id === b ? a : id);
    const [b1, b2, b3] = l.bench.b;
    return {
      ...l,
      starters: l.starters.map(s),
      bench: { gk: s(l.bench.gk), b: [s(b1), s(b2), s(b3)] },
    };
  };

  it("erlaubt den Tausch zweier ungesperrter Spieler, auch wenn andere gesperrt sind", () => {
    expect(
      diffLineupRespectsLocks(
        lineup442,
        swap(lineup442, 3, 7),
        new Set([1, 13]),
      ),
    ).toEqual([]);
  });

  it("weist den Tausch mit einem gesperrten Starter ab", () => {
    const v = diffLineupRespectsLocks(
      lineup442,
      swap(lineup442, 3, 7),
      new Set([3]),
    );
    expect(v.map((x) => [x.code, x.playerId])).toEqual([["locked-role", 3]]);
  });

  it("weist das Umsortieren eines gesperrten Bankspielers ab", () => {
    const after: Lineup = { ...lineup442, bench: { gk: 2, b: [12, 7, 15] } };
    expect(
      diffLineupRespectsLocks(lineup442, after, new Set([7])).map(
        (x) => x.code,
      ),
    ).toEqual(["locked-role"]);
  });

  it("erlaubt einen Formationswechsel, wenn nur ungesperrte Spieler die Rolle wechseln", () => {
    const after: Lineup = {
      ...lineup442,
      formation: "3-5-2",
      starters: [1, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14],
      bench: { gk: 2, b: [7, 6, 15] },
    };
    expect(
      diffLineupRespectsLocks(lineup442, after, new Set([1, 3, 13])),
    ).toEqual([]);
    expect(
      diffLineupRespectsLocks(lineup442, after, new Set([6])).map(
        (x) => x.code,
      ),
    ).toEqual(["locked-role"]);
  });

  it("weist einen Kapitänswechsel bei gesperrtem Alt-Kapitän ab", () => {
    const v = diffLineupRespectsLocks(
      lineup442,
      { ...lineup442, captain: 14 },
      new Set([13]),
    );
    expect(v.map((x) => x.code)).toEqual(["locked-captain"]);
  });

  it("weist einen gesperrten Spieler als neuen Kapitän ab", () => {
    const v = diffLineupRespectsLocks(
      lineup442,
      { ...lineup442, captain: 14 },
      new Set([14]),
    );
    expect(v.map((x) => x.code)).toEqual(["locked-captain"]);
  });

  it("erlaubt einen Kapitänswechsel zwischen ungesperrten Spielern", () => {
    expect(
      diffLineupRespectsLocks(
        lineup442,
        { ...lineup442, captain: 14 },
        new Set([1]),
      ),
    ).toEqual([]);
  });
});
