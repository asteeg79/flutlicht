import { describe, expect, it } from "vitest";
import { autoLineup, validateLineup, type Lineup } from "../src";
import { lineup442, positionOf, squadPlayers } from "./helpers";

// IDs 1–2 TW, 3–7 ABW, 8–12 MF, 13–15 ST. Preis = ID (Gleichstand: teurer zuerst).
const SCORE: Record<number, number> = {
  1: 0,
  2: 3,
  3: 1,
  4: 1,
  5: 1,
  6: 1,
  7: 1,
  8: 5,
  9: 5,
  10: 5,
  11: 5,
  12: 5,
  13: 9,
  14: 9,
  15: 9,
};
const auto = (
  l: Lineup,
  { noMatch = [] as number[], locked = [] as number[] } = {},
) =>
  autoLineup(l, {
    positionOf,
    score: (id) => SCORE[id]!,
    price: (id) => id,
    hasMatch: (id) => !noMatch.includes(id),
    isLocked: (id) => locked.includes(id),
  });

describe("autoLineup (Automatisch aufstellen)", () => {
  it("wählt die Formation mit der höchsten Summe, Kapitän = Bester, Bank nach Stärke", () => {
    const r = auto(lineup442);
    expect(r).toEqual({
      ok: true,
      lineup: {
        formation: "3-4-3",
        starters: [2, 7, 6, 5, 12, 11, 10, 9, 15, 14, 13],
        bench: { gk: 1, b: [8, 4, 3] },
        captain: 15,
      },
    });
    expect(r.ok && validateLineup(r.lineup, squadPlayers)).toEqual([]);
  });

  it("stellt möglichst nur Spieler mit Spiel auf", () => {
    const r = auto(lineup442, { noMatch: [13, 14, 15] });
    expect(r.ok && r.lineup.formation).toBe("4-5-1");
    expect(r.ok && r.lineup.starters).toEqual([
      2, 7, 6, 5, 4, 12, 11, 10, 9, 8, 15,
    ]);
    expect(r.ok && r.lineup.captain).toBe(12);
  });

  it("lässt gesperrte Spieler, wo sie sind, auch den gesperrten Kapitän", () => {
    const r = auto(lineup442, { locked: [12, 13] });
    expect(r).toMatchObject({
      ok: true,
      lineup: {
        formation: "3-4-3",
        bench: { gk: 1, b: [4, 12, 3] },
        captain: 13,
      },
    });
    expect(r.ok && r.lineup.starters).toContain(13);
    expect(r.ok && validateLineup(r.lineup, squadPlayers)).toEqual([]);
  });

  it("gesperrter Torhüter: beide Torhüter bleiben", () => {
    const r = auto(lineup442, { locked: [1] });
    expect(r.ok && r.lineup.starters[0]).toBe(1);
    expect(r.ok && r.lineup.bench.gk).toBe(2);
  });

  it("gesperrte Starter kann der Kapitän nicht werden", () => {
    const r = auto({ ...lineup442, captain: 8 }, { locked: [13, 14] });
    expect(r.ok && r.lineup.captain).toBe(15);
  });
});
