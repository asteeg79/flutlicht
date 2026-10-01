// Anzeige-Logik des Markts (Arena 5): Kurzformen von Regelverstößen, „Heiß gerade“,
// Kurs-Ticker, Sortierung, Filter in der Adresse. Die Regeln selbst stehen in core.
import {
  formatMio,
  POSITION_LABELS,
  POSITIONS,
  RULES,
  subtractMio,
  sumPrices,
  type PlayerStats,
  type Position,
  type Violation,
} from "@fm/core";

export interface TradePlayer {
  id: number;
  position: Position;
  teamId: number;
  price: number;
  delta: number;
}

export type Sort = "price-desc" | "price-asc" | "points" | "form";

const mio = (n: number) => formatMio(n).replace(" Mio.", " Mio");

/** Kurzform für die Zeile: „schon 5 von Bayern“, „fehlen 1,2 Mio“, „Position voll“. */
export function shortReason(
  v: Violation,
  ctx: { club?: string; missing?: number },
): string {
  switch (v.code) {
    case "not-purchasable":
      return "nicht kaufbar";
    case "squad-composition":
      return "Position voll";
    case "club-limit":
      return `schon ${RULES.maxPerClub} von ${ctx.club ?? "diesem Verein"}`;
    case "budget":
      return "zu teuer";
    case "cash":
      return ctx.missing !== undefined
        ? `fehlen ${mio(ctx.missing)}`
        : "Guthaben reicht nicht";
    default:
      return v.message;
  }
}

/** Fehlbetrag eines Tauschs: Preis des Neuen − (Guthaben + Preis des Abgegebenen). */
export function missingCash(
  cash: number,
  outPrice: number,
  inPrice: number,
): number {
  return subtractMio(inPrice, sumPrices([cash, outPrice]));
}

/** Toast-Text, wenn ein Erstkader-Kandidat nicht passt (Arena 7). */
export function draftExplanation(
  v: Violation,
  p: { shortName: string; position: Position; price: number },
  ctx: { club?: string; remaining: number },
): string {
  switch (v.code) {
    case "budget":
      return `${p.shortName} kostet ${mio(p.price)} – du hast noch ${mio(ctx.remaining)}.`;
    case "squad-composition":
      return `${POSITION_LABELS[p.position]} ist voll – nimm erst einen raus.`;
    case "club-limit":
      return `Höchstens ${RULES.maxPerClub} Spieler von ${ctx.club ?? "einem Verein"}.`;
    default:
      return v.message;
  }
}

/** Top 5 mit dem größten Preisanstieg, nicht im eigenen Kader. */
export function hotPlayers<P extends TradePlayer>(
  players: readonly P[],
  squad: ReadonlySet<number>,
): P[] {
  return players
    .filter((p) => p.delta > 0 && !squad.has(p.id))
    .sort((a, b) => b.delta - a.delta || b.price - a.price)
    .slice(0, 5);
}

/** Top 10 nach Betrag der Kursänderung (▲ und ▼). */
export function tickerPlayers<P extends TradePlayer>(
  players: readonly P[],
): P[] {
  return players
    .filter((p) => p.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.price - a.price)
    .slice(0, 10);
}

export function sorter(sort: Sort, stats: Record<string, PlayerStats>) {
  return (a: TradePlayer, b: TradePlayer): number => {
    if (sort === "price-asc") return a.price - b.price || a.id - b.id;
    if (sort === "points")
      return (
        (stats[b.id]?.points ?? 0) - (stats[a.id]?.points ?? 0) ||
        b.price - a.price
      );
    if (sort === "form")
      return (
        (stats[b.id]?.form ?? -Infinity) - (stats[a.id]?.form ?? -Infinity) ||
        b.price - a.price
      );
    return b.price - a.price || a.id - b.id;
  };
}

export interface MarketFilters {
  pos: Position | "ALL";
  team: number | "ALL";
  sort: Sort;
  query: string;
}

const SORTS: readonly Sort[] = ["price-desc", "price-asc", "points", "form"];

/**
 * Filter aus der Adresse (`?pos=FWD&verein=2673&sort=points&suche=mu`). Sie stehen dort,
 * damit „Zurück“ aus dem Spielerprofil sie wiederherstellt. Ungültiges fällt auf den
 * Standard zurück.
 */
export function filtersFromParams(
  params: { get(name: string): string | null },
  teamIds: ReadonlySet<number>,
): MarketFilters {
  const pos = params.get("pos") as Position;
  const team = Number(params.get("verein"));
  const sort = params.get("sort") as Sort;
  return {
    pos: POSITIONS.includes(pos) ? pos : "ALL",
    team: teamIds.has(team) ? team : "ALL",
    sort: SORTS.includes(sort) ? sort : "price-desc",
    query: params.get("suche") ?? "",
  };
}

/** Suchteil der Adresse mit den Filtern: Standardwerte entfallen, fremde Parameter bleiben. */
export function filtersToSearch(search: string, f: MarketFilters): string {
  const params = new URLSearchParams(search);
  const set = (name: string, value: string | null) =>
    value === null ? params.delete(name) : params.set(name, value);
  set("pos", f.pos === "ALL" ? null : f.pos);
  set("verein", f.team === "ALL" ? null : String(f.team));
  set("sort", f.sort === "price-desc" ? null : f.sort);
  set("suche", f.query === "" ? null : f.query);
  const text = params.toString();
  return text ? `?${text}` : "";
}
