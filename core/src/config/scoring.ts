// Punktesystem (KONZEPT 3). Startwerte, werden nach den ersten Spieltagen kalibriert.
import type { Position } from "./rules";

type PerPosition = Record<Position, number>;

export const SCORING = {
  rating: {
    /** Note, die 0 Punkte ergibt. */
    baseline: 6.5,
    /** Punkte je ganzer Notenstufe über/unter baseline. */
    factor: 5,
    /** Ab so vielen Minuten zählt die Note voll. */
    fullMinutes: 60,
  },
  goal: { GK: 8, DEF: 7, MID: 6, FWD: 5 } as PerPosition,
  assist: { GK: 4, DEF: 4, MID: 4, FWD: 4 } as PerPosition,
  cleanSheet: { GK: 5, DEF: 4, MID: 1, FWD: 0 } as PerPosition,
  /** Je Gegentor ab dem zweiten. */
  concededFromSecond: { GK: -1, DEF: -1, MID: 0, FWD: 0 } as PerPosition,
  /** Mindestminuten für „zu null“ und Gegentore. */
  defenseMinMinutes: 60,
  penSaved: { GK: 6, DEF: 0, MID: 0, FWD: 0 } as PerPosition,
  penMissed: -3,
  ownGoal: -3,
  yellow: -1,
  yellowRed: -3,
  red: -5,
  startBonus: 2,
  captainMultiplier: 2,
};
