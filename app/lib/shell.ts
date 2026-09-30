// Daten für den App-Rahmen (Seitenleiste, Countdown): nächste Sperre des laufenden
// Spieltags. Die Sperrzeit rechnet core (lockAt); hier wird nur ausgewählt.
import { currentMatchday, lockAt, type Fixture } from "@fm/core";

export interface NextLock {
  fixture: Fixture;
  at: Date;
  /** Einige Spiele des Spieltags sind schon gesperrt („Nächste fixiert in“). */
  running: boolean;
}

/** Nächste Sperre im aktuellen Spieltag; null, wenn keine mehr kommt. */
export function nextLock(
  fixtures: readonly Fixture[],
  finals: ReadonlyMap<number, Date>,
  now: Date,
): NextLock | null {
  const matchday = currentMatchday(finals);
  if (matchday === null) return null;
  const games = fixtures.filter(
    (f) => f.matchday === matchday && f.status !== "postponed",
  );
  const upcoming = games
    .map((fixture) => ({ fixture, at: lockAt(fixture) }))
    .filter((g) => g.at > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const first = upcoming[0];
  if (!first) return null;
  return { ...first, running: games.some((f) => lockAt(f) <= now) };
}

export function lockLabel(lock: Pick<NextLock, "running">): string {
  return lock.running ? "Nächste fixiert in" : "Fixiert in";
}
