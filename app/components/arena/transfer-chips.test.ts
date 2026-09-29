import { describe, expect, it } from "vitest";
import { transferBoard } from "@/components/arena/transfer-chips";

const open = { open: true as const, matchday: 9 };
const t = (matchday: number, free: boolean) => ({ matchday, free });

describe("transferBoard", () => {
  it("zwei freie, noch nichts gemacht", () => {
    const b = transferBoard(
      { unlimited: false, freeLeft: 2, nextCost: 0 },
      [],
      open,
    );
    expect(b.chips.map((c) => c.label)).toEqual(["Frei", "Frei"]);
    expect([b.big, b.unit, b.note, b.tone]).toEqual([
      "2",
      "frei",
      "danach −5 P. je Transfer",
      "free",
    ]);
  });

  it("Übertrag aus dem Vorspieltag ergibt eine dritte Frei-Marke", () => {
    const b = transferBoard(
      { unlimited: false, freeLeft: 3, nextCost: 0 },
      [],
      open,
    );
    expect(b.chips).toHaveLength(3);
  });

  it("mehr Transfers als frei: ✓ ✓ −5 und gestrichelt + −5, Abzug bisher", () => {
    const b = transferBoard(
      { unlimited: false, freeLeft: 0, nextCost: 5 },
      [t(8, true), t(9, true), t(9, true), t(9, false)],
      open,
    );
    expect(b.chips.map((c) => c.label)).toEqual(["✓", "✓", "−5", "+ −5"]);
    expect([b.big, b.unit, b.note, b.tone]).toEqual([
      "−5",
      "P.",
      "bisher −5 P. Abzug",
      "penalty",
    ]);
  });

  it("alle freien verbraucht, noch kein Abzug", () => {
    const b = transferBoard(
      { unlimited: false, freeLeft: 0, nextCost: 5 },
      [t(9, true), t(9, true)],
      open,
    );
    expect(b.chips.map((c) => c.kind)).toEqual(["used", "used", "next"]);
    expect(b.note).toBe("jeder weitere −5 P.");
  });

  it("unbegrenzt und geschlossen", () => {
    expect(
      transferBoard({ unlimited: true, nextCost: 0 }, [], open),
    ).toMatchObject({ big: "∞", unit: "unbegrenzt", chips: [] });
    expect(
      transferBoard(null, [], { open: false, reopensAfter: 5 }),
    ).toMatchObject({
      big: "Zu",
      note: "öffnet nach Spieltag 5",
      tone: "off",
    });
  });
});
