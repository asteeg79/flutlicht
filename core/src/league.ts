// Einladungs- und Reset-Codes (KONZEPT 8.3) und der erste Spieltag neuer Manager (2.6, 2.8).
import { RULES } from "./config/rules";
import { firstLock } from "./locks";
import type { Fixture } from "./schemas/data";
import type { InviteCode, League, ResetCode } from "./schemas/manager";
import { currentMatchday } from "./transfers";

const RESET_VALID_MS = 24 * 60 * 60 * 1000;

/** Eingabe normalisieren: Leerzeichen raus, Großbuchstaben. */
export function normalizeCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

/** Gültiger Einladungscode: vorhanden, nicht widerrufen, nicht benutzt. */
export function findInvite(
  league: League,
  code: string,
): InviteCode | undefined {
  const c = normalizeCode(code);
  return league.invites.find((i) => i.code === c && !i.revoked && !i.usedBy);
}

/** Gültiger Reset-Code: gehört zum Manager, nicht benutzt, jünger als 24 h. */
export function findReset(
  league: League,
  code: string,
  userId: string,
  now: Date,
): ResetCode | undefined {
  const c = normalizeCode(code);
  return league.resets.find(
    (r) =>
      r.code === c &&
      r.userId === userId &&
      !r.usedAt &&
      now.getTime() - Date.parse(r.createdAt) < RESET_VALID_MS,
  );
}

/**
 * Erster gewerteter Spieltag eines neuen Managers: der aktuelle Spieltag, solange
 * dessen erste Sperre noch aussteht, sonst der nächste; nie vor dem ersten
 * gewerteten Spieltag der Saison. Nachzügler starten mit 0 Punkten (2.8).
 */
export function firstMatchdayFor(
  fixtures: readonly Pick<Fixture, "matchday" | "kickoffUtc">[],
  finals: ReadonlyMap<number, Date>,
  now: Date,
  firstScoredMatchday: number,
): number {
  const current = currentMatchday(finals) ?? RULES.matchdays;
  const lock = firstLock(fixtures.filter((f) => f.matchday === current));
  const next = lock !== null && now < lock ? current : current + 1;
  return Math.min(RULES.matchdays, Math.max(firstScoredMatchday, next));
}
