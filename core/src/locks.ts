// Sperrzeiten (KONZEPT 2.5). Maßgeblich ist die aktuelle Anstoßzeit laut fixtures.json.
import { RULES } from "./config/rules";
import type { Fixture, Player } from "./schemas/data";

/** Sperre eines Spiels: Anpfiff − 90 Min. */
export function lockAt(fixture: Pick<Fixture, "kickoffUtc">): Date {
  return new Date(
    Date.parse(fixture.kickoffUtc) - RULES.lockLeadMinutes * 60_000,
  );
}

/** Früheste Sperre unter den Spielen, null bei leerer Liste. */
export function firstLock(
  fixtures: readonly Pick<Fixture, "kickoffUtc">[],
): Date | null {
  const times = fixtures.map((f) => lockAt(f).getTime());
  return times.length === 0 ? null : new Date(Math.min(...times));
}

/**
 * Ist der Spieler gesperrt? `fixtures` sind die Spiele des aktuellen Spieltags.
 * Hat sein Verein an diesem Spieltag kein Spiel, ist er nicht gesperrt.
 */
export function isLocked(
  player: Pick<Player, "teamId">,
  now: Date,
  fixtures: readonly Pick<
    Fixture,
    "homeTeamId" | "awayTeamId" | "kickoffUtc"
  >[],
): boolean {
  const fixture = fixtures.find(
    (f) => f.homeTeamId === player.teamId || f.awayTeamId === player.teamId,
  );
  return fixture !== undefined && now >= lockAt(fixture);
}
