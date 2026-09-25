// Admin-Nachtrag eines Spiels (KONZEPT 7.4, 11) → PlayerMatchInput, wie bei Sofascore-Daten.
import type { Position } from "./config/rules";
import type { PlayerMatchInput } from "./points";
import type { ManualMatch } from "./schemas/manual";
import type { SofascoreMatch } from "./sofascore";

/**
 * `sideOf` sagt, ob ein Spieler zum Heim- oder Auswärtsteam gehört (aus players.json);
 * die Gegentore ergeben sich daraus und aus dem eingetragenen Endstand.
 */
export function readManualMatch(
  match: ManualMatch,
  positionOf: (playerId: number) => Position | undefined,
  sideOf: (playerId: number) => { teamId: number; isHome: boolean } | undefined,
): SofascoreMatch {
  const warnings: string[] = [];
  const players: SofascoreMatch["players"] = [];
  for (const p of match.players) {
    const position = positionOf(p.playerId);
    const side = sideOf(p.playerId);
    if (position === undefined || side === undefined) {
      warnings.push(
        `Nachtrag ${match.eventId}: Spieler ${p.playerId} unbekannt, wird nicht gewertet`,
      );
      continue;
    }
    const input: PlayerMatchInput = {
      position,
      minutes: p.minutes,
      started: p.started,
      rating: p.rating,
      goals: p.goals,
      assists: p.assists,
      ownGoals: p.ownGoals,
      yellow: p.yellow,
      yellowRed: p.yellowRed,
      red: p.red,
      penMissed: p.penMissed,
      penSaved: p.penSaved,
      teamConceded: side.isHome ? match.score.away : match.score.home,
    };
    players.push({ playerId: p.playerId, teamId: side.teamId, input });
  }
  return { players, warnings };
}
