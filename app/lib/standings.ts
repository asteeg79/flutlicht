// Wertung zur Laufzeit (KONZEPT 8.4): data/points + alle Manager-Dokumente → Tabelle
// und Spieltagsansicht. Rechnen tut ausschließlich core; hier wird nur zusammengestellt
// und gefiltert, was andere Manager sehen dürfen (2.8).
import {
  isLocked,
  isScoredMatchday,
  isShadowMatchday,
  lineupForMatchday,
  matchdayBonuses,
  participation,
  scoreLeague,
  scoreManager,
  standings,
  type Fixture,
  type ManagerDoc,
  type MatchdayPoints,
  type Player,
  type MatchdayBonus,
  type PointParts,
  type Position,
  type Season,
  type Team,
} from "@fm/core";
import { gameData } from "@/lib/game-data";

export interface GameSlice {
  players: readonly Player[];
  teams: readonly Team[];
  points: readonly MatchdayPoints[];
  fixtures: readonly Fixture[];
  season: Pick<Season, "firstScoredMatchday">;
}

export interface PlayerRef {
  id: number;
  name: string;
  shortName: string;
  club: string;
  /** Pfad des Vereinslogos; fehlt bei unbekanntem Spieler. */
  clubLogo?: string;
  /** Pfad des Spielerfotos, falls vorhanden. */
  image?: string;
  teamId?: number;
  position: Position;
}

function refs(game: GameSlice) {
  const club = new Map(game.teams.map((t) => [t.id, t]));
  const byId = new Map(game.players.map((p) => [p.id, p]));
  const positions = new Map(game.players.map((p) => [p.id, p.position]));
  const ref = (id: number): PlayerRef => {
    const p = byId.get(id);
    return p
      ? {
          id,
          name: p.name,
          shortName: p.shortName,
          club: club.get(p.teamId)?.shortName ?? "",
          clubLogo: club.get(p.teamId)?.logo,
          image: p.image,
          teamId: p.teamId,
          position: p.position,
        }
      : {
          id,
          name: `Spieler ${id}`,
          shortName: `#${id}`,
          club: "",
          position: positions.get(id) ?? "MID",
        };
  };
  return { byId, positions, ref };
}

export interface TableRow {
  userId: string;
  displayName: string;
  teamName: string;
  rank: number;
  total: number;
  wins: number;
  best: number;
  byMatchday: Record<number, number>;
  /**
   * Platzänderung durch den letzten gewerteten Spieltag (positiv = aufgestiegen);
   * null, solange es keinen Vorspieltag zum Vergleich gibt.
   */
  movement: number | null;
}

export interface LeagueTable {
  rows: TableRow[];
  /** Spieltag → Anzeigenamen der Sieger (nur finale Spieltage). */
  winners: Record<
    number,
    { matchday: number; ids: string[]; names: string[]; points: number }
  >;
  matchdays: { matchday: number; status: MatchdayPoints["status"] }[];
}

export function leagueTable(
  managers: readonly ManagerDoc[],
  game: GameSlice = gameData,
): LeagueTable {
  const { positions } = refs(game);
  const first = game.season.firstScoredMatchday;
  const scores = scoreLeague(managers, game.points, positions, first);
  const statusOf = new Map(game.points.map((p) => [p.matchday, p.status]));
  const { rows, winners } = standings(scores, statusOf);
  const byId = new Map(managers.map((m) => [m.userId, m]));
  // Bewegung ▲/▼: dieselbe Tabelle ohne den letzten gewerteten Spieltag.
  const scored = game.points
    .filter((p) => isScoredMatchday(p.matchday, first))
    .map((p) => p.matchday);
  const last = scored.at(-1);
  const before =
    scored.length >= 2
      ? new Map(
          standings(
            new Map(
              [...scores].map(([id, byMd]) => [
                id,
                new Map([...byMd].filter(([md]) => md !== last)),
              ]),
            ),
            new Map([...statusOf].filter(([md]) => md !== last)),
          ).rows.map((r) => [r.userId, r.rank]),
        )
      : null;
  return {
    rows: rows.map((r) => ({
      ...r,
      displayName: byId.get(r.userId)?.displayName ?? "?",
      teamName: byId.get(r.userId)?.teamName ?? "?",
      movement: before ? (before.get(r.userId) ?? r.rank) - r.rank : null,
    })),
    winners: Object.fromEntries(
      Object.entries(winners).map(([md, ids]) => [
        md,
        {
          matchday: Number(md),
          ids,
          names: ids.map((id) => byId.get(id)?.displayName ?? "?"),
          points: scores.get(ids[0]!)?.get(Number(md))?.total ?? 0,
        },
      ]),
    ),
    // Nur gewertete Spieltage; Backfill und Schattenbetrieb gehören nicht in die Tabelle.
    matchdays: game.points
      .filter((p) => isScoredMatchday(p.matchday, first))
      .map((p) => ({ matchday: p.matchday, status: p.status })),
  };
}

