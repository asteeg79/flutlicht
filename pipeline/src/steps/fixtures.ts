// Pipeline-Schritt fixtures (KONZEPT 6.5 Schritt 3): OpenLigaDB-Spielplan + Sofascore-Event-IDs.
import { fixtureCounts, type Fixture, type ManualTeam } from "@fm/core";

export interface OpenligaMatch {
  matchID: number;
  matchDateTimeUTC: string;
  group: { groupOrderID: number };
  team1: { teamId: number };
  team2: { teamId: number };
  matchIsFinished: boolean;
  matchResults: {
    resultTypeID: number;
    pointsTeam1: number;
    pointsTeam2: number;
  }[];
}

export interface RoundEvent {
  id: number;
  matchday: number;
  homeTeamId: number;
  awayTeamId: number;
}

type DataKind = "manual" | "final" | "provisional";

export interface FixturesInput {
  matches: readonly OpenligaMatch[];
  /** Erste bekannte Anstoßzeit je OpenLigaDB-Spiel (raw/openligadb/original-kickoffs.json). */
  originals: Readonly<Record<string, string>>;
  rounds: readonly RoundEvent[];
  teams: readonly ManualTeam[];
  dataKindOf: (eventId: number) => DataKind | undefined;
  /** Zeitpunkt des OpenLigaDB-Abrufs: hält den Build deterministisch. */
  now: Date;
}

/** OpenLigaDB-Endergebnis (resultTypeID 2). */
const END_RESULT = 2;

export function buildFixtures(input: FixturesInput): Fixture[] {
  const sofaId = new Map(input.teams.map((t) => [t.openligaTeamId, t.id]));
  const teamOf = (olgId: number) => {
    const id = sofaId.get(olgId);
    if (id === undefined)
      throw new Error(
        `OpenLigaDB-Verein ${olgId} fehlt in raw/manual/teams.json`,
      );
    return id;
  };
  const eventKey = (md: number, home: number, away: number) =>
    `${md}:${home}:${away}`;
  const events = new Map(
    input.rounds.map((e) => [
      eventKey(e.matchday, e.homeTeamId, e.awayTeamId),
      e.id,
    ]),
  );

  return input.matches
    .map((m): Fixture => {
      const matchday = m.group.groupOrderID;
      const homeTeamId = teamOf(m.team1.teamId);
      const awayTeamId = teamOf(m.team2.teamId);
      const kickoffUtc = m.matchDateTimeUTC;
      const originalKickoffUtc =
        input.originals[String(m.matchID)] ?? kickoffUtc;
      const end = m.matchResults.find((r) => r.resultTypeID === END_RESULT);
      const status = m.matchIsFinished
        ? "finished"
        : !fixtureCounts({ kickoffUtc, originalKickoffUtc })
          ? "postponed"
          : input.now >= new Date(kickoffUtc)
            ? "live"
            : "scheduled";
      const eventId = events.get(eventKey(matchday, homeTeamId, awayTeamId));
      const kind =
        eventId === undefined ? undefined : input.dataKindOf(eventId);
      return {
        matchday,
        openligaMatchId: m.matchID,
        ...(eventId === undefined ? {} : { sofascoreEventId: eventId }),
        homeTeamId,
        awayTeamId,
        kickoffUtc,
        originalKickoffUtc,
        status,
        ...(m.matchIsFinished && end
          ? { score: { home: end.pointsTeam1, away: end.pointsTeam2 } }
          : {}),
        // pending = beendet, aber noch keine Sofascore-Daten (5.8)
        dataState: kind ?? (status === "finished" ? "pending" : "none"),
      };
    })
    .sort(
      (a, b) =>
        a.matchday - b.matchday ||
        a.kickoffUtc.localeCompare(b.kickoffUtc) ||
        a.openligaMatchId - b.openligaMatchId,
    );
}
