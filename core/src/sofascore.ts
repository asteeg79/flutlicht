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
  /** Bei `period`: "HT" / "FT" mit Spielstand in homeScore/awayScore. */
  text: z.string().optional(),
  homeScore: z.number().optional(),
  awayScore: z.number().optional(),
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

type Lineups = z.infer<typeof SofascoreLineups>;
type IncidentData = z.infer<typeof Incident>;
type PlayerEntry = SofascorePlayerInput & {
  statGoals: number | undefined;
  statAssists: number | undefined;
};
/** Eingabe des Spielers zur Referenz; fehlt er in den Aufstellungen, gibt es eine Warnung. */
type InputOf = (
  ref: { id: number } | undefined,
  what: string,
) => PlayerMatchInput | undefined;

/** Alle Spieler beider Aufstellungen mit Startwerten; ohne Position nur eine Warnung. */
function readLineups(
  lineups: Lineups,
  score: ScoreLine,
  positionOf: (playerId: number) => Position | undefined,
  warnings: string[],
): Map<number, PlayerEntry> {
  const byId = new Map<number, PlayerEntry>();
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
  return byId;
}

function applyGoal(
  inc: IncidentData,
  cls: string,
  inputOf: InputOf,
  warnings: string[],
): void {
  const scorer = inputOf(inc.player, `Tor (${cls})`);
  if (cls === "ownGoal") {
    if (scorer) scorer.ownGoals++;
    return;
  }
  if (!GOAL_CLASSES.has(cls))
    warnings.push(`Unbekannte Tor-Klasse "${cls}", als Tor gewertet`);
  if (scorer) scorer.goals++;
  if (inc.assist1) {
    const assist = inputOf(inc.assist1, "Vorlage");
    if (assist) assist.assists++;
  }
}

function applyCard(
  inc: IncidentData,
  cls: string,
  inputOf: InputOf,
  warnings: string[],
): void {
  if (inc.rescinded || (inc.manager && !inc.player)) return;
  const carded = inputOf(inc.player, `Karte (${cls})`);
  if (cls !== "yellow" && cls !== "yellowRed" && cls !== "red") {
    warnings.push(`Unbekannte Karten-Klasse "${cls}", ignoriert`);
    return;
  }
  if (carded) carded[cls] = true;
}

function applyPenalty(
  inc: IncidentData,
  cls: string,
  inputOf: InputOf,
  warnings: string[],
): void {
  if (cls !== "missed") {
    warnings.push(`Unbekannte Elfmeter-Klasse "${cls}", ignoriert`);
    return;
  }
  const shooter = inputOf(inc.player, "Elfmeter verschossen");
  if (shooter) shooter.penMissed++;
  if (inc.reason !== "goalkeeperSave") return;
  const keeper = inc.footballPassingNetworkAction?.find(
    (a) => a.eventType === "penalty-save",
  )?.goalkeeper;
  const saver = inputOf(keeper, "Elfmeter gehalten");
  if (saver) saver.penSaved++;
}

const APPLY = new Map([
  ["goal", applyGoal],
  ["card", applyCard],
  ["inGamePenalty", applyPenalty],
]);

/** Vorlagen: Fallback auf statistics.goalAssist, falls ein assist1 in den Incidents fehlt. */
function checkStatistics(
  entries: Iterable<PlayerEntry>,
  warnings: string[],
): void {
  for (const entry of entries) {
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
  const byId = readLineups(lineups, score, positionOf, warnings);

  const inputOf: InputOf = (ref, what) => {
    const entry = ref && byId.get(ref.id);
    if (!entry)
      warnings.push(
        `${what}: Spieler ${ref?.id ?? "?"} fehlt in den Aufstellungen`,
      );
    return entry?.input;
  };

  for (const inc of incidents) {
    const type = inc.incidentType;
    if (IGNORED_TYPES.has(type)) continue;
    const apply = APPLY.get(type);
    if (apply) apply(inc, inc.incidentClass ?? "", inputOf, warnings);
    else warnings.push(`Unbekannter Incident-Typ "${type}", ignoriert`);
  }

  checkStatistics(byId.values(), warnings);

  const players = [...byId.values()].map(({ playerId, teamId, input }) => ({
    playerId,
    teamId,
    input,
  }));
  return { players, warnings };
}

/** Endstand aus dem Abpfiff-Incident (`period`, text "FT"); null, solange das Spiel läuft. */
export function finalScoreFromIncidents(
  incidentsRaw: unknown,
): ScoreLine | null {
  const { incidents } = SofascoreIncidents.parse(incidentsRaw);
  const ft = incidents.find(
    (i) => i.incidentType === "period" && i.text === "FT",
  );
  if (ft?.homeScore === undefined || ft.awayScore === undefined) return null;
  return { home: ft.homeScore, away: ft.awayScore };
}
