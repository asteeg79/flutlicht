// Pipeline-Schritt points (KONZEPT 6.5 Schritt 4): data/points/md-NN.json je begonnenem Spieltag.
import {
  finalScoreFromIncidents,
  fixtureCounts,
  matchdayStatus,
  playerMatchPoints,
  readManualMatch,
  readSofascoreMatch,
  RULES,
  type Fixture,
  type ManualMatch,
  type MatchdayPoints,
  type Player,
  type PlayerPoints,
} from "@fm/core";

export type MatchData =
  | { kind: "manual"; match: ManualMatch; at: string }
  | {
      kind: "final" | "provisional";
      lineups: unknown;
      incidents: unknown;
      at: string;
    };

export function buildPoints(
  fixtures: readonly Fixture[],
  data: ReadonlyMap<number, MatchData>,
  players: readonly Player[],
  now: Date,
  warn: (message: string) => void,
): MatchdayPoints[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const positionOf = (id: number) => byId.get(id)?.position;
  const out: MatchdayPoints[] = [];

  for (let matchday = 1; matchday <= RULES.matchdays; matchday++) {
    const mdFixtures = fixtures.filter((f) => f.matchday === matchday);
    const status = matchdayStatus(mdFixtures);
    if (status === null) continue;
    const points: Record<string, PlayerPoints> = {};
    const stamps: string[] = [];
    for (const f of mdFixtures.filter(fixtureCounts)) {
      const d =
        f.sofascoreEventId === undefined
          ? undefined
          : data.get(f.sofascoreEventId);
      if (!d) continue;
      const eventId = f.sofascoreEventId!;
      let match;
      if (d.kind === "manual") {
        const sideOf = (id: number) => {
          const teamId = byId.get(id)?.teamId;
          if (teamId === f.homeTeamId) return { teamId, isHome: true };
          if (teamId === f.awayTeamId) return { teamId, isHome: false };
          return undefined;
        };
        match = readManualMatch(d.match, positionOf, sideOf);
      } else {
        const score = f.score ?? finalScoreFromIncidents(d.incidents);
        if (!score) {
          warn(`Spiel ${eventId}: noch kein Endstand, wird übersprungen`);
          continue;
        }
        match = readSofascoreMatch(d.lineups, d.incidents, score, positionOf);
      }
      for (const w of match.warnings) warn(`Spiel ${eventId}: ${w}`);
      for (const p of match.players) {
        points[p.playerId] = { eventId, ...playerMatchPoints(p.input) };
      }
      stamps.push(d.at);
    }
    out.push({
      matchday,
      status,
      generatedAt: stamps.sort().at(-1) ?? now.toISOString(),
      players: Object.fromEntries(
        Object.entries(points).sort(([a], [b]) => Number(a) - Number(b)),
      ),
    });
  }
  return out;
}
