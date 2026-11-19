// Transferfenster, freie Transfers und Tausch (KONZEPT 2.3, 2.6, 2.7).
import { RULES } from "./config/rules";
import { toTenths } from "./rounding";
import { isBuyable } from "./squad";
import type { Player } from "./schemas/data";
import type {
  Lineup,
  ManagerDoc,
  Transfer,
  TransferBank,
} from "./schemas/manager";
import type { Violation } from "./violations";

/** Transferfenster des aktuellen Spieltags; berechnet vom Spieltags-Kalender. */
export type TransferWindow =
  | { open: false }
  | { open: true; matchday: number; closesAt: Date; isBreak: boolean };
export type OpenTransferWindow = Extract<TransferWindow, { open: true }>;

/** Unbegrenzt: vor dem ersten gewerteten Spieltag des Managers und in Pausen (2.6). */
function isUnlimited(
  window: OpenTransferWindow,
  firstMatchday: number,
): boolean {
  return window.isBreak || window.matchday <= firstMatchday;
}

export type TransferQuote =
  | { unlimited: true; nextCost: 0 }
  | { unlimited: false; freeLeft: number; nextCost: number };

/** Was kostet der nächste Transfer? nextCost = Punktabzug. */
export function transferQuote(
  bank: TransferBank,
  window: OpenTransferWindow,
  firstMatchday: number,
): TransferQuote {
  if (isUnlimited(window, firstMatchday))
    return { unlimited: true, nextCost: 0 };
  return {
    unlimited: false,
    freeLeft: bank.available,
    nextCost: bank.available > 0 ? 0 : RULES.extraTransferPenalty,
  };
}

/**
 * Transferbank bei der Finalisierung von bank.matchday fortschreiben:
 * verfügbar(N+1) = 2 + min(1, ungenutzt(N)). Nach einem unbegrenzten Fenster
 * bleibt der Stand unverändert, dort genutzte oder ungenutzte Transfers zählen nicht.
 */
export function rollTransferBank(
  bank: TransferBank,
  wasUnlimited: boolean,
): TransferBank {
  const available = wasUnlimited
    ? bank.available
    : RULES.freeTransfersPerMatchday +
      Math.min(RULES.maxCarryOver, bank.available);
  return { matchday: bank.matchday + 1, available };
}

export type TransferPlayer = Pick<
  Player,
  "id" | "position" | "teamId" | "price" | "purchasable" | "active"
>;

export type TransferState = Pick<
  ManagerDoc,
  "squad" | "cash" | "lineup" | "transfers" | "transferBank" | "firstMatchday"
>;

export interface TransferContext {
  players: ReadonlyMap<number, TransferPlayer>;
  window: TransferWindow;
  now: Date;
}

export type ApplyTransferResult<T> =
  | { ok: true; state: T; transfer: Transfer; captainChanged: boolean }
  | { ok: false; violations: Violation[] };

const violation = (code: string, message: string): Violation => ({
  code,
  message,
});

/**
 * Kann der Manager gerade überhaupt tauschen? Fenster zu, oder die Transferbank ist
 * noch nicht bis zum aktuellen Spieltag fortgeschrieben (Finalisierung läuft). null = ja.
 */
export function tradeBlocker(
  state: Pick<TransferState, "transferBank" | "firstMatchday">,
  window: TransferWindow,
): Violation | null {
  if (!window.open) {
    return violation("window-closed", "Das Transferfenster ist geschlossen.");
  }
  // Nur gezählte Transfers brauchen die fortgeschriebene Bank; unbegrenzte nicht.
  if (
    !isUnlimited(window, state.firstMatchday) &&
    state.transferBank.matchday !== window.matchday
  ) {
    return violation(
      "bank-stale",
      "Das Transferfenster wird gerade vorbereitet. Bitte versuche es in ein paar Minuten erneut.",
    );
  }
  return null;
}

