// Transfer-Historie eines Managers (Seite /historie): gekaufte und verkaufte Spieler mit
// Preisdifferenz. Gewinne sind Guthaben-Veränderungen, gewertet werden nur Punkte (2.7).
import { toTenths } from "./rounding";
import type { MarketHistory } from "./schemas/data";
import type { Transfer } from "./schemas/manager";

const diff = (a: number, b: number) => (toTenths(a) - toTenths(b)) / 10;
const sum = (xs: readonly number[]) =>
  xs.reduce((s, x) => s + toTenths(x), 0) / 10;

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