export interface SlotView {
  starter: PlayerRef;
  /** Wer gewertet wurde; null, wenn niemand nachrücken konnte. */
  player: PlayerRef | null;
  subbedIn: boolean;
  minutes: number;
  base: number;
  startBonus: number;
  points: number;
  captain: boolean;
  parts: PointParts | null;
  /** Sofascore-Note des gewerteten Spielers; null ohne Note. */
  rating: number | null;
}

export interface ManagerMatchdayView {
  userId: string;
  displayName: string;
  teamName: string;
  own: boolean;
  total: number;
  captainBonus: number;
  transferPenalty: number;
  slots: SlotView[];
  /** Starter, die noch nicht gesperrt und deshalb verdeckt sind. */
  hidden: number;
  /** Spieltagsprämie (2.7); gutgeschrieben erst bei der Finalisierung. */
  bonus: MatchdayBonus | null;
}

export interface MatchdayView {
  matchday: number;
  status: MatchdayPoints["status"] | "upcoming";
  /** Spieltag vor dem ersten gewerteten: Punkte und Prämie nur zur Probe. */
  shadow: boolean;
  managers: ManagerMatchdayView[];
}

/**
 * Punkte aller Manager an Spieltag n. Die eigene Aufstellung ist ganz sichtbar;
 * fremde Spieler erst ab ihrer Sperre, nach der Finalisierung alle (2.8).
 */
export function matchdayView(
  n: number,
  managers: readonly ManagerDoc[],
  viewerId: string,
  now: Date,
  game: GameSlice = gameData,
): MatchdayView {
  const first = game.season.firstScoredMatchday;
  const shadow = isShadowMatchday(n, first);
  const md = game.points.find((p) => p.matchday === n);
  if (!md) return { matchday: n, status: "upcoming", shadow, managers: [] };
  const { byId, positions, ref } = refs(game);
  const fixtures = game.fixtures.filter((f) => f.matchday === n);
  const bonuses = matchdayBonuses(managers, md, positions, first);

  const views = managers.flatMap((m): ManagerMatchdayView[] => {
    if (participation(m, n, first) === null) return [];
    const lineup = lineupForMatchday(m, n, md.status);
    if (!lineup) return [];
    const score = scoreManager(n, lineup, md.players, m.transfers, positions);
    const own = m.userId === viewerId;
    const visible = (id: number) => {
      if (own || md.status === "final") return true;
      const p = byId.get(id);
      return p !== undefined && isLocked(p, now, fixtures);
    };
    const slots = score.slots
      .filter((s) => visible(s.starterId))
      .map((s): SlotView => ({
        starter: ref(s.starterId),
        player: s.playerId === null ? null : ref(s.playerId),
        subbedIn: s.subbedIn,
        minutes:
          s.playerId === null ? 0 : (md.players[s.playerId]?.minutes ?? 0),
        base: s.base,
        startBonus: s.startBonus,
        points: s.points,
        captain: s.starterId === lineup.captain,
        parts:
          s.playerId === null ? null : (md.players[s.playerId]?.parts ?? null),
        rating:
          s.playerId === null ? null : (md.players[s.playerId]?.rating ?? null),
      }));
    return [
      {
        userId: m.userId,
        displayName: m.displayName,
        teamName: m.teamName,
        own,
        total: score.total,
        captainBonus: visible(lineup.captain) ? score.captainBonus : 0,
        transferPenalty: score.transferPenalty,
        slots,
        hidden: score.slots.length - slots.length,
        bonus: bonuses.get(m.userId) ?? null,
      },
    ];
  });
  views.sort((a, b) => Number(b.own) - Number(a.own) || b.total - a.total);
  return { matchday: n, status: md.status, shadow, managers: views };
}

/**
 * Rang je Manager an einem Spieltag nach Punkten (Arena „Im Spieltag Platz 2 von 8“);
 * Gleichstand teilt sich den Rang (1, 1, 3 …), wie in der Tabelle.
 */
export function matchdayRanks(
  managers: readonly Pick<ManagerMatchdayView, "userId" | "total">[],
): Map<string, number> {
  const totals = managers.map((m) => m.total);
  return new Map(
    managers.map((m) => [
      m.userId,
      totals.filter((t) => t > m.total).length + 1,
    ]),
  );
}
