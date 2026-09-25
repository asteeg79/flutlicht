// Admin-Nachtrag eines Spiels, raw/manual/matches/{eventId}.json (KONZEPT 7.4).
import { z } from "zod";
import { IsoDateTime, ScoreLine, SofascoreId } from "./common";

const Count = z.int().min(0);

export const ManualMatchPlayer = z.object({
  playerId: SofascoreId,
  started: z.boolean(),
  minutes: z.int().min(0),
  rating: z.number().nullable(),
  goals: Count,
  assists: Count,
  ownGoals: Count,
  yellow: z.boolean(),
  yellowRed: z.boolean(),
  red: z.boolean(),
  penMissed: Count,
  penSaved: Count,
});
export type ManualMatchPlayer = z.infer<typeof ManualMatchPlayer>;

export const ManualMatch = z.object({
  eventId: z.int(),
  enteredBy: z.string().min(1),
  enteredAt: IsoDateTime,
  score: ScoreLine,
  players: z.array(ManualMatchPlayer),
});
export type ManualMatch = z.infer<typeof ManualMatch>;
