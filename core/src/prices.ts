// Startpreise, Startbudget und Preisdynamik (KONZEPT 4).
import { MARKET } from "./config/market";
import type { Position } from "./config/rules";
import { isScoredMatchday } from "./participation";
import { clamp, median, round1, subtractMio } from "./rounding";
import type { MarketHistory, MatchdayPoints, Player } from "./schemas/data";
import { priceBefore } from "./trades";

/** Startpreis in Mio. aus dem Marktwert v (Wurzelskala, 4.1). */
export function startPrice(valueEur: number, vMaxEur: number): number {
  const raw = MARKET.startPriceScale * Math.sqrt(valueEur / vMaxEur);
  return clamp(round1(raw), MARKET.startPriceMin, MARKET.startPriceMax);
}

export const VALUE_SOURCES = [
  "manual",
  "tm-crawl",
  "dcaribou",
  "sofascore",
] as const;
export type ValueSourceName = (typeof VALUE_SOURCES)[number];

/**
 * Marktwert für den Startpreis nach Priorität (4.1): ein Admin-Wert gewinnt immer,
 * dann eigener Crawl, dcaribou, Sofascore. Werte ≤ 0 zählen als fehlend.
 */
export function chooseStartValue(
  values: Readonly<Record<ValueSourceName, number | undefined>>,
): { valueEur: number; source: ValueSourceName } | null {
  for (const source of VALUE_SOURCES) {
    const v = values[source];
    if (v !== undefined && v > 0) return { valueEur: v, source };
  }
  return null;
}

/**
 * Preis und Kaufbarkeit beim Import (4.1): Startpreis aus dem Marktwert, kaufbar nur
 * aktive Spieler. Ohne Marktwert gilt der Mindestpreis als Platzhalter, nicht kaufbar,
 * bis der Admin einen Wert einträgt. Ohne Transfermarkt-Zuordnung (meist Nachwuchs)
 * ebenfalls nicht kaufbar, außer mit Admin-Wert.
 */
export function initialPricing(
  value: { valueEur: number; source: ValueSourceName } | null,
  active: boolean,
  tmMapped: boolean,
  vMaxEur: number,
): Pick<Player, "valueSource" | "price" | "purchasable"> {
  if (!value)
    return {
      valueSource: "missing",
      price: MARKET.priceMin,
      purchasable: false,
    };
  return {
    valueSource: value.source,
    price: startPrice(value.valueEur, vMaxEur),
    purchasable: active && (tmMapped || value.source === "manual"),
  };
}

/**
 * Stammspieler (4.2): pro Verein die Spieler mit den meisten Einsatzminuten,
 * bei Gleichstand die kleinere ID zuerst.
 */
export function selectRegulars<P extends { id: number; teamId: number }>(
  players: readonly P[],
  minutes: ReadonlyMap<number, number>,
): P[] {
  const byTeam = new Map<number, P[]>();
  for (const p of players)
    byTeam.set(p.teamId, [...(byTeam.get(p.teamId) ?? []), p]);
  const mins = (p: P) => minutes.get(p.id) ?? 0;
  return [...byTeam.values()].flatMap((team) =>
    [...team]
      .sort((a, b) => mins(b) - mins(a) || a.id - b.id)
      .slice(0, MARKET.regularsPerClub),
  );
}

/** Startbudget in Mio. aus den Preisen der Stammspieler (4.2). */
export function startBudget(regularPrices: readonly number[]): number {
  if (regularPrices.length === 0) throw new Error("Keine Stammspieler-Preise");
  const step = MARKET.budgetStep;
  return Math.ceil((MARKET.budgetFactor * median(regularPrices)) / step) * step;
}

/**
 * Erwartungswert E (4.3): Mittel der Basispunkte der letzten Einsätze.
 * `history` enthält die Basispunkte aller bisherigen Einsätze (> 0 Min.) in
 * zeitlicher Reihenfolge, ohne den aktuellen Spieltag.
 */
