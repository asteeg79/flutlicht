// Kaderregeln (KONZEPT 2.2, 2.7).
import { POSITIONS, RULES, type Position } from "./config/rules";
import { toTenths } from "./rounding";
import type { Player } from "./schemas/data";
import { formatMio, type Violation } from "./violations";

export const POSITION_LABELS: Record<Position, string> = {
  GK: "Torhüter",
  DEF: "Abwehrspieler",
  MID: "Mittelfeldspieler",
  FWD: "Stürmer",
};

/** Kaufbar: Marktwert bekannt (`purchasable`) und noch im Bundesliga-Kader (`active`). */
export function isBuyable(p: Pick<Player, "purchasable" | "active">): boolean {
  return p.purchasable && p.active;
}

export type SquadCandidate = Pick<
  Player,
  "id" | "position" | "teamId" | "price" | "purchasable" | "active"
>;

/** Summe von Mio.-Beträgen ohne Fließkomma-Reste. */
export function sumPrices(prices: readonly number[]): number {
  return prices.reduce((sum, p) => sum + toTenths(p), 0) / 10;
}

/** Warum `p` nicht in den entstehenden Erstkader passt; null = passt (2.2, 2.7). */
export function draftAddViolation(
  draft: readonly SquadCandidate[],
  p: SquadCandidate,
  budget: number,
): Violation | null {
  if (!isBuyable(p)) {
    return {
      code: "not-purchasable",
      message: "Dieser Spieler ist derzeit nicht kaufbar.",
      playerId: p.id,
    };
  }
  const need = RULES.squadComposition[p.position];
  if (draft.filter((d) => d.position === p.position).length >= need) {
    return {
      code: "squad-composition",
      message: `Du hast schon ${need} ${POSITION_LABELS[p.position]}.`,
    };
  }
  if (draft.filter((d) => d.teamId === p.teamId).length >= RULES.maxPerClub) {
    return {
      code: "club-limit",
      message: `Von einem Verein darfst du höchstens ${RULES.maxPerClub} Spieler haben.`,
    };
  }
  const cost = sumPrices([...draft.map((d) => d.price), p.price]);
  if (cost > budget) {
    return {
      code: "budget",
      message: `Der Kader wäre zu teuer: ${formatMio(cost)} bei ${formatMio(budget)} Budget.`,
    };
  }
  return null;
}

/** Prüft einen Erstkader: 15 Spieler, 2/5/5/3, Vereinslimit, kaufbar, Budget. */
export function validateSquad(
  players: readonly SquadCandidate[],
  budget: number,
): Violation[] {
  const violations: Violation[] = [];
  const ids = new Set(players.map((p) => p.id));
  if (players.length !== RULES.squadSize || ids.size !== players.length) {
    violations.push({
      code: "squad-size",
      message: `Der Kader braucht genau ${RULES.squadSize} verschiedene Spieler.`,
    });
  }
  for (const pos of POSITIONS) {
    const count = players.filter((p) => p.position === pos).length;
    const need = RULES.squadComposition[pos];
    if (count !== need) {
      violations.push({
        code: "squad-composition",
        message: `Du brauchst genau ${need} ${POSITION_LABELS[pos]} (aktuell ${count}).`,
      });
    }
  }
  const perClub = new Map<number, number>();
  for (const p of players)
    perClub.set(p.teamId, (perClub.get(p.teamId) ?? 0) + 1);
  if ([...perClub.values()].some((n) => n > RULES.maxPerClub)) {
    violations.push({
      code: "club-limit",
      message: `Von einem Verein darfst du höchstens ${RULES.maxPerClub} Spieler haben.`,
    });
  }
  for (const p of players) {
    if (!isBuyable(p)) {
      violations.push({
        code: "not-purchasable",
        message: "Dieser Spieler ist derzeit nicht kaufbar.",
        playerId: p.id,
      });
    }
  }
  const cost = sumPrices(players.map((p) => p.price));
  if (cost > budget) {
    violations.push({
      code: "budget",
      message: `Der Kader ist zu teuer: ${formatMio(cost)} bei ${formatMio(budget)} Budget.`,
    });
  }
  return violations;
}
