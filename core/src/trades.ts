// Transfer-Historie eines Managers (Seite /historie): gekaufte und verkaufte Spieler mit
// Preisdifferenz. Gewinne sind Guthaben-Veränderungen, gewertet werden nur Punkte (2.7).
import { subtractMio as diff } from "./rounding";
import type { MarketHistory } from "./schemas/data";
import type { Transfer } from "./schemas/manager";
import { sumPrices as sum } from "./squad";

/** Erstkader aus dem heutigen Kader, indem die Transfers rückwärts abgespielt werden. */
export function initialSquad(
  squad: readonly number[],
  transfers: readonly Pick<Transfer, "in" | "out">[],
): number[] {
  const ids = [...squad];
  for (const t of [...transfers].reverse()) {
    ids[ids.indexOf(t.in)] = t.out;
  }
  return ids;
}

/** Preis eines Spielers vor Spieltag n: letzter Stand danach eines früheren Spieltags, sonst Startpreis. */
export function priceBefore(
  history: MarketHistory[string],
  start: number,
  matchday: number,
): number {
  const earlier = history.filter((h) => h.matchday < matchday);
  return earlier.length > 0 ? earlier[earlier.length - 1]!.price : start;
}

export interface SoldHolding {
  playerId: number;
  /** null = Erstkader. */
  boughtMatchday: number | null;
  buyPrice: number;
  soldMatchday: number;
  sellPrice: number;
  diff: number;
}

export interface HeldHolding {
  playerId: number;
  boughtMatchday: number | null;
  buyPrice: number;
  currentPrice: number;
  diff: number;
}

/**
 * Jeder Kauf ist ein Posten; ein Verkauf schließt den offenen Posten des Spielers.
 * Verkauft: neueste zuerst. Im Kader: zuletzt gekaufte zuerst, dann Erstkader.
 */
export function tradeHistory(input: {
  squad: readonly number[];
  transfers: readonly Transfer[];
  initialPrice: (id: number) => number;
  currentPrice: (id: number) => number;
}): {
  sold: SoldHolding[];
  held: HeldHolding[];
  realized: number;
  unrealized: number;
} {
  const open = new Map<
    number,
    { boughtMatchday: number | null; buyPrice: number }
  >();
  for (const id of initialSquad(input.squad, input.transfers)) {
    open.set(id, { boughtMatchday: null, buyPrice: input.initialPrice(id) });
  }
  const sold: SoldHolding[] = [];
  for (const t of input.transfers) {
    const bought = open.get(t.out);
    if (bought) {
      sold.push({
        playerId: t.out,
        ...bought,
        soldMatchday: t.matchday,
        sellPrice: t.priceOut,
        diff: diff(t.priceOut, bought.buyPrice),
      });
      open.delete(t.out);
    }
    open.set(t.in, { boughtMatchday: t.matchday, buyPrice: t.priceIn });
  }
  const held = input.squad
    .filter((id) => open.has(id))
    .map((id): HeldHolding => {
      const { boughtMatchday, buyPrice } = open.get(id)!;
      const currentPrice = input.currentPrice(id);
      return {
        playerId: id,
        boughtMatchday,
        buyPrice,
        currentPrice,
        diff: diff(currentPrice, buyPrice),
      };
    })
    .sort((a, b) => (b.boughtMatchday ?? 0) - (a.boughtMatchday ?? 0));
  sold.reverse();
  return {
    sold,
    held,
    realized: sum(sold.map((s) => s.diff)),
    unrealized: sum(held.map((h) => h.diff)),
  };
}

export interface LedgerTransfer {
  out: number;
  in: number;
  priceOut: number;
  priceIn: number;
  /** Realisierter Gewinn des verkauften Spielers (Verkaufs- minus Kaufpreis). */
  gain: number;
}

export interface LedgerRow {
  matchday: number;
  /** Transfers im Fenster vor diesem Spieltag. */
  transfers: LedgerTransfer[];
  /**
   * null, solange der Spieltag nicht final gewertet ist. earned = Kaderwert-Änderung +
   * Prämie; Verkaufsgewinne stecken schon in früheren Kaderwert-Änderungen.
   */
  result: {
    points: number;
    valueChange: number;
    bonus: number;
    earned: number;
  } | null;
}

/**
 * Verlauf je Spieltag, neueste zuerst: wer kam und ging (mit Gewinn) und, für final
 * gewertete Spieltage, Punkte, Kaderwert-Änderung der damals gehaltenen Spieler und Prämie.
 * `priceAt(id, n)` = Preis vor Spieltag n; `sold` aus tradeHistory.
 */
export function matchdayLedger(input: {
  squad: readonly number[];
  transfers: readonly Transfer[];
  sold: readonly SoldHolding[];
  priceAt: (id: number, matchday: number) => number;
  scored: ReadonlyMap<number, { points: number; bonus: number }>;
}): LedgerRow[] {
  const gain = new Map(
    input.sold.map((s) => [`${s.playerId}@${s.soldMatchday}`, s.diff]),
  );
  const matchdays = [
    ...new Set([
      ...input.scored.keys(),
      ...input.transfers.map((t) => t.matchday),
    ]),
  ].sort((a, b) => b - a);
  const start = initialSquad(input.squad, input.transfers);
  return matchdays.map((md): LedgerRow => {
    const transfers = input.transfers
      .filter((t) => t.matchday === md)
      .map((t) => ({
        out: t.out,
        in: t.in,
        priceOut: t.priceOut,
        priceIn: t.priceIn,
        gain: gain.get(`${t.out}@${md}`) ?? 0,
      }));
    const score = input.scored.get(md);
    if (!score) return { matchday: md, transfers, result: null };
    const held = [...start];
    for (const t of input.transfers.filter((t) => t.matchday <= md)) {
      held[held.indexOf(t.out)] = t.in;
    }
    const valueChange = sum(
      held.map((id) => diff(input.priceAt(id, md + 1), input.priceAt(id, md))),
    );
    return {
      matchday: md,
      transfers,
      result: {
        points: score.points,
        valueChange,
        bonus: score.bonus,
        earned: sum([valueChange, score.bonus]),
      },
    };
  });
}
