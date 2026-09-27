// Schemas der Nutzerdaten in Redis (KONZEPT 7.3).
import { z } from "zod";
import { FORMATIONS, RULES } from "../config/rules";
import { IsoDateTime, Matchday, NumericKey, SofascoreId } from "./common";

export const FormationEnum = z.enum(FORMATIONS);

export const Lineup = z.object({
  formation: FormationEnum,
  starters: z.array(SofascoreId).length(11),
  bench: z.object({
    gk: SofascoreId,
    /** B1–B3 in dieser Reihenfolge. */
    b: z.tuple([SofascoreId, SofascoreId, SofascoreId]),
  }),
  captain: SofascoreId,
});
export type Lineup = z.infer<typeof Lineup>;

export const Transfer = z.object({
  at: IsoDateTime,
  /** Spieltag, für den der Transfer zählt. */
  matchday: Matchday,
  out: SofascoreId,
  in: SofascoreId,
  priceOut: z.number(),
  priceIn: z.number(),
  /** false = kostet Punkte (über die freien Transfers hinaus). */
  free: z.boolean(),
});
export type Transfer = z.infer<typeof Transfer>;

export const TransferBank = z.object({
  matchday: Matchday,
  available: z
    .int()
    .min(0)
    .max(RULES.freeTransfersPerMatchday + RULES.maxCarryOver),
});
export type TransferBank = z.infer<typeof TransferBank>;

export const PushPrefs = z.object({
  reminder: z.boolean(),
  daily: z.boolean(),
  final: z.boolean(),
});

export const PushSubscriptionJson = z.object({
  endpoint: z.url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export const ManagerDoc = z.object({
  userId: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1),
  teamName: z.string().min(1),
  passwordHash: z.string().min(1),
  role: z.enum(["admin", "player"]),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  firstMatchday: Matchday,
  /** Leer bis zum Erstkader, danach genau 15 Spieler. */
  squad: z
    .array(SofascoreId)
    .refine((s) => s.length === 0 || s.length === RULES.squadSize, {
      message: `Der Kader hat 0 oder ${RULES.squadSize} Spieler.`,
    }),
  /** Mio. */
  cash: z.number(),
  /** null bis zum Erstkader. */
  lineup: Lineup.nullable(),
  /** Bei der Finalisierung eingefroren. */
  lineupHistory: z.record(NumericKey, Lineup),
  transfers: z.array(Transfer),
  transferBank: TransferBank,
  /** Kaufpreise des Erstkaders in Mio. (für /historie); fehlt bei alten Dokumenten. */
  initialPrices: z.record(NumericKey, z.number()).optional(),
  /** Gutgeschriebene Spieltagsprämien in Mio. je Spieltag (2.7); fehlt bei alten Dokumenten. */
  matchdayBonuses: z.record(NumericKey, z.number()).optional(),
  push: z
    .object({ subscription: PushSubscriptionJson, prefs: PushPrefs })
    .optional(),
});
export type ManagerDoc = z.infer<typeof ManagerDoc>;

/** { [emailLower]: userId } */
export const EmailIndex = z.record(z.string(), z.uuid());
export type EmailIndex = z.infer<typeof EmailIndex>;

/** 8 Zeichen aus [A-HJ-NP-Z2-9]: ohne I, O, 0, 1 (KONZEPT 8.3). */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const LeagueCode = z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/);

export const InviteCode = z.object({
  code: LeagueCode,
  createdAt: IsoDateTime,
  usedBy: z.uuid().optional(),
  usedAt: IsoDateTime.optional(),
  revoked: z.boolean().optional(),
});
export type InviteCode = z.infer<typeof InviteCode>;

export const ResetCode = z.object({
  code: LeagueCode,
  userId: z.uuid(),
  createdAt: IsoDateTime,
  usedAt: IsoDateTime.optional(),
});
export type ResetCode = z.infer<typeof ResetCode>;

/** league.json.enc: Einladungs- und Reset-Codes (KONZEPT 7.3). */
export const League = z.object({
  invites: z.array(InviteCode),
  resets: z.array(ResetCode),
});
export type League = z.infer<typeof League>;

/** system-state.json.enc: ausgeführte Tick-Aktionen, Schlüssel → Zeitpunkt (KONZEPT 9). */
export const SystemState = z.object({
  done: z.record(z.string(), IsoDateTime),
});
export type SystemState = z.infer<typeof SystemState>;