/** Warum `outId` gerade nicht gegen `inId` getauscht werden kann; null = möglich (2.6, 2.7). */
export function transferViolation(
  state: TransferState,
  outId: number,
  inId: number,
  { window, players }: Pick<TransferContext, "window" | "players">,
): Violation | null {
  const blocked = tradeBlocker(state, window);
  if (blocked) return blocked;
  if (state.lineup === null) {
    return violation("no-squad", "Stelle zuerst deinen Erstkader auf.");
  }
  if (!state.squad.includes(outId)) {
    return violation(
      "not-in-squad",
      "Der abzugebende Spieler ist nicht in deinem Kader.",
    );
  }
  if (state.squad.includes(inId)) {
    return violation(
      "already-in-squad",
      "Dieser Spieler ist bereits in deinem Kader.",
    );
  }
  const pOut = players.get(outId);
  const pIn = players.get(inId);
  if (!pOut || !pIn) return violation("unknown-player", "Unbekannter Spieler.");
  if (pOut.position !== pIn.position) {
    return violation(
      "position",
      "Du kannst nur Spieler derselben Position tauschen.",
    );
  }
  if (!isBuyable(pIn)) {
    return violation(
      "not-purchasable",
      "Dieser Spieler ist derzeit nicht kaufbar.",
    );
  }
  const sameClub = state.squad.filter(
    (id) => id !== outId && players.get(id)?.teamId === pIn.teamId,
  ).length;
  if (sameClub + 1 > RULES.maxPerClub) {
    return violation(
      "club-limit",
      `Von einem Verein darfst du höchstens ${RULES.maxPerClub} Spieler haben.`,
    );
  }
  if (cashAfterTransfer(state.cash, pOut.price, pIn.price) < 0) {
    return violation("cash", "Dein Guthaben reicht für diesen Transfer nicht.");
  }
  return null;
}

/** Guthaben nach dem Tausch: Guthaben + Preis des Abgegebenen − Preis des Neuen, exakt über Zehntel. */
export function cashAfterTransfer(
  cash: number,
  outPrice: number,
  inPrice: number,
): number {
  return (toTenths(cash) + toTenths(outPrice) - toTenths(inPrice)) / 10;
}

/** Tauscht `outId` gegen `inId` (gleiche Position, aktueller Preis, 2.6). */
export function applyTransfer<T extends TransferState>(
  state: T,
  outId: number,
  inId: number,
  ctx: TransferContext,
): ApplyTransferResult<T> {
  const v = transferViolation(state, outId, inId, ctx);
  if (v) return { ok: false, violations: [v] };
  // Nach der Prüfung sicher: Fenster offen, Aufstellung und beide Spieler vorhanden.
  const window = ctx.window as OpenTransferWindow;
  const current = state.lineup!;
  const pOut = ctx.players.get(outId)!;
  const pIn = ctx.players.get(inId)!;
  const unlimited = isUnlimited(window, state.firstMatchday);

  let bank = state.transferBank;
  let free = true;
  if (!unlimited) {
    if (bank.available > 0) bank = { ...bank, available: bank.available - 1 };
    else free = false;
  }
  const transfer: Transfer = {
    at: ctx.now.toISOString(),
    matchday: window.matchday,
    out: outId,
    in: inId,
    priceOut: pOut.price,
    priceIn: pIn.price,
    free,
  };
  const lineup = swapInLineup(current, outId, inId, ctx.players);
  return {
    ok: true,
    state: {
      ...state,
      squad: state.squad.map((id) => (id === outId ? inId : id)),
      cash: cashAfterTransfer(state.cash, pOut.price, pIn.price),
      lineup,
      transfers: [...state.transfers, transfer],
      transferBank: bank,
    },
    transfer,
    captainChanged: current.captain !== lineup.captain,
  };
}

/**
 * Der neue Spieler übernimmt exakt den Platz des verkauften. War der Kapitän,
 * wird der teuerste Starter Kapitän (bei Gleichstand der erste in der Startelf).
 */
function swapInLineup(
  lineup: Lineup,
  outId: number,
  inId: number,
  players: ReadonlyMap<number, TransferPlayer>,
): Lineup {
  const swap = (id: number) => (id === outId ? inId : id);
  const starters = lineup.starters.map(swap);
  const [b1, b2, b3] = lineup.bench.b;
  let captain = lineup.captain;
  if (captain === outId) {
    const price = (id: number) => players.get(id)?.price ?? 0;
    captain = starters.reduce(
      (best, id) => (price(id) > price(best) ? id : best),
      starters[0]!,
    );
  }
  return {
    formation: lineup.formation,
    starters,
    bench: { gk: swap(lineup.bench.gk), b: [swap(b1), swap(b2), swap(b3)] },
    captain,
  };
}
