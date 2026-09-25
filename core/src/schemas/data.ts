// Schemas der Dateien in data/ (KONZEPT 7.1). Nur die Pipeline schreibt sie.
import { z } from "zod";
import { POSITIONS } from "../config/rules";
import { MARKET } from "../config/market";
import {
  IsoDate,
  IsoDateTime,
  MatchStatus,
  Matchday,
  NumericKey,
  ScoreLine,
  SofascoreId,
} from "./common";

export const PositionEnum = z.enum(POSITIONS);

export const Price = z.number().min(MARKET.priceMin).max(MARKET.priceMax);

export const Season = z.object({
  season: z.string().regex(/^\d{4}\/\d{2}$/),
  sofascoreTournamentId: z.int(),
  sofascoreSeasonId: z.int(),
  openligaSeason: z.int(),
  firstScoredMatchday: Matchday,
  vMaxEur: z.number().positive(),
  /** Mio. */
  startBudget: z.number().positive(),
  matchdays: z.int().positive(),
});
export type Season = z.infer<typeof Season>;

export const Team = z.object({
  id: SofascoreId,
  name: z.string().min(1),
  shortName: z.string().min(1),
  openligaTeamId: z.int(),
  tmClubId: z.string().optional(),
  logo: z.string(),
});
export type Team = z.infer<typeof Team>;
export const Teams = z.array(Team);

export const ValueSource = z.enum([
  "tm-crawl",
  "dcaribou",
  "sofascore",
  "manual",
  "missing",
]);

export const Player = z.object({
  id: SofascoreId,
  name: z.string().min(1),
  shortName: z.string().min(1),
  teamId: SofascoreId,
  position: PositionEnum,
  birthDate: IsoDate,
  tmId: z.string().optional(),
  startValueEur: z.number().nonnegative().optional(),
  valueSource: ValueSource,
  /** Aktueller Preis in Mio., eine Nachkommastelle. */
  price: Price,
  purchasable: z.boolean(),
  active: z.boolean(),
  image: z.string().optional(),
});
export type Player = z.infer<typeof Player>;
export const Players = z.array(Player);

export const DataState = z.enum([
  "none",
  "provisional",
  "final",
  "manual",
  "pending",
]);

export const Fixture = z.object({
  matchday: Matchday,
  openligaMatchId: z.int(),
  sofascoreEventId: z.int().optional(),
  homeTeamId: SofascoreId,
  awayTeamId: SofascoreId,
  kickoffUtc: IsoDateTime,
  originalKickoffUtc: IsoDateTime,
  status: MatchStatus,
  score: ScoreLine.optional(),
  dataState: DataState,
});
export type Fixture = z.infer<typeof Fixture>;
export const Fixtures = z.array(Fixture);

/** Ungerundete Einzelteile der Spielerpunkte (3.4). */
export const PointParts = z.object({
  rating: z.number(),
  goals: z.number(),
  assists: z.number(),
  cleanSheet: z.number(),
  conceded: z.number(),
  penSaved: z.number(),
  penMissed: z.number(),
  ownGoals: z.number(),
  cards: z.number(),
});
export type PointParts = z.infer<typeof PointParts>;

export const PlayerPoints = z.object({
  eventId: z.int(),
  minutes: z.int().min(0),
  started: z.boolean(),
  rating: z.number().nullable(),
  parts: PointParts,
  /** Gerundet, ohne Startelf-Bonus. */
  base: z.int(),
});
export type PlayerPoints = z.infer<typeof PlayerPoints>;

export const MatchdayStatus = z.enum(["running", "provisional", "final"]);

export const MatchdayPoints = z.object({
  matchday: Matchday,
  status: MatchdayStatus,
  generatedAt: IsoDateTime,
  players: z.record(NumericKey, PlayerPoints),
});
export type MatchdayPoints = z.infer<typeof MatchdayPoints>;

export const MarketHistory = z.record(
  NumericKey,
  z.array(z.object({ matchday: Matchday, price: Price })),
);
export type MarketHistory = z.infer<typeof MarketHistory>;

export const Meta = z.object({
  dataVersion: z.string().min(1),
  generatedAt: IsoDateTime,
  lastFinalMatchday: Matchday.nullable(),
});
export type Meta = z.infer<typeof Meta>;
