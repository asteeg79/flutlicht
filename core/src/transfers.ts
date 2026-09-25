// Transferfenster, freie Transfers und Tausch (KONZEPT 2.3, 2.6, 2.7).
import { RULES } from "./config/rules";
import { firstLock } from "./locks";
import { toTenths } from "./rounding";
import type { Fixture, Player } from "./schemas/data";
import type {
  Lineup,
  ManagerDoc,
  Transfer,
  TransferBank,
} from "./schemas/manager";
import type { Violation } from "./violations";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Aktueller Spieltag: der kleinste, der noch nicht final ist (2.1). null nach dem 34. */
export function currentMatchday(
  finals: ReadonlyMap<number, Date>,
): number | null {
  for (let md = 1; md <= RULES.matchdays; md++) if (!finals.has(md)) return md;
  return null;
}

/** Pause: zwischen Finalisierung und erster Sperre liegen ≥ 10 Tage. Saisonstart zählt als Pause. */
export function isBreakWindow(opensAt: Date | null, closesAt: Date): boolean {
  if (opensAt === null) return true;
  return closesAt.getTime() - opensAt.getTime() >= RULES.breakMinDays * DAY_MS;
}

export type TransferWindow =
  | { open: false }
  | { open: true; matchday: number; closesAt: Date; isBreak: boolean };
export type OpenTransferWindow = Extract<TransferWindow, { open: true }>;

/**
 * Transferfenster für den aktuellen Spieltag N: offen ab der Finalisierung von N−1
 * bis zur ersten Sperre von N. `finals` = finalisierte Spieltage → Zeitpunkt der Finalisierung.
 */
export function transferWindow(
  fixtures: readonly Pick<Fixture, "matchday" | "kickoffUtc">[],
  finals: ReadonlyMap<number, Date>,
  now: Date,
): TransferWindow {
  const matchday = currentMatchday(finals);
  if (matchday === null) return { open: false };
  const closesAt = firstLock(fixtures.filter((f) => f.matchday === matchday));
  if (closesAt === null || now >= closesAt) return { open: false };
  const opensAt = finals.get(matchday - 1) ?? null;
  return {
    open: true,
    matchday,
    closesAt,
    isBreak: isBreakWindow(opensAt, closesAt),
  };
}

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

const fail = (code: string, message: string) => ({
  ok: false as const,
  violations: [{ code, message }],
});

/** Tauscht `outId` gegen `inId` (gleiche Position, aktueller Preis, 2.6). */
export function applyTransfer<T extends TransferState>(
  state: T,
  outId: number,
  inId: number,
  ctx: TransferContext,
): ApplyTransferResult<T> {
  const { window, players } = ctx;
  if (!window.open) {
    return fail("window-closed", "Das Transferfenster ist geschlossen.");
  }
  const unlimited = isUnlimited(window, state.firstMatchday);
  // Nur gezählte Transfers brauchen die fortgeschriebene Bank; unbegrenzte nicht.
  if (!unlimited && state.transferBank.matchday !== window.matchday) {
    return fail(
      "bank-stale",
      "Das Transferfenster wird gerade vorbereitet. Bitte versuche es in ein paar Minuten erneut.",
    );
  }
  if (state.lineup === null) {
    return fail("no-squad", "Stelle zuerst deinen Erstkader auf.");
  }
  if (!state.squad.includes(outId)) {
    return fail(
      "not-in-squad",
      "Der abzugebende Spieler ist nicht in deinem Kader.",
    );
  }
  if (state.squad.includes(inId)) {
    return fail(
      "already-in-squad",
      "Dieser Spieler ist bereits in deinem Kader.",
    );
  }
  const pOut = players.get(outId);
  const pIn = players.get(inId);
  if (!pOut || !pIn) return fail("unknown-player", "Unbekannter Spieler.");
  if (pOut.position !== pIn.position) {
    return fail(
      "position",
      "Du kannst nur Spieler derselben Position tauschen.",
    );
  }
  if (!pIn.purchasable || !pIn.active) {
    return fail("not-purchasable", "Dieser Spieler ist derzeit nicht kaufbar.");
  }
  const sameClub = state.squad.filter(
    (id) => id !== outId && players.get(id)?.teamId === pIn.teamId,
  ).length;
  if (sameClub + 1 > RULES.maxPerClub) {
    return fail(
      "club-limit",
      `Von einem Verein darfst du höchstens ${RULES.maxPerClub} Spieler haben.`,
    );
  }
  const cashTenths =
    toTenths(state.cash) + toTenths(pOut.price) - toTenths(pIn.price);
  if (cashTenths < 0) {
    return fail("cash", "Dein Guthaben reicht für diesen Transfer nicht.");
  }

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
  const lineup = swapInLineup(state.lineup, outId, inId, players);
  return {
    ok: true,
    state: {
      ...state,
      squad: state.squad.map((id) => (id === outId ? inId : id)),
      cash: cashTenths / 10,
      lineup,
      transfers: [...state.transfers, transfer],
      transferBank: bank,
    },
    transfer,
    captainChanged: state.lineup.captain !== lineup.captain,
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
    captain = starters.reduce((best, id) =>
      price(id) > price(best) ? id : best,
    );
  }
  return {
    formation: lineup.formation,
    starters,
    bench: { gk: swap(lineup.bench.gk), b: [swap(b1), swap(b2), swap(b3)] },
    captain,
  };
}
