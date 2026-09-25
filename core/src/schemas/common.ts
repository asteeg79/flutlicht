// Übernommen aus WM-Tipp shared/src/common.ts, angepasst: nur IsoDateTime, IsoDate,
// ScoreLine, MatchStatus behalten; zod v4 (z.iso.*); MatchStatus um "postponed" ergänzt.
import { z } from "zod";
import { RULES } from "../config/rules";

/** ISO-8601-Zeitpunkt (gespeichert in UTC). */
export const IsoDateTime = z.iso.datetime({ offset: true });
/** Reines Kalenderdatum YYYY-MM-DD. */
export const IsoDate = z.iso.date();

/** Ergebnis (Tore). */
export const ScoreLine = z.object({
  home: z.int().min(0),
  away: z.int().min(0),
});
export type ScoreLine = z.infer<typeof ScoreLine>;

/** Status einer Partie. */
export const MatchStatus = z.enum([
  "scheduled",
  "live",
  "finished",
  "postponed",
]);
export type MatchStatus = z.infer<typeof MatchStatus>;

/** Sofascore-ID eines Spielers oder Vereins. */
export const SofascoreId = z.int().positive();

export const Matchday = z.int().min(1).max(RULES.matchdays);

/** Schlüssel eines JSON-Objekts, das nach Spieltag oder Spieler-ID indiziert ist. */
export const NumericKey = z.string().regex(/^\d+$/);
