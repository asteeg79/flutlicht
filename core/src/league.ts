// Einladungs- und Reset-Codes (KONZEPT 8.3).
import type { InviteCode, League, ResetCode } from "./schemas/manager";

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
