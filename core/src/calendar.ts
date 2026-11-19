// Spieltags-Kalender (KONZEPT 2.1, 2.5, 2.6): beantwortet aus Spielplan und
// Finalisierungen alle Zeitfragen eines Spieltags. Maßgeblich ist die aktuelle
// Anstoßzeit laut fixtures.json.
import { RULES } from "./config/rules";
import type { Fixture, MatchdayPoints, Player } from "./schemas/data";
import type { TransferWindow } from "./transfers";

const DAY_MS = 24 * 60 * 60 * 1000;

export type CalendarFixture = Pick<
  Fixture,
  "matchday" | "kickoffUtc" | "homeTeamId" | "awayTeamId" | "status"
>;

export interface NextLock<F extends CalendarFixture = Fixture> {
  fixture: F;
  at: Date;
  /** Einige Spiele des Spieltags sind schon gesperrt („Nächste fixiert in“). */
  running: boolean;
}

export interface MatchdayCalendar<F extends CalendarFixture = Fixture> {
  /** Aktueller Spieltag: der kleinste, der noch nicht final ist (2.1). null nach dem 34. */
  readonly current: number | null;
  fixturesOf(matchday: number): readonly F[];
  /** Früheste Sperre des Spieltags, null ohne Spiele. */
  firstLock(matchday: number): Date | null;
  /** Begonnen ab der ersten Sperre; ein Spieltag ohne Spiele gilt als begonnen. */
  started(matchday: number, now: Date): boolean;
  /** Pause: zwischen Finalisierung des Vorgängers und erster Sperre ≥ 10 Tage; Saisonstart zählt als Pause. */
  isBreak(matchday: number): boolean;
  /** Offen ab der Finalisierung von N−1 bis zur ersten Sperre des aktuellen Spieltags N. */
  transferWindow(now: Date): TransferWindow;
  /** IDs der gesperrten Spieler; ohne `matchday` am aktuellen Spieltag. Ohne Spiel nie gesperrt. */
  lockedPlayers(
    players: readonly Pick<Player, "id" | "teamId">[],
    now: Date,
    matchday?: number,
  ): Set<number>;
  /**
   * Erster gewerteter Spieltag eines neuen Managers: der aktuelle, solange er nicht
   * begonnen hat, sonst der nächste; nie vor dem ersten gewerteten Spieltag der Saison.
   */
  firstMatchdayFor(now: Date, firstScoredMatchday: number): number;
  /** Nächste Sperre im aktuellen Spieltag; verlegte Spiele zählen nicht. null, wenn keine mehr kommt. */
  nextLock(now: Date): NextLock<F> | null;
}

/** Sperre eines Spiels: Anpfiff − 90 Min. (2.5). */
export function lockAt(fixture: Pick<Fixture, "kickoffUtc">): Date {
  return new Date(
    Date.parse(fixture.kickoffUtc) - RULES.lockLeadMinutes * 60_000,
  );
}

/** Finalisierte Spieltage → Zeitpunkt der Finalisierung: der Stand der finalen Punkte. */
export function finalizedAt(
  points: readonly Pick<
    MatchdayPoints,
    "matchday" | "status" | "generatedAt"
  >[],
): Map<number, Date> {
  return new Map(
    points
      .filter((p) => p.status === "final")
      .map((p) => [p.matchday, new Date(p.generatedAt)]),
  );
}

export function matchdayCalendar<F extends CalendarFixture>(
  fixtures: readonly F[],
  finals: ReadonlyMap<number, Date>,
): MatchdayCalendar<F> {
  const byMatchday = new Map<number, F[]>();
  for (const f of fixtures) {
    const list = byMatchday.get(f.matchday);
    if (list) list.push(f);
    else byMatchday.set(f.matchday, [f]);
  }
  let current: number | null = null;
  for (let md = 1; md <= RULES.matchdays && current === null; md++)
    if (!finals.has(md)) current = md;

  const fixturesOf = (md: number): readonly F[] => byMatchday.get(md) ?? [];
  const firstLock = (md: number): Date | null => {
    const times = fixturesOf(md).map((f) => lockAt(f).getTime());
    return times.length === 0 ? null : new Date(Math.min(...times));
  };
  const started = (md: number, now: Date): boolean => {
    const lock = firstLock(md);
    return lock === null || now >= lock;
  };
  const isBreak = (md: number): boolean => {
    const lock = firstLock(md);
    if (lock === null) return false;
    const opensAt = finals.get(md - 1);
    return (
      opensAt === undefined ||
      lock.getTime() - opensAt.getTime() >= RULES.breakMinDays * DAY_MS
    );
  };

  return {
    current,
    fixturesOf,
    firstLock,
    started,
    isBreak,
    transferWindow(now) {
      if (current === null) return { open: false };
      const closesAt = firstLock(current);
      if (closesAt === null || now >= closesAt) return { open: false };
      return {
        open: true,
        matchday: current,
        closesAt,
        isBreak: isBreak(current),
      };
    },
    lockedPlayers(players, now, matchday = current ?? undefined) {
      const games = matchday === undefined ? [] : fixturesOf(matchday);
      return new Set(
        players
          .filter((p) => {
            const game = games.find(
              (f) => f.homeTeamId === p.teamId || f.awayTeamId === p.teamId,
            );
            return game !== undefined && now >= lockAt(game);
          })
          .map((p) => p.id),
      );
    },
    firstMatchdayFor(now, firstScoredMatchday) {
      const md = current ?? RULES.matchdays;
      const next = started(md, now) ? md + 1 : md;
      return Math.min(RULES.matchdays, Math.max(firstScoredMatchday, next));
    },
    nextLock(now) {
      if (current === null) return null;
      const games = fixturesOf(current).filter((f) => f.status !== "postponed");
      const upcoming = games
        .map((fixture) => ({ fixture, at: lockAt(fixture) }))
        .filter((g) => g.at > now)
        .sort((a, b) => a.at.getTime() - b.at.getTime());
      const first = upcoming[0];
      if (!first) return null;
      return { ...first, running: games.some((f) => lockAt(f) <= now) };
    },
  };
}
