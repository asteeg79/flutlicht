// Regelkonstanten für Kader, Aufstellung, Sperren und Transfers (KONZEPT 2.2–2.6).

export const POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;
export type Position = (typeof POSITIONS)[number];

/** Erlaubte Formationen (ABW-MF-ST), immer mit 1 TW. */
export const FORMATIONS = [
  "3-4-3",
  "3-5-2",
  "4-3-3",
  "4-4-2",
  "4-5-1",
  "5-3-2",
  "5-4-1",
] as const;
export type Formation = (typeof FORMATIONS)[number];

export const RULES = {
  matchdays: 34,
  squadSize: 15,
  squadComposition: { GK: 2, DEF: 5, MID: 5, FWD: 3 } as Record<
    Position,
    number
  >,
  maxPerClub: 5,
  /** Sperre ab so vielen Minuten vor Anpfiff. */
  lockLeadMinutes: 90,
  freeTransfersPerMatchday: 2,
  maxCarryOver: 1,
  /** Punktabzug je Transfer über die freien hinaus. */
  extraTransferPenalty: 5,
  /** Ab so vielen Tagen zwischen Finalisierung und erster Sperre gilt das Fenster als Pause. */
  breakMinDays: 10,
  /** Ein verlegtes Spiel zählt nur, wenn es höchstens so viele Tage nach dem ursprünglichen Termin stattfindet (2.9). */
  postponedGraceDays: 3,
};
