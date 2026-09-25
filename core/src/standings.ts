// Wertung der Runde (KONZEPT 2.8, 8.4): Spieltagspunkte je Manager, Tabelle, Spieltagssieger.
import type { Position } from "./config/rules";
import { scoreManager, type ManagerScore } from "./points";
import type { MatchdayPoints } from "./schemas/data";
import type { Lineup, ManagerDoc } from "./schemas/manager";

export type ScoringManager = Pick<
  ManagerDoc,
  "userId" | "firstMatchday" | "lineup" | "lineupHistory" | "transfers"
>;

/**
 * Aufstellung für einen Spieltag: finale Spieltage aus lineupHistory (bei der
 * Finalisierung eingefroren), laufende aus der aktuellen Aufstellung. Fehlt der
 * eingefrorene Stand noch (der Tick friert erst nach der Finalisierung ein), gilt
 * die aktuelle Aufstellung.
 */
export function lineupForMatchday(
  manager: ScoringManager,
  matchday: number,
  status: MatchdayPoints["status"],
): Lineup | null {
  if (status === "final")
    return manager.lineupHistory[String(matchday)] ?? manager.lineup;
  return manager.lineup;
}

/** Punkte je Manager und Spieltag; nur ab dem ersten gewerteten Spieltag des Managers. */
export function scoreLeague(
  managers: readonly ScoringManager[],
  points: readonly MatchdayPoints[],
  positions: ReadonlyMap<number, Position>,
): Map<string, Map<number, ManagerScore>> {
  const out = new Map<string, Map<number, ManagerScore>>();
  for (const m of managers) {
    const byMatchday = new Map<number, ManagerScore>();
    for (const md of points) {
      if (md.matchday < m.firstMatchday) continue;
      const lineup = lineupForMatchday(m, md.matchday, md.status);
      if (!lineup) continue;
      byMatchday.set(
        md.matchday,
        scoreManager(md.matchday, lineup, md.players, m.transfers, positions),
      );
    }
    out.set(m.userId, byMatchday);
  }
  return out;
}

export interface StandingRow {
  userId: string;
  rank: number;
  total: number;
  /** Spieltagssiege (nur finale Spieltage). */
  wins: number;
  /** Bester Einzelspieltag; 0 ohne gewerteten Spieltag. */
  best: number;
  byMatchday: Record<number, number>;
}

/**
 * Gesamttabelle nach Punktesumme. Tie-Break: mehr Spieltagssiege → höchster
 * Einzelspieltag → gleichauf (gleicher Rang). Spieltagssieger ist die höchste
 * Punktzahl eines finalen Spieltags; bei Gleichstand gewinnen alle (2.8).
 */
export function standings(
  scores: ReadonlyMap<string, ReadonlyMap<number, ManagerScore>>,
  statusOf: ReadonlyMap<number, MatchdayPoints["status"]>,
): { rows: StandingRow[]; winners: Record<number, string[]> } {
  const winners: Record<number, string[]> = {};
  for (const [matchday, status] of statusOf) {
    if (status !== "final") continue;
    const entries = [...scores].flatMap(([userId, byMd]) => {
      const s = byMd.get(matchday);
      return s ? [{ userId, total: s.total }] : [];
    });
    if (entries.length === 0) continue;
    const top = Math.max(...entries.map((e) => e.total));
    winners[matchday] = entries
      .filter((e) => e.total === top)
      .map((e) => e.userId);
  }

  const rows = [...scores].map(([userId, byMd]): Omit<StandingRow, "rank"> => {
    const totals = [...byMd.values()].map((s) => s.total);
    return {
      userId,
      total: totals.reduce((a, b) => a + b, 0),
      wins: Object.values(winners).filter((w) => w.includes(userId)).length,
      best: totals.length > 0 ? Math.max(...totals) : 0,
      byMatchday: Object.fromEntries([...byMd].map(([md, s]) => [md, s.total])),
    };
  });
  const compare = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    b.total - a.total || b.wins - a.wins || b.best - a.best;
  rows.sort(compare);
  const ranked = rows.map((row) => ({
    ...row,
    // Gleichauf teilt sich den Rang (1, 1, 3 …).
    rank: rows.findIndex((other) => compare(other, row) === 0) + 1,
  }));
  return { rows: ranked, winners };
}
