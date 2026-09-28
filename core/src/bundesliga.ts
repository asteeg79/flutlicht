// Bundesliga-Tabelle aus den beendeten Spielen des Spielplans (Ansicht /tabelle/bundesliga).
import type { Fixture } from "./schemas/data";

export interface BundesligaRow {
  teamId: number;
  /** Gleicher Platz bei gleichen Punkten, Tordifferenz und Toren. */
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/**
 * Sieg 3, Unentschieden 1 Punkt; nur Spiele mit Status "finished". Reihenfolge nach
 * Punkten, Tordifferenz, erzielten Toren; der direkte Vergleich der DFL fehlt bewusst.
 */
export function bundesligaTable(
  fixtures: readonly Pick<
    Fixture,
    "homeTeamId" | "awayTeamId" | "status" | "score"
  >[],
  teamIds: readonly number[],
): BundesligaRow[] {
  const rows = new Map(
    teamIds.map((teamId) => [
      teamId,
      {
        teamId,
        rank: 0,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      },
    ]),
  );
  const add = (teamId: number, scored: number, conceded: number) => {
    const r = rows.get(teamId);
    if (!r) return;
    r.played++;
    r.goalsFor += scored;
    r.goalsAgainst += conceded;
    if (scored > conceded) {
      r.won++;
      r.points += 3;
    } else if (scored === conceded) {
      r.drawn++;
      r.points += 1;
    } else r.lost++;
  };
  for (const f of fixtures) {
    if (f.status !== "finished" || !f.score) continue;
    add(f.homeTeamId, f.score.home, f.score.away);
    add(f.awayTeamId, f.score.away, f.score.home);
  }
  const key = (r: BundesligaRow) => [
    r.points,
    r.goalsFor - r.goalsAgainst,
    r.goalsFor,
  ];
  const sorted = [...rows.values()].sort((a, b) => {
    const [ka, kb] = [key(a), key(b)];
    return kb[0]! - ka[0]! || kb[1]! - ka[1]! || kb[2]! - ka[2]!;
  });
  sorted.forEach((r, i) => {
    const prev = sorted[i - 1];
    r.rank =
      prev && key(prev).every((v, j) => v === key(r)[j]) ? prev.rank : i + 1;
  });
  return sorted;
}
