import { defaultLineup, type Position } from "@fm/core";
import { describe, expect, it } from "vitest";
import { swapPartners } from "@/components/arena/swap-partners";
import { players, SQUAD } from "@/test/fixtures";

const squad = players.filter((p) => SQUAD.includes(p.id));
const lineup = defaultLineup(squad);
const positionOf = (id: number) =>
  squad.find((p) => p.id === id)?.position as Position | undefined;
const none = () => false;

describe("swapPartners", () => {
  it("Starter tauschen nur mit der Bank; Formation muss erlaubt bleiben", () => {
    const starterDef = lineup.starters.find(
      (id) => positionOf(id) === "DEF" && id !== lineup.captain,
    )!;
    const partners = swapPartners(lineup, starterDef, {
      positionOf,
      isLocked: none,
    });
    // Kein anderer Starter, kein Ersatz-TW; die Bank-Feldspieler ja (4-4-2 → 3-5-2 / 3-4-3 / 4-4-2).
    expect([...partners].every((id) => lineup.bench.b.includes(id))).toBe(true);
    expect(partners.size).toBe(3);
  });

  it("Torhüter nur mit Torhüter", () => {
    const gk = lineup.starters.find((id) => positionOf(id) === "GK")!;
    expect([
      ...swapPartners(lineup, gk, { positionOf, isLocked: none }),
    ]).toEqual([lineup.bench.gk]);
  });

  it("fixierte Spieler und der Kapitän sind keine Partner", () => {
    const b1 = lineup.bench.b[0];
    const locked = (id: number) => id === lineup.starters[5];
    const partners = swapPartners(lineup, b1, { positionOf, isLocked: locked });
    expect(partners.has(lineup.starters[5]!)).toBe(false);
    expect(partners.has(lineup.captain)).toBe(false);
  });
});
