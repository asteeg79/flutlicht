import { describe, expect, it } from "vitest";
import {
  formationOf,
  setCaptain,
  swapPlayers,
  validateLineup,
  type Lineup,
} from "../src";
import { lineup442, positionOf, squadPlayers } from "./helpers";

const swap = (l: Lineup, a: number, b: number) =>
  swapPlayers(l, a, b, positionOf);

describe("formationOf", () => {
  it("leitet die Formation ab und erkennt unerlaubte", () => {
    expect(
      formationOf([
        "GK",
        "DEF",
        "DEF",
        "DEF",
        "MID",
        "MID",
        "MID",
        "MID",
        "FWD",
        "FWD",
        "FWD",
      ]),
    ).toBe("3-4-3");
    expect(
      formationOf([
        "GK",
        "DEF",
        "DEF",
        "MID",
        "MID",
        "MID",
        "MID",
        "MID",
        "FWD",
        "FWD",
        "FWD",
      ]),
    ).toBeNull();
    expect(
      formationOf([
        "GK",
        "GK",
        "DEF",
        "DEF",
        "MID",
        "MID",
        "MID",
        "MID",
        "FWD",
        "FWD",
        "FWD",
      ]),
    ).toBeNull();
  });
});

describe("swapPlayers (KONZEPT 2.3)", () => {
  it("tauscht Starter und Bankspieler derselben Position auf denselben Platz", () => {
    const r = swap(lineup442, 3, 7);
    expect(r.ok && r.lineup.starters).toContain(7);
    expect(r.ok && r.lineup.bench.b).toEqual([3, 12, 15]);
    expect(r.ok && r.lineup.formation).toBe("4-4-2");
  });

  it("ändert die Formation, wenn die Positionen wechseln", () => {
    // ABW 3 auf die Bank, ST 15 in die Startelf → 3-4-3
    const r = swap(lineup442, 3, 15);
    expect(r).toMatchObject({
      ok: true,
      lineup: { formation: "3-4-3", bench: { b: [7, 12, 3] } },
    });
    expect(r.ok && validateLineup(r.lineup, squadPlayers)).toEqual([]);
  });

  it("sortiert Bankplätze um", () => {
    const r = swap(lineup442, 7, 15);
    expect(r.ok && r.lineup.bench.b).toEqual([15, 12, 7]);
  });

  it("weist ein unerlaubtes 2-5-3 mit den erlaubten Formationen ab", () => {
    const r343 = swap(lineup442, 3, 15);
    if (!r343.ok) throw new Error("3-4-3 erwartet");
    // ABW 4 raus, MF 12 rein → 2-5-3
    expect(swap(r343.lineup, 4, 12)).toEqual({
      ok: false,
      message:
        "Ein 2-5-3 ist nicht erlaubt. Möglich sind 3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1.",
    });
  });

  it("lässt Torhüter nur mit Torhütern tauschen", () => {
    expect(swap(lineup442, 1, 7)).toEqual({
      ok: false,
      message: "Torhüter tauschen nur mit Torhütern.",
    });
    const r = swap(lineup442, 1, 2);
    expect(r.ok && [r.lineup.starters[0], r.lineup.bench.gk]).toEqual([2, 1]);
  });

  it("hält den Kapitän in der Startelf", () => {
    expect(swap({ ...lineup442, captain: 3 }, 3, 7)).toEqual({
      ok: false,
      message:
        "Der Kapitän bleibt in der Startelf. Wähle zuerst einen anderen Kapitän.",
    });
  });

  it("lässt Starter untereinander unverändert und kennt fremde Spieler nicht", () => {
    expect(swap(lineup442, 3, 4)).toEqual({ ok: true, lineup: lineup442 });
    expect(swap(lineup442, 3, 99)).toEqual({
      ok: false,
      message: "Dieser Spieler steht nicht in deinem Kader.",
    });
  });
});

describe("setCaptain (KONZEPT 2.4)", () => {
  it("macht nur Starter zum Kapitän", () => {
    expect(setCaptain(lineup442, 14)).toEqual({
      ok: true,
      lineup: { ...lineup442, captain: 14 },
    });
    expect(setCaptain(lineup442, 7)).toEqual({
      ok: false,
      message: "Nur ein Spieler aus der Startelf kann Kapitän sein.",
    });
  });
});
