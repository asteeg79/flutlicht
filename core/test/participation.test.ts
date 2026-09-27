import { describe, expect, it } from "vitest";
import { isScoredMatchday, isShadowMatchday, participation } from "../src";

describe("Welche Spieltage zählen (KONZEPT 2.7, 2.8)", () => {
  it("gewertet ab dem Saisonstart, Schatten genau am Spieltag davor", () => {
    expect(isScoredMatchday(8, 8)).toBe(true);
    expect(isScoredMatchday(7, 8)).toBe(false);
    expect(isShadowMatchday(7, 8)).toBe(true);
    expect(isShadowMatchday(6, 8)).toBe(false);
  });

  it("je Manager: gewertet ab dem späteren von eigenem Start und Saisonstart", () => {
    expect(participation({ firstMatchday: 8 }, 8, 8)).toBe("scored");
    // Saisonstart auf 9 verschoben: Spieltag 8 läuft dann im Schattenbetrieb.
    expect(participation({ firstMatchday: 8 }, 8, 9)).toBe("shadow");
    expect(participation({ firstMatchday: 8 }, 7, 9)).toBeNull();
    expect(participation({ firstMatchday: 8 }, 9, 9)).toBe("scored");
    expect(participation({ firstMatchday: 12 }, 11, 8)).toBeNull();
  });
});
