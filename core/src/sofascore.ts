// Liest Sofascore-lineups und -incidents eines Spiels in PlayerMatchInput (KONZEPT 3.2, 5.2).
// Feldbedeutungen und verifizierte Klassen: docs/sofascore-felder.md.
// Unbekannte Typen/Klassen werden als Warnung gemeldet, nicht als Fehler.
import { z } from "zod";
import type { Position } from "./config/rules";
import type { PlayerMatchInput } from "./points";
import type { ScoreLine } from "./schemas/common";

const Ref = z.object({ id: z.int() });

const LineupPlayer = z.object({
  player: z.object({ id: z.int(), position: z.string().optional() }),
  teamId: z.int(),
  substitute: z.boolean(),
  statistics: z
    .object({
      minutesPlayed: z.number().optional(),
      rating: z.number().optional(),
      goals: z.number().optional(),
      goalAssist: z.number().optional(),
    })
    .optional(),
});
const LineupSide = z.object({ players: z.array(LineupPlayer) });
export const SofascoreLineups = z.object({
  home: LineupSide,
  away: LineupSide,
});

const Incident = z.object({
  incidentType: z.string(),
  incidentClass: z.string().optional(),
  player: Ref.optional(),
  /** Karten an Trainer tragen `manager` statt `player`. */
  manager: Ref.optional(),
  assist1: Ref.optional(),
  rescinded: z.boolean().optional(),
  reason: z.string().optional(),
  footballPassingNetworkAction: z
    .array(
      z.object({
        eventType: z.string().optional(),
        goalkeeper: Ref.optional(),
      }),
    )
    .optional(),
});
export const SofascoreIncidents = z.object({ incidents: z.array(Incident) });

/** Ereignisse, die für die Punkte keine Rolle spielen. */
const IGNORED_TYPES = new Set([
  "period",
  "injuryTime",
  "substitution",
  "varDecision",
]);
const GOAL_CLASSES = new Set(["regular", "penalty"]);

const POSITION_CODES: Record<string, Position> = {
  G: "GK",
  D: "DEF",
  M: "MID",
  F: "FWD",
};

/** Sofascore-Positionscode G/D/M/F → GK/DEF/MID/FWD. */
export function positionFromSofascore(
  code: string | undefined,
): Position | undefined {
  return code === undefined ? undefined : POSITION_CODES[code];
}

export interface SofascorePlayerInput {
  playerId: number;
  teamId: number;
  input: PlayerMatchInput;
}

export interface SofascoreMatch {
  players: SofascorePlayerInput[];
  warnings: string[];
}

/**
 * `score` ist der Endstand (Gegentore für „zu null“ und je Gegentor ab dem 2.).
 * `positionOf` liefert die Saison-Position aus players.json; ohne sie gilt die
 * Sofascore-Position des Spielers.
 */
export function readSofascoreMatch(
  lineupsRaw: unknown,
  incidentsRaw: unknown,
  score: ScoreLine,
  positionOf: (playerId: number) => Position | undefined = () => undefined,
): SofascoreMatch {
  const lineups = SofascoreLineups.parse(lineupsRaw);
  const { incidents } = SofascoreIncidents.parse(incidentsRaw);
  const warnings: string[] = [];
  const byId = new Map<
    number,
    SofascorePlayerInput & {
      statGoals: number | undefined;
      statAssists: number | undefined;
    }
  >();

  for (const [side, isHome] of [
    [lineups.home, true],
    [lineups.away, false],
  ] as const) {
    for (const p of side.players) {
      const id = p.player.id;
      const position =
        positionOf(id) ?? positionFromSofascore(p.player.position);
      if (position === undefined) {
        warnings.push(
          `Spieler ${id}: keine Position bekannt, wird nicht gewertet`,
        );
        continue;
      }
      byId.set(id, {
        playerId: id,
        teamId: p.teamId,
        statGoals: p.statistics?.goals,
        statAssists: p.statistics?.goalAssist,
        input: {
          position,
          minutes: p.statistics?.minutesPlayed ?? 0,
          started: !p.substitute,
          rating: p.statistics?.rating ?? null,
          goals: 0,
          assists: 0,
          ownGoals: 0,
          yellow: false,
          yellowRed: false,
          red: false,
          penMissed: 0,
          penSaved: 0,
          teamConceded: isHome ? score.away : score.home,
        },
      });
    }
  }

  const inputOf = (ref: { id: number } | undefined, what: string) => {
    const entry = ref && byId.get(ref.id);
    if (!entry)
      warnings.push(
        `${what}: Spieler ${ref?.id ?? "?"} fehlt in den Aufstellungen`,
      );
    return entry?.input;
  };

  for (const inc of incidents) {
    const type = inc.incidentType;
    const cls = inc.incidentClass ?? "";
    if (IGNORED_TYPES.has(type)) continue;
    if (type === "goal") {
      const scorer = inputOf(inc.player, `Tor (${cls})`);
      if (cls === "ownGoal") {
        if (scorer) scorer.ownGoals++;
        continue;
      }
      if (!GOAL_CLASSES.has(cls))
        warnings.push(`Unbekannte Tor-Klasse "${cls}", als Tor gewertet`);
      if (scorer) scorer.goals++;
      if (inc.assist1) {
        const assist = inputOf(inc.assist1, "Vorlage");
        if (assist) assist.assists++;
      }
    } else if (type === "card") {
      if (inc.rescinded || (inc.manager && !inc.player)) continue;
      const carded = inputOf(inc.player, `Karte (${cls})`);
      if (cls === "yellow" || cls === "yellowRed" || cls === "red") {
        if (carded) carded[cls] = true;
      } else {
        warnings.push(`Unbekannte Karten-Klasse "${cls}", ignoriert`);
      }
    } else if (type === "inGamePenalty") {
      if (cls !== "missed") {
        warnings.push(`Unbekannte Elfmeter-Klasse "${cls}", ignoriert`);
        continue;
      }
      const shooter = inputOf(inc.player, "Elfmeter verschossen");
      if (shooter) shooter.penMissed++;
      if (inc.reason === "goalkeeperSave") {
        const keeper = inc.footballPassingNetworkAction?.find(
          (a) => a.eventType === "penalty-save",
        )?.goalkeeper;
        const saver = inputOf(keeper, "Elfmeter gehalten");
        if (saver) saver.penSaved++;
      }
    } else {
      warnings.push(`Unbekannter Incident-Typ "${type}", ignoriert`);
    }
  }

  // Vorlagen: Fallback auf statistics.goalAssist, falls ein assist1 in den Incidents fehlt.
  for (const entry of byId.values()) {
    const { input, statGoals, statAssists } = entry;
    if (statAssists !== undefined && statAssists > input.assists) {
      warnings.push(
        `Spieler ${entry.playerId}: ${statAssists} Vorlagen laut Statistik, ${input.assists} laut Incidents`,
      );
      input.assists = statAssists;
    }
    if (statGoals !== undefined && statGoals !== input.goals) {
      warnings.push(
        `Spieler ${entry.playerId}: ${statGoals} Tore laut Statistik, ${input.goals} laut Incidents`,
      );
    }
  }

  const players = [...byId.values()].map(({ playerId, teamId, input }) => ({
    playerId,
    teamId,
    input,
  }));
  return { players, warnings };
}
