import { describe, expect, it } from "vitest";
import { activeNavIndex } from "@/components/arena/nav-items";

describe("activeNavIndex", () => {
  it("findet den Eintrag auch für Unterseiten", () => {
    expect(activeNavIndex("/team")).toBe(0);
    expect(activeNavIndex("/spieltag/5")).toBe(2);
    expect(activeNavIndex("/tabelle/bundesliga")).toBe(3);
    expect(activeNavIndex("/einstellungen")).toBe(5);
  });

  it("Spielerprofil gehört zum Markt, Admin zu den Optionen", () => {
    expect(activeNavIndex("/spieler/123")).toBe(1);
    expect(activeNavIndex("/admin")).toBe(5);
  });

  it("ohne Treffer -1, kein falscher Präfix", () => {
    expect(activeNavIndex("/teamx")).toBe(-1);
  });
});
