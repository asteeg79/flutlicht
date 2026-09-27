import { describe, expect, it } from "vitest";
import { changeFormation, validateLineup, type Lineup } from "../src";
import { lineup442, positionOf, squadPlayers } from "./helpers";

// Preis = ID: innerhalb einer Position ist die kleinere ID billiger.
const priceOf = (id: number) => id;
const change = (
  l: Lineup,
  target: Parameters<typeof changeFormation>[1],
  locked: number[] = [],
) =>
  changeFormation(l, target, {
    positionOf,
    priceOf,
    isLocked: (id) => locked.includes(id),
  });

describe("changeFormation (KONZEPT 2.3, 2.5)", () => {
  it("4-4-2 → 3-5-2: billigster Verteidiger geht auf den Bankplatz des Mittelfeldspielers", () => {
    const r = change(lineup442, "3-5-2");
    expect(r).toEqual({
      ok: true,
      lineup: {
        formation: "3-5-2",
        starters: [1, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14],
        bench: { gk: 2, b: [7, 3, 15] },
        captain: 13,
      },
    });
    expect(r.ok && validateLineup(r.lineup, squadPlayers)).toEqual([]);
  });

  it("4-4-2 → 3-4-3 und zurück ergibt wieder ein gültiges 4-4-2", () => {
    const r = change(lineup442, "3-4-3");
    expect(r.ok && r.lineup.formation).toBe("3-4-3");
    expect(r.ok && r.lineup.bench.b).toEqual([7, 12, 3]);
    const back = r.ok ? change(r.lineup, "4-4-2") : r;
    expect(back.ok && back.lineup.formation).toBe("4-4-2");
    expect(back.ok && validateLineup(back.lineup, squadPlayers)).toEqual([]);
  });

  it("zwei Wechsel auf einmal: 4-3-3 → 3-5-2", () => {
    const from: Lineup = {
      formation: "4-3-3",
      starters: [1, 3, 4, 5, 6, 8, 9, 10, 13, 14, 15],
      bench: { gk: 2, b: [7, 11, 12] },
      captain: 15,
    };
    const r = change(from, "3-5-2");
    expect(r).toMatchObject({
      ok: true,
      lineup: { formation: "3-5-2", bench: { gk: 2, b: [7, 3, 13] } },
    });
    expect(r.ok && validateLineup(r.lineup, squadPlayers)).toEqual([]);
  });

  it("gleiche Formation: nichts ändert sich", () => {
    expect(change(lineup442, "4-4-2")).toEqual({ ok: true, lineup: lineup442 });
  });

  it("überspringt Kapitän und gesperrte Starter, nimmt den nächstbilligen", () => {
    const r = change({ ...lineup442, captain: 3 }, "3-5-2", [4]);
    expect(r.ok && r.lineup.bench.b).toEqual([7, 5, 15]);
  });

  it("gesperrter Bankspieler kann nicht rein", () => {
    const r = change(lineup442, "3-5-2", [12]);
    expect(r).toEqual({
      ok: false,
      message:
        "3-5-2 geht gerade nicht: Dafür fehlt ein ungesperrter Mittelfeldspieler auf der Bank.",
    });
  });

  it("alle Verteidiger gesperrt oder Kapitän: abgewiesen", () => {
    const r = change({ ...lineup442, captain: 6 }, "3-5-2", [3, 4, 5]);
    expect(r).toEqual({
      ok: false,
      message:
        "3-5-2 geht gerade nicht: Kein Verteidiger kann die Startelf verlassen (gesperrt oder Kapitän).",
    });
  });
});
