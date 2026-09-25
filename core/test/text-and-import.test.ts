import { describe, expect, it } from "vitest";
import {
  alnumKey,
  chooseStartValue,
  foldDiacritics,
  selectRegulars,
} from "../src";

describe("Namensabgleich (text.ts)", () => {
  it("entfernt Diakritika und Sonderzeichen", () => {
    expect(foldDiacritics("Farès Chaïbi")).toBe("fares chaibi");
    expect(alnumKey("Zeno Van Den Bosch")).toBe("zenovandenbosch");
  });
  it("schreibt Buchstaben ohne Zerlegung um", () => {
    expect(alnumKey("Frederik Rønnow")).toBe(alnumKey("Frederik Rönnow"));
    expect(alnumKey("Łukasz SSæ")).toBe("lukaszssae");
  });
});

describe("chooseStartValue (KONZEPT 4.1)", () => {
  const none = {
    manual: undefined,
    "tm-crawl": undefined,
    dcaribou: undefined,
    sofascore: undefined,
  };
  it("nimmt Crawl vor dcaribou vor Sofascore", () => {
    expect(
      chooseStartValue({ ...none, "tm-crawl": 5, dcaribou: 4, sofascore: 3 }),
    ).toEqual({ valueEur: 5, source: "tm-crawl" });
    expect(chooseStartValue({ ...none, dcaribou: 4, sofascore: 3 })).toEqual({
      valueEur: 4,
      source: "dcaribou",
    });
    expect(chooseStartValue({ ...none, sofascore: 3 })).toEqual({
      valueEur: 3,
      source: "sofascore",
    });
  });
  it("lässt einen Admin-Wert immer gewinnen", () => {
    expect(chooseStartValue({ ...none, manual: 1, "tm-crawl": 5 })).toEqual({
      valueEur: 1,
      source: "manual",
    });
  });
  it("wertet 0 als fehlend und gibt ohne Wert null zurück", () => {
    expect(
      chooseStartValue({ ...none, "tm-crawl": 0, sofascore: 2 })?.source,
    ).toBe("sofascore");
    expect(chooseStartValue(none)).toBeNull();
  });
});

describe("selectRegulars (KONZEPT 4.2)", () => {
  it("nimmt je Verein die 11 Spieler mit den meisten Minuten", () => {
    const players = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      teamId: i < 15 ? 1 : 2,
    }));
    const minutes = new Map(players.map((p) => [p.id, p.id * 10]));
    const regulars = selectRegulars(players, minutes);
    expect(regulars).toHaveLength(22);
    expect(regulars.filter((p) => p.teamId === 1).map((p) => p.id)).toEqual([
      15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5,
    ]);
  });
  it("füllt mit Spielern ohne Minuten auf, kleinere ID zuerst", () => {
    const players = [
      { id: 3, teamId: 1 },
      { id: 1, teamId: 1 },
      { id: 2, teamId: 1 },
    ];
    expect(
      selectRegulars(players, new Map([[2, 90]])).map((p) => p.id),
    ).toEqual([2, 1, 3]);
  });
});
