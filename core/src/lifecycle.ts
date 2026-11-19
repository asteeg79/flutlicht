// Lebenszyklus eines Managers (KONZEPT 2.2, 2.6, 2.7, 11): neues Konto, Erstkader,
// Saisonstart verschieben. Reine Übergänge auf dem Dokument; die App lädt und speichert.
import type { MatchdayCalendar } from "./calendar";
import { RULES } from "./config/rules";
import { defaultLineup } from "./lineup";
import { subtractMio } from "./rounding";
import { sumPrices, validateSquad, type SquadCandidate } from "./squad";
import type { ManagerDoc, TransferBank } from "./schemas/manager";
import type { Violation } from "./violations";

/** Spielstand eines neuen Kontos; Name, E-Mail und Passwort setzt die App. */
export type ManagerStart = Pick<
  ManagerDoc,
  | "firstMatchday"
  | "squad"
  | "cash"
  | "lineup"
  | "lineupHistory"
  | "transfers"
  | "transferBank"
>;

/** Transferbank ab dem ersten Spieltag: das normale Kontingent, kein Übertrag. */
function freshBank(matchday: number): TransferBank {
  return { matchday, available: RULES.freeTransfersPerMatchday };
}

export function newManagerState(
  firstMatchday: number,
  startBudget: number,
): ManagerStart {
  return {
    firstMatchday,
    squad: [],
    cash: startBudget,
    lineup: null,
    lineupHistory: {},
    transfers: [],
    transferBank: freshBank(firstMatchday),
  };
}

/**
 * Saisonstart verschoben: Der Startspieltag jedes Kontos zieht mit (2.8), die
 * Transferbank beginnt dort neu. Vor dem ersten gewerteten Spieltag sind alle
 * Transfers unbegrenzt, es geht also nichts verloren.
 */
export function moveToSeasonStart<
  T extends Pick<ManagerDoc, "firstMatchday" | "transferBank">,
>(doc: T, firstMatchday: number): T {
  return { ...doc, firstMatchday, transferBank: freshBank(firstMatchday) };
}

export interface InitialSquadContext {
  players: readonly SquadCandidate[];
  calendar: Pick<MatchdayCalendar, "firstMatchdayFor">;
  now: Date;
  startBudget: number;
  firstScoredMatchday: number;
}

export type InitialSquadResult<T> =
  { ok: true; state: T } | { ok: false; violations: Violation[] };

/**
 * Erstkader (2.2, 2.7): nur solange der Kader leer ist; danach laufen Änderungen
 * über Transfers. Wer ihn erst nach der ersten Sperre seines Startspieltags baut,
 * startet später, nie früher.
 */
export function applyInitialSquad<T extends ManagerStart>(
  doc: T,
  playerIds: readonly number[],
  ctx: InitialSquadContext,
): InitialSquadResult<T & Pick<ManagerDoc, "initialPrices">> {
  if (doc.squad.length > 0)
    return fail(
      "squad-exists",
      "Dein Kader steht schon. Änderungen laufen über Transfers.",
    );
  const byId = new Map(ctx.players.map((p) => [p.id, p]));
  const picked = playerIds.map((id) => byId.get(id));
  if (picked.some((p) => p === undefined))
    return fail("unknown-player", "Unbekannter Spieler.");
  const squad = picked as SquadCandidate[];
  const violations = validateSquad(squad, ctx.startBudget);
  if (violations.length > 0) return { ok: false, violations };

  const firstMatchday = Math.max(
    doc.firstMatchday,
    ctx.calendar.firstMatchdayFor(ctx.now, ctx.firstScoredMatchday),
  );
  return {
    ok: true,
    state: {
      ...doc,
      squad: squad.map((p) => p.id),
      initialPrices: Object.fromEntries(squad.map((p) => [p.id, p.price])),
      cash: subtractMio(ctx.startBudget, sumPrices(squad.map((p) => p.price))),
      lineup: defaultLineup(squad),
      firstMatchday,
      transferBank: freshBank(firstMatchday),
    },
  };
}

/**
 * Darf der Admin den ersten gewerteten Spieltag auf `requested` legen (KONZEPT 11)?
 * Nur vor der ersten Sperre des bisherigen, und `requested` darf weder vor dem
 * aktuellen Spieltag liegen noch schon begonnen haben. null = erlaubt.
 */
export function seasonChangeViolation(
  calendar: Pick<MatchdayCalendar, "current" | "started">,
  firstScoredMatchday: number,
  requested: number,
  now: Date,
): Violation | null {
  if (calendar.started(firstScoredMatchday, now))
    return {
      code: "season-started",
      message:
        "Die Saison läuft schon; Startbudget und erster Spieltag sind fest.",
    };
  const current = calendar.current ?? RULES.matchdays;
  if (requested < current || calendar.started(requested, now))
    return {
      code: "matchday-started",
      message: `Spieltag ${requested} hat schon begonnen. Wähle einen späteren.`,
    };
  return null;
}

function fail(
  code: string,
  message: string,
): { ok: false; violations: Violation[] } {
  return { ok: false, violations: [{ code, message }] };
}
