// Registrierung mit Einladungscode und Passwort-Reset mit Admin-Code (KONZEPT 8.2, 8.3).
import { randomUUID } from "node:crypto";
import {
  findInvite,
  findReset,
  matchdayCalendar,
  newManagerState,
  type ManagerDoc,
} from "@fm/core";
import { z } from "zod";
import { BadRequest, Conflict, parse } from "@/lib/errors";
import { finals, gameData } from "@/lib/game-data";
import { updateManager } from "@/lib/manager-writes";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import {
  loadEmailIndex,
  loadLeague,
  loadManager,
  saveEmailIndex,
  saveLeague,
  saveManager,
} from "@/lib/storage";

const Email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Bitte gib eine gültige E-Mail-Adresse ein."));
const Password = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`,
  );
/** Name mit Meldungen im richtigen Fall: „einen Anzeigenamen“, „der Anzeigename“. */
const Name = (accusative: string, nominative: string) =>
  z
    .string()
    .trim()
    .min(1, `Bitte gib einen ${accusative} ein.`)
    .max(40, `Der ${nominative} darf höchstens 40 Zeichen haben.`);

const Profile = {
  displayName: Name("Anzeigenamen", "Anzeigename"),
  teamName: Name("Teamnamen", "Teamname"),
};

export const RegisterInput = z.object({
  email: Email,
  password: Password,
  ...Profile,
  inviteCode: z.string().optional(),
});

export const ProfileInput = z.object(Profile);

export const ResetInput = z.object({
  email: Email,
  code: z.string(),
  password: Password,
});

/** Admin ist, wer mit einer E-Mail aus ADMIN_EMAILS registriert (KONZEPT 8.3). */
export function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email);
}

const INVALID_INVITE = "Der Einladungscode ist ungültig oder schon benutzt.";
const INVALID_RESET =
  "E-Mail oder Reset-Code passen nicht. Codes gelten 24 Stunden und nur einmal.";

/**
 * Legt einen Manager an. Admins (ADMIN_EMAILS) brauchen keinen Einladungscode:
 * sonst könnte der erste Admin sich nie registrieren, denn Codes erzeugt nur er.
 */
export async function registerManager(
  raw: unknown,
  now: Date,
): Promise<ManagerDoc> {
  const input = parse(RegisterInput, raw);
  const index = await loadEmailIndex();
  if (index[input.email])
    throw new Conflict("Für diese E-Mail-Adresse gibt es schon ein Konto.");

  const admin = isAdminEmail(input.email);
  const league = await loadLeague();
  const invite = input.inviteCode
    ? findInvite(league, input.inviteCode)
    : undefined;
  if (!admin && !invite) throw new BadRequest(INVALID_INVITE);

  const at = now.toISOString();
  const firstMatchday = matchdayCalendar(
    gameData.fixtures,
    finals(),
  ).firstMatchdayFor(now, gameData.season.firstScoredMatchday);
  const doc: ManagerDoc = {
    userId: randomUUID(),
    email: input.email,
    displayName: input.displayName,
    teamName: input.teamName,
    passwordHash: await hashPassword(input.password),
    role: admin ? "admin" : "player",
    createdAt: at,
    updatedAt: at,
    ...newManagerState(firstMatchday, gameData.season.startBudget),
  };
  // Reihenfolge: Dokument, dann Index, dann Code verbrauchen. Bricht es
  // zwischendrin ab, bleibt höchstens ein unerreichbares Dokument zurück.
  await saveManager(doc);
  await saveEmailIndex({ ...index, [input.email]: doc.userId });
  if (invite) {
    await saveLeague({
      ...league,
      invites: league.invites.map((i) =>
        i.code === invite.code ? { ...i, usedBy: doc.userId, usedAt: at } : i,
      ),
    });
  }
  return doc;
}

/**
 * Anzeige- und Teamnamen ändern. Die Namen werden überall live aus dem Dokument gelesen
 * (Tabelle, Spieltag, Pushes), eine Änderung gilt also sofort, auch rückwirkend.
 * Ohne updatedAt-Sperre wie die Push-Einstellungen: berührt Kader und Aufstellung nicht.
 */
export async function updateProfile(
  userId: string,
  raw: unknown,
): Promise<ManagerDoc> {
  const input = parse(ProfileInput, raw);
  return updateManager(userId, (doc) => ({ ...doc, ...input }));
}

export async function resetPassword(raw: unknown, now: Date): Promise<void> {
  const input = parse(ResetInput, raw);
  const userId = (await loadEmailIndex())[input.email];
  const league = await loadLeague();
  const reset = userId ? findReset(league, input.code, userId, now) : undefined;
  const doc = userId ? await loadManager(userId) : null;
  if (!reset || !doc) throw new BadRequest(INVALID_RESET);

  const at = now.toISOString();
  // Erst hashen, dann frisch laden und schreiben: Das Hashen dauert.
  const passwordHash = await hashPassword(input.password);
  await updateManager(doc.userId, (d) => ({ ...d, passwordHash }), {
    stamp: now,
  });
  await saveLeague({
    ...league,
    resets: league.resets.map((r) =>
      r.code === reset.code ? { ...r, usedAt: at } : r,
    ),
  });
}