export function expectation(
  history: readonly number[],
  position: Position,
): number {
  const recent = history.slice(-MARKET.formWindow);
  if (recent.length === 0) return MARKET.defaultExpectation[position];
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

/** Neuer Preis nach einem finalen Spieltag mit Basispunkten P (4.3). */
export function nextPrice(price: number, P: number, E: number): number {
  const delta = clamp(
    (MARKET.deltaFactor * (P - E)) / MARKET.deltaDivisor,
    -MARKET.deltaCap,
    MARKET.deltaCap,
  );
  return clamp(round1(price * (1 + delta)), MARKET.priceMin, MARKET.priceMax);
}

/** Basispunkte aller finalen Einsätze (> 0 Min.) eines Spielers, nach Spieltag geordnet. */
function finalAppearances(
  points: readonly MatchdayPoints[],
  playerId: number,
): number[] {
  return [...points]
    .filter((md) => md.status === "final")
    .sort((a, b) => a.matchday - b.matchday)
    .flatMap((md) => {
      const pp = md.players[String(playerId)];
      return pp && pp.minutes > 0 ? [pp.base] : [];
    });
}

/** Erwartung E für den nächsten finalen Spieltag, wie `priceTimeline` sie rechnen wird. */
export function expectationFor(
  points: readonly MatchdayPoints[],
  playerId: number,
  position: Position,
): number {
  return expectation(finalAppearances(points, playerId), position);
}

/**
 * Preise Spieltag für Spieltag fortschreiben (4.3). Nur finale, gewertete Spieltage
 * bewegen Preise; E nutzt alle bisherigen finalen Einsätze, auch die vor dem ersten
 * gewerteten Spieltag. Spieler ohne Marktwert und ohne Einsatz behalten ihren Preis.
 */
export function priceTimeline(
  players: readonly Player[],
  points: readonly MatchdayPoints[],
  firstScoredMatchday: number,
): { history: MarketHistory; prices: Map<number, number> } {
  const byId = new Map(players.map((p) => [p.id, p]));
  const prices = new Map(players.map((p) => [p.id, p.price]));
  const appearances = new Map<number, number[]>();
  const history: MarketHistory = {};

  for (const md of [...points].sort((a, b) => a.matchday - b.matchday)) {
    if (md.status !== "final") continue;
    for (const [key, pp] of Object.entries(md.players)) {
      if (pp.minutes <= 0) continue;
      const id = Number(key);
      const past = appearances.get(id) ?? [];
      const player = byId.get(id);
      if (
        isScoredMatchday(md.matchday, firstScoredMatchday) &&
        player &&
        player.valueSource !== "missing"
      ) {
        const price = nextPrice(
          prices.get(id)!,
          pp.base,
          expectation(past, player.position),
        );
        prices.set(id, price);
        const entries = history[key] ?? [];
        entries.push({ matchday: md.matchday, price });
        history[key] = entries;
      }
      appearances.set(id, [...past, pp.base]);
    }
  }
  return { history, prices };
}

/** Letzter Spieltag, für den die Preis-Historie Einträge hat; null ohne Einträge. */
export function lastPricedMatchday(history: MarketHistory): number | null {
  let last: number | null = null;
  for (const entries of Object.values(history))
    for (const e of entries)
      if (last === null || e.matchday > last) last = e.matchday;
  return last;
}

/**
 * Kursänderung durch den letzten Spieltag mit Preisdaten (Ticker, „Heiß gerade“,
 * Trend in der Liste): aktueller Preis − Preis vor diesem Spieltag. Wer an dem
 * Spieltag nicht gespielt hat, hat keinen Eintrag und damit 0.
 */
export function priceChange(
  entries: MarketHistory[string] | undefined,
  price: number,
  start: number,
  lastMatchday: number | null,
): number {
  if (lastMatchday === null) return 0;
  return subtractMio(price, priceBefore(entries ?? [], start, lastMatchday));
}
