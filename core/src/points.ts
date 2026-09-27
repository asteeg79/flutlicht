// Spielerpunkte (KONZEPT 3) und Spieltagswertung eines Managers (2.3, 2.4, 2.6, 2.8).
import { RULES, type Position } from "./config/rules";
import { SCORING } from "./config/scoring";
import { roundHalfAwayFromZero } from "./rounding";
import type { PlayerPoints, PointParts } from "./schemas/data";
import type { Lineup, Transfer } from "./schemas/manager";

/** Leistung eines Spielers in einem gewerteten Spiel, bereits aus den Rohdaten gelesen. */
export interface PlayerMatchInput {
  position: Position;
  minutes: number;
  /** Stand im echten Spiel in der Startelf. */
  started: boolean;
  rating: number | null;
  goals: number;
  assists: number;
  ownGoals: number;
  yellow: boolean;
  yellowRed: boolean;
  red: boolean;
  penMissed: number;
  penSaved: number;
  /** Gegentore seines Teams im ganzen Spiel. */
  teamConceded: number;
}

export type PlayerMatchResult = Omit<PlayerPoints, "eventId">;

const NO_PARTS: PointParts = {
  rating: 0,
  goals: 0,
  assists: 0,
  cleanSheet: 0,
  conceded: 0,
  penSaved: 0,
  penMissed: 0,
  ownGoals: 0,
  cards: 0,
};

/** Basispunkte eines Spielers in einem Spiel, ohne Startelf-Bonus (3.1–3.4). */
export function playerMatchPoints(p: PlayerMatchInput): PlayerMatchResult {
  const head = { minutes: p.minutes, started: p.started, rating: p.rating };
  if (p.minutes <= 0) return { ...head, parts: { ...NO_PARTS }, base: 0 };

  const pos = p.position;
  const defense = p.minutes >= SCORING.defenseMinMinutes;
  const parts: PointParts = {
    rating: ratingPoints(p.rating, p.minutes),
    goals: p.goals * SCORING.goal[pos],
    assists: p.assists * SCORING.assist[pos],
    cleanSheet: defense && p.teamConceded === 0 ? SCORING.cleanSheet[pos] : 0,
    conceded: defense
      ? Math.max(0, p.teamConceded - 1) * SCORING.concededFromSecond[pos]
      : 0,
    penSaved: p.penSaved * SCORING.penSaved[pos],
    penMissed: p.penMissed * SCORING.penMissed,
    ownGoals: p.ownGoals * SCORING.ownGoal,
    cards: cardPoints(p),
  };
  // 0 × negativer Punktwert ergibt −0; + 0 macht daraus eine normale 0.
  for (const k of Object.keys(parts) as (keyof PointParts)[]) parts[k] += 0;
  const sum = Object.values(parts).reduce((a, b) => a + b, 0);
  return { ...head, parts, base: roundHalfAwayFromZero(sum) };
}

/** Noten-Punkte in Hundertsteln gerechnet, damit 6.45 exakt −0.5 ergibt (3.1). */
/** Noten-Punkte (3.1), ungerundet: (Note − 6,5) × 10, unter 60 Minuten anteilig. */
export function ratingPoints(rating: number | null, minutes: number): number {
  if (rating === null) return 0;
  const { baseline, factor, fullMinutes } = SCORING.rating;
  const hundredths = Math.round(rating * 100) - Math.round(baseline * 100);
  return (
    (((hundredths * factor) / 100) * Math.min(minutes, fullMinutes)) /
    fullMinutes
  );
}

/** Gelb-Rot ersetzt die vorherige Gelbe Karte, eine glatt Rote kommt hinzu. */
function cardPoints(p: PlayerMatchInput): number {
  const second = p.yellowRed
    ? SCORING.yellowRed
    : p.yellow
      ? SCORING.yellow
      : 0;
  return second + (p.red ? SCORING.red : 0);
}

export interface SlotScore {
  /** Starter laut Aufstellung des Managers. */
  starterId: number;
  /** Wer tatsächlich gewertet wurde; null, wenn niemand nachrücken konnte. */
  playerId: number | null;
  subbedIn: boolean;
  base: number;
  startBonus: number;
  points: number;
}

export interface ManagerScore {
  matchday: number;
  slots: SlotScore[];
  captainBonus: number;
  transferPenalty: number;
  total: number;
}

type ScoredPoints = Pick<PlayerPoints, "minutes" | "started" | "base">;

/**
 * Spieltagspunkte eines Managers: Σ der 11 Slots nach Auto-Wechsel
 * + Kapitänsbonus − Transferabzug (2.8).
 * `points` enthält nur Spieler mit gewertetem Spiel; fehlt ein Spieler, zählt er als 0 Minuten.
 */
export function scoreManager(
  matchday: number,
  lineup: Lineup,
  points: Readonly<Record<string, ScoredPoints>>,
  transfers: readonly Pick<Transfer, "matchday" | "free">[],
  positions: ReadonlyMap<number, Position>,
): ManagerScore {
  const played = (id: number) => (points[id]?.minutes ?? 0) > 0;
  const usedBench = new Set<number>();

  const slots = lineup.starters.map((starterId): SlotScore => {
    const own = points[starterId];
    if (own && own.minutes > 0) {
      const startBonus = own.started ? SCORING.startBonus : 0;
      return {
        starterId,
        playerId: starterId,
        subbedIn: false,
        base: own.base,
        startBonus,
        points: own.base + startBonus,
      };
    }
    const position = positions.get(starterId);
    const candidates =
      position === "GK"
        ? [lineup.bench.gk]
        : lineup.bench.b.filter((id) => positions.get(id) === position);
    const sub = candidates.find((id) => !usedBench.has(id) && played(id));
    if (sub === undefined) {
      return {
        starterId,
        playerId: null,
        subbedIn: false,
        base: 0,
        startBonus: 0,
        points: 0,
      };
    }
    usedBench.add(sub);
    const base = points[sub]!.base;
    return {
      starterId,
      playerId: sub,
      subbedIn: true,
      base,
      startBonus: 0,
      points: base,
    };
  });

  const captainSlot = slots.find(
    (s) => s.starterId === lineup.captain && s.playerId === lineup.captain,
  );
  const captainBonus = captainSlot
    ? captainSlot.points * (SCORING.captainMultiplier - 1)
    : 0;
  const paid = transfers.filter((t) => t.matchday === matchday && !t.free);
  const transferPenalty = paid.length * RULES.extraTransferPenalty;
  const total =
    slots.reduce((sum, s) => sum + s.points, 0) +
    captainBonus -
    transferPenalty;
  return { matchday, slots, captainBonus, transferPenalty, total };
}
