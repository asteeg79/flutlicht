// Wertung der Runde (KONZEPT 2.8, 8.4): Spieltagspunkte je Manager, Tabelle, Spieltagssieger.
import type { Position } from "./config/rules";
import { participation } from "./participation";
import { scoreManager, type ManagerScore, type SlotScore } from "./points";
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

export interface RoundScore {
  /** Gewertet oder Schattenbetrieb (Spieltag vor dem ersten gewerteten, 2.7). */
  kind: "scored" | "shadow";
  lineup: Lineup;
  score: ManagerScore;
}

/**
 * Wertung eines Managers an einem Spieltag: ob er teilnimmt, mit welcher Aufstellung
 * und mit wie vielen Punkten. null ohne Teilnahme oder ohne Aufstellung.
 */
export function roundScore(
  manager: ScoringManager,
  md: MatchdayPoints,
  positions: ReadonlyMap<number, Position>,
  firstScoredMatchday: number,
): RoundScore | null {
  const kind = participation(manager, md.matchday, firstScoredMatchday);
  if (kind === null) return null;
  const lineup = lineupForMatchday(manager, md.matchday, md.status);
  if (!lineup) return null;
  return {
    kind,
    lineup,
    score: scoreManager(
      md.matchday,
      lineup,
      md.players,
      manager.transfers,
      positions,
    ),
  };
}

/**
 * Was ein Betrachter von einer Wertung sehen darf (2.8): die eigene ganz, nach der
 * Finalisierung alle; fremde Starter erst ab ihrer Sperre, den Kapitänsbonus erst
 * ab der Sperre des Kapitäns.
 */
export function visibleScore(
  round: RoundScore,
  view: {
    own: boolean;
    status: MatchdayPoints["status"];
    locked: ReadonlySet<number>;
  },
): { slots: SlotScore[]; captainBonus: number; hidden: number } {
  const visible = (id: number) =>
    view.own || view.status === "final" || view.locked.has(id);
  const slots = round.score.slots.filter((s) => visible(s.starterId));
  return {
    slots,
    captainBonus: visible(round.lineup.captain) ? round.score.captainBonus : 0,
    hidden: round.score.slots.length - slots.length,
  };
}

/** Punkte je Manager und Spieltag; nur gewertete Spieltage (`participation`). */
export function scoreLeague(
  managers: readonly ScoringManager[],
  points: readonly MatchdayPoints[],
  positions: ReadonlyMap<number, Position>,
  firstScoredMatchday: number,
): Map<string, Map<number, ManagerScore>> {
  const out = new Map<string, Map<number, ManagerScore>>();
  for (const m of managers) {
    const byMatchday = new Map<number, ManagerScore>();
    for (const md of points) {
      const round = roundScore(m, md, positions, firstScoredMatchday);
      if (round?.kind === "scored") byMatchday.set(md.matchday, round.score);
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
 * Mit `until` nur die Spieltage bis einschließlich `until` (Tabelle von damals).
 */
export function standings(
  allScores: ReadonlyMap<string, ReadonlyMap<number, ManagerScore>>,
  allStatus: ReadonlyMap<number, MatchdayPoints["status"]>,
  until: number = Infinity,
): { rows: StandingRow[]; winners: Record<number, string[]> } {
  const upTo = <V>(m: ReadonlyMap<number, V>) =>
    new Map([...m].filter(([md]) => md <= until));
  const scores = new Map([...allScores].map(([id, byMd]) => [id, upTo(byMd)]));
  const statusOf = upTo(allStatus);
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

/** Rang je Manager an einem Spieltag nach Punkten; Gleichstand teilt sich den Rang (1, 1, 3 …). */
export function matchdayRanks(
  managers: readonly { userId: string; total: number }[],
): Map<string, number> {
  const totals = managers.map((m) => m.total);
  return new Map(
    managers.map((m) => [
      m.userId,
      totals.filter((t) => t > m.total).length + 1,
    ]),
  );
}
