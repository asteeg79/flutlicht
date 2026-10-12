import { describe, expect, it } from "vitest";
import {
  expectationFor,
  initialPricing,
  priceTimeline,
  type MatchdayPoints,
  type Player,
} from "../src";

const player = (id: number, over: Partial<Player> = {}): Player => ({
  id,
  name: `S${id}`,
  shortName: `S${id}`,
  teamId: 1,
  position: "MID",
  birthDate: "2000-01-01",
  valueSource: "tm-crawl",
  price: 10,
  purchasable: true,
  active: true,
  ...over,
});
const pp = (base: number, minutes = 90) => ({
  eventId: 1,
  minutes,
  started: true,
  rating: 7,
  parts: {
    rating: 0,
    goals: 0,
    assists: 0,
    cleanSheet: 0,
    conceded: 0,
    penSaved: 0,
    penMissed: 0,
    ownGoals: 0,
    cards: 0,
  },
  base,
});
const md = (
  matchday: number,
  status: MatchdayPoints["status"],
  entries: Record<string, ReturnType<typeof pp>>,
): MatchdayPoints => ({
  matchday,
  status,
  generatedAt: "2026-10-11T08:30:00Z",
  players: entries,
});
const players = [player(10), player(110)];

// Aus pipeline/test/points-market.test.ts übernommen (vorher buildMarket).
describe("priceTimeline (KONZEPT 4.3)", () => {
  it("bewegt Preise erst ab dem ersten gewerteten Spieltag, E aus allen Einsätzen davor", () => {
    const points = [
      md(1, "final", { "10": pp(6) }),
      md(2, "final", { "10": pp(18), "110": pp(0, 0) }),
      md(3, "provisional", { "10": pp(40) }),
    ];
    const { history, prices } = priceTimeline(players, points, 2);
    expect(history).toEqual({ "10": [{ matchday: 2, price: 10.5 }] }); // E = 6, P = 18 → +4.8 %
    expect(prices.get(10)).toBe(10.5);
    expect(prices.get(110)).toBe(10);
  });

  it("nimmt ohne Einsatz-Historie den Standardwert und lässt Spieler ohne Marktwert aus", () => {
    const withMissing = [
      ...players,
      player(30, { valueSource: "missing", price: 0.5 }),
    ];
    const { history } = priceTimeline(
      withMissing,
      [md(8, "final", { "10": pp(4), "30": pp(20) })],
      8,
    );
    expect(history).toEqual({ "10": [{ matchday: 8, price: 10 }] }); // E = 4 → Δ 0
  });
});

describe("expectationFor", () => {
  it("E für den nächsten Spieltag: letzte finale Einsätze, vorläufige zählen nicht", () => {
    const points = [
      md(2, "final", { "10": pp(18) }),
      md(1, "final", { "10": pp(6), "110": pp(0, 0) }),
      md(3, "provisional", { "10": pp(40) }),
    ];
    expect(expectationFor(points, 10, "MID")).toBe(12);
    expect(expectationFor(points, 110, "MID")).toBe(3); // ohne Einsatz: Standardwert
  });
});

describe("initialPricing (KONZEPT 4.1)", () => {
  it("Startpreis aus dem Marktwert, kaufbar nur aktive Spieler", () => {
    expect(
      initialPricing({ valueEur: 35e6, source: "tm-crawl" }, true, true, 140e6),
    ).toEqual({ valueSource: "tm-crawl", price: 12.5, purchasable: true });
    expect(
      initialPricing(
        { valueEur: 35e6, source: "dcaribou" },
        false,
        true,
        140e6,
      ),
    ).toMatchObject({ purchasable: false });
  });

  it("ohne Transfermarkt-Zuordnung nur mit Admin-Wert kaufbar", () => {
    expect(
      initialPricing(
        { valueEur: 35e6, source: "sofascore" },
        true,
        false,
        140e6,
      ),
    ).toEqual({ valueSource: "sofascore", price: 12.5, purchasable: false });
    expect(
      initialPricing({ valueEur: 35e6, source: "manual" }, true, false, 140e6),
    ).toMatchObject({ purchasable: true });
    // Zugeordnet, aber ohne TM-Wert: der Sofascore-Wert genügt.
    expect(
      initialPricing(
        { valueEur: 35e6, source: "sofascore" },
        true,
        true,
        140e6,
      ),
    ).toMatchObject({ purchasable: true });
  });

  it("ohne Marktwert: Platzhalterpreis, nicht kaufbar", () => {
    expect(initialPricing(null, true, true, 140e6)).toEqual({
      valueSource: "missing",
      price: 0.5,
      purchasable: false,
    });
  });
});
