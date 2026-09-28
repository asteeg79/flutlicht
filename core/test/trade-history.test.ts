import { describe, expect, it } from "vitest";
import {
  initialSquad,
  matchdayLedger,
  priceBefore,
  tradeHistory,
  type Transfer,
} from "../src";

const t = (
  matchday: number,
  out: number,
  inId: number,
  priceOut: number,
  priceIn: number,
): Transfer => ({
  at: `2026-11-0${matchday - 8}T10:00:00Z`,
  matchday,
  out,
  in: inId,
  priceOut,
  priceIn,
  free: true,
});

describe("initialSquad", () => {
  it("spielt die Transfers rückwärts ab", () => {
    const transfers = [t(9, 1, 20, 5, 4), t(10, 20, 21, 4.5, 6)];
    expect(initialSquad([21, 2, 3], transfers).sort()).toEqual([1, 2, 3]);
  });
});

describe("priceBefore", () => {
  const history = [
    { matchday: 8, price: 5.2 },
    { matchday: 9, price: 5.5 },
  ];
  it("Preis vor einem Spieltag: letzter Stand davor, sonst Startpreis", () => {
    expect(priceBefore(history, 5, 8)).toBe(5);
    expect(priceBefore(history, 5, 9)).toBe(5.2);
    expect(priceBefore(history, 5, 12)).toBe(5.5);
    expect(priceBefore([], 3.8, 8)).toBe(3.8);
  });
});

describe("tradeHistory", () => {
  const initial = new Map([
    [1, 5],
    [2, 3],
    [3, 7.5],
  ]);
  const current = new Map([
    [2, 3.4],
    [3, 7.1],
    [21, 6.3],
    [1, 5.9],
  ]);
  const history = (transfers: Transfer[], squad: number[]) =>
    tradeHistory({
      squad,
      transfers,
      initialPrice: (id) => initial.get(id)!,
      currentPrice: (id) => current.get(id)!,
    });

  it("Verkauf mit Gewinn, Weiterverkauf mit Verlust, offene Posten zum aktuellen Preis", () => {
    const r = history([t(9, 1, 20, 5.8, 4), t(10, 20, 21, 3.7, 6)], [21, 2, 3]);
    expect(r.sold).toEqual([
      {
        playerId: 20,
        boughtMatchday: 9,
        buyPrice: 4,
        soldMatchday: 10,
        sellPrice: 3.7,
        diff: -0.3,
      },
      {
        playerId: 1,
        boughtMatchday: null,
        buyPrice: 5,
        soldMatchday: 9,
        sellPrice: 5.8,
        diff: 0.8,
      },
    ]);
    expect(r.held).toEqual([
      {
        playerId: 21,
        boughtMatchday: 10,
        buyPrice: 6,
        currentPrice: 6.3,
        diff: 0.3,
      },
      {
        playerId: 2,
        boughtMatchday: null,
        buyPrice: 3,
        currentPrice: 3.4,
        diff: 0.4,
      },
      {
        playerId: 3,
        boughtMatchday: null,
        buyPrice: 7.5,
        currentPrice: 7.1,
        diff: -0.4,
      },
    ]);
    expect(r.realized).toBe(0.5);
    expect(r.unrealized).toBe(0.3);
  });

  it("Spieler zurückgekauft: zwei getrennte Posten", () => {
    const r = history([t(9, 1, 20, 5.8, 4), t(10, 20, 1, 4.2, 6)], [1, 2, 3]);
    expect(r.sold.map((s) => [s.playerId, s.diff])).toEqual([
      [20, 0.2],
      [1, 0.8],
    ]);
    expect(r.held[0]).toMatchObject({
      playerId: 1,
      boughtMatchday: 10,
      buyPrice: 6,
    });
  });

  it("ohne Transfers: nur der Erstkader", () => {
    const r = history([], [1, 2, 3]);
    expect(r.sold).toEqual([]);
    expect(r.held.map((h) => h.diff)).toEqual([0.9, 0.4, -0.4]);
    expect(r.realized).toBe(0);
    expect(r.unrealized).toBe(0.9);
  });
});

describe("matchdayLedger (Verlauf je Spieltag)", () => {
  // Erstkader 1, 2, 3 zum Preis 5; vor Spieltag 9 wird 1 gegen 20 getauscht.
  const transfers = [t(9, 1, 20, 5.4, 4)];
  const squad = [20, 2, 3];
  // Spieler 1: 5 → 5,4 nach Sp. 8; Spieler 2: 5 → 5,2 nach Sp. 8 → 5,0 nach Sp. 9;
  // Spieler 20: 4 → 4,3 nach Sp. 9; Spieler 3 bleibt bei 5.
  const history: Record<number, { matchday: number; price: number }[]> = {
    1: [{ matchday: 8, price: 5.4 }],
    2: [
      { matchday: 8, price: 5.2 },
      { matchday: 9, price: 5 },
    ],
    20: [{ matchday: 9, price: 4.3 }],
  };
  const start: Record<number, number> = { 1: 5, 2: 5, 3: 5, 20: 4 };
  const priceAt = (id: number, md: number) =>
    priceBefore(history[id] ?? [], start[id]!, md);
  const { sold } = tradeHistory({
    squad,
    transfers,
    initialPrice: () => 5,
    currentPrice: () => 0,
  });
  const scored = new Map([
    [8, { points: 51, bonus: 0.4 }],
    [9, { points: 38, bonus: 0 }],
  ]);

  it("rechnet Kaderwert, Prämie und Punkte je Spieltag, Transfers mit Gewinn", () => {
    const rows = matchdayLedger({ squad, transfers, sold, priceAt, scored });
    expect(rows).toEqual([
      {
        matchday: 9,
        transfers: [{ out: 1, in: 20, priceOut: 5.4, priceIn: 4, gain: 0.4 }],
        // 2: −0,2 · 3: 0 · 20: +0,3
        result: { points: 38, valueChange: 0.1, bonus: 0, earned: 0.1 },
      },
      {
        matchday: 8,
        transfers: [],
        // 1: +0,4 · 2: +0,2 · 3: 0
        result: { points: 51, valueChange: 0.6, bonus: 0.4, earned: 1 },
      },
    ]);
  });

  it("zeigt Transfers auch vor dem ersten gewerteten Spieltag, ohne Ergebnis", () => {
    const rows = matchdayLedger({
      squad,
      transfers,
      sold,
      priceAt,
      scored: new Map(),
    });
    expect(rows).toEqual([
      {
        matchday: 9,
        transfers: [{ out: 1, in: 20, priceOut: 5.4, priceIn: 4, gain: 0.4 }],
        result: null,
      },
    ]);
  });
});
