// Admin-Dateien in raw/manual/ (KONZEPT 7.2, 11) und Review-Listen in data/review/.
import { z } from "zod";
import { POSITIONS } from "../config/rules";
import { IsoDate, Matchday, NumericKey, SofascoreId } from "./common";

export const ManualTeam = z.object({
  id: SofascoreId,
  name: z.string().min(1),
  shortName: z.string().min(1),
  openligaTeamId: z.int(),
  tmClubId: z.string().optional(),
});
export const ManualTeams = z.array(ManualTeam).length(18);
export type ManualTeam = z.infer<typeof ManualTeam>;

/** Positionskorrekturen: { [sofascorePlayerId]: Position } */
export const ManualPositions = z.record(NumericKey, z.enum(POSITIONS));
/** Marktwerte in EUR: { [sofascorePlayerId]: Wert } */
export const ManualValues = z.record(NumericKey, z.number().positive());
/** Zuordnung Sofascore → Transfermarkt; null = bewusst ohne Transfermarkt-Eintrag. */
export const ManualMapping = z.record(NumericKey, z.string().nullable());

export const ManualSeason = z.object({
  firstScoredMatchday: Matchday,
  /** Mio.; überschreibt das berechnete Startbudget (nur vor dem ersten gewerteten Spieltag). */
  startBudget: z.number().positive().optional(),
});
export type ManualSeason = z.infer<typeof ManualSeason>;

export const MappingCandidate = z.object({
  tmId: z.string(),
  name: z.string(),
  birthDate: IsoDate.optional(),
  tmClubId: z.string().optional(),
});

export const MappingReviewEntry = z.object({
  playerId: SofascoreId,
  name: z.string(),
  teamId: SofascoreId,
  birthDate: IsoDate,
  /** ambiguous = mehrere Treffer, unmatched = Geburtsdatum passt, Name nicht, not-found = kein Kandidat */
  reason: z.enum(["ambiguous", "unmatched", "not-found"]),
  candidates: z.array(MappingCandidate),
});
export const MappingReview = z.array(MappingReviewEntry);
export type MappingReviewEntry = z.infer<typeof MappingReviewEntry>;

export const MissingValueEntry = z.object({
  playerId: SofascoreId,
  name: z.string(),
  teamId: SofascoreId,
  position: z.enum(POSITIONS),
});
export const MissingValues = z.array(MissingValueEntry);
export type MissingValueEntry = z.infer<typeof MissingValueEntry>;
