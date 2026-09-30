import { describe, expect, it } from "vitest";
import {
  expectation,
  lastPricedMatchday,
  nextPrice,
  priceChange,
  startBudget,
  startPrice,
} from "../src";

describe("startPrice (KONZEPT 4.1)", () => {
  const vMax = 140_000_000;
  it.each([
    [140_000_000, 25.0],
    [35_000_000, 12.5],
    [8_750_000, 6.3],
    [500_000, 1.5],
    [50_000, 0.5],
  ])("Beispiel bei vMax = 140 Mio.: %d → %d", (v, price) => {
    expect(startPrice(v, vMax)).toBe(price);
  });
  it("hält die Obergrenze 25 ein", () => {
    expect(startPrice(200_000_000, vMax)).toBe(25);
  });
});

describe("startBudget (KONZEPT 4.2)", () => {
  it("Beispiel: Median 4.2 → 63 → 65 Mio.", () => {
    expect(startBudget([3.0, 4.2, 9.0])).toBe(65);
  });
  it("bildet bei gerader Anzahl das Mittel der beiden mittleren Preise", () => {
    expect(startBudget([4.1, 4.3, 1.0, 9.9])).toBe(65);
  });
  it("rundet ein glattes Vielfaches von 5 nicht auf", () => {
    expect(startBudget([4.0])).toBe(60);
  });
  it("lehnt eine leere Liste ab", () => {
    expect(() => startBudget([])).toThrow();
  });
});

describe("nextPrice (KONZEPT 4.3, Preis 10.0 und E = 6)", () => {
  it("P = 18 → +4.8 % → 10.5", () => {
    expect(nextPrice(10.0, 18, 6)).toBe(10.5);
  });
  it("P = −4 → −4 % → 9.6", () => {
    expect(nextPrice(10.0, -4, 6)).toBe(9.6);
  });
  it("P = 40 → +8 % (Deckel) → 10.8", () => {
    expect(nextPrice(10.0, 40, 6)).toBe(10.8);
  });
  it("deckelt auch nach unten bei −8 %", () => {
    expect(nextPrice(10.0, -100, 6)).toBe(9.2);
  });
  it("hält die Preisgrenzen 0.5 und 30 ein", () => {
    expect(nextPrice(0.5, -100, 6)).toBe(0.5);
    expect(nextPrice(29.9, 100, 0)).toBe(30);
  });
});

describe("expectation (KONZEPT 4.3)", () => {
  it("nimmt ohne Einsatz-Historie den Standardwert der Position", () => {
    expect(expectation([], "GK")).toBe(4);
    expect(expectation([], "FWD")).toBe(4);
  });
  it("mittelt die letzten 5 Einsätze", () => {
    expect(expectation([100, 1, 2, 3, 4, 5], "MID")).toBe(3);
  });
  it("mittelt weniger als 5 Einsätze vollständig", () => {
    expect(expectation([2, 7], "DEF")).toBe(4.5);
  });
});

describe("Kursänderung seit dem letzten Spieltag", () => {
  const history = {
    "1": [
      { matchday: 8, price: 10.4 },
      { matchday: 9, price: 10.9 },
    ],
    "2": [{ matchday: 8, price: 5.1 }],
  };

  it("letzter Spieltag mit Preisdaten über alle Spieler", () => {
    expect(lastPricedMatchday(history)).toBe(9);
    expect(lastPricedMatchday({})).toBeNull();
  });

  it("aktueller Preis minus Preis vor dem letzten Spieltag, ohne Fließkomma-Rest", () => {
    expect(priceChange(history["1"], 10.9, 10, 9)).toBe(0.5);
    // Kein Eintrag am letzten Spieltag: unverändert.
    expect(priceChange(history["2"], 5.1, 5.4, 9)).toBe(0);
    // Erster Spieltag mit Preisen: gegenüber dem Startpreis.
    expect(priceChange([{ matchday: 8, price: 5.1 }], 5.1, 5.4, 8)).toBe(-0.3);
  });

  it("ohne Historie oder ohne Einträge des Spielers 0", () => {
    expect(priceChange(undefined, 8, 8, null)).toBe(0);
    expect(priceChange(undefined, 8, 8, 9)).toBe(0);
  });
});
