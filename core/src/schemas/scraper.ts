// Lebenszeichen des Heim-Rechners (KONZEPT 8.2, 10): Der Scheduler schickt seinen Stand
// mit, die App speichert ihn samt Zeitpunkt nach ihrer eigenen Uhr.
import { z } from "zod";
import { IsoDateTime } from "./common";

/** Schlüssel eines Scheduler-Jobs, etwa `squads:2026-10-01` oder `prov:16434032`. */
const JobKey = z.string().min(1).max(80);
const Text = z.string().max(500);

export const ScraperStatus = z.object({
  /** Laufende 6-h-Pause nach 429 oder wiederholtem 403 (KONZEPT 5.6). */
  pause: z.object({ until: IsoDateTime, reason: Text.nullable() }).nullable(),
  /** Zuletzt ausgeführter Job; `unfinished`: das Spiel lief noch. */
  lastJob: z
    .object({
      key: JobKey,
      at: IsoDateTime,
      outcome: z.enum(["ok", "unfinished", "failed"]),
      error: Text.nullable(),
    })
    .nullable(),
  /** Fällige Jobs des letzten Laufs mit der Zahl ihrer Fehlversuche. */
  due: z.array(z.object({ key: JobKey, attempts: z.int().min(0) })).max(50),
  /** Die nächsten geplanten Jobs. */
  next: z.array(z.object({ key: JobKey, at: IsoDateTime })).max(50),
  /** Nach mehreren Versuchen aufgegebene Jobs der letzten Tage. */
  gaveUp: z.array(z.object({ key: JobKey, at: IsoDateTime })).max(50),
  /** Commit des Klons auf dem Heim-Rechner und seine noch nicht gepushten Commits. */
  commit: z.string().max(40).nullable(),
  unpushed: z.int().min(0),
  /**
   * Abrufweg, der zuletzt ging: `direct`, sonst ein Rückfall (`page`, `window`).
   * Fehlt in Meldungen vor dem 02.10.2026.
   */
  route: z.string().max(40).nullish(),
});
export type ScraperStatus = z.infer<typeof ScraperStatus>;

export const ScraperHeartbeat = z.object({
  seenAt: IsoDateTime,
  status: ScraperStatus,
});
export type ScraperHeartbeat = z.infer<typeof ScraperHeartbeat>;
