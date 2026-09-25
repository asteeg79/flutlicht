import { describe, expect, it } from "vitest";
import {
  finalScoreFromIncidents,
  playerMatchPoints,
  readManualMatch,
  type ManualMatch,
} from "../src";
import incidents from "./fixtures/sofascore/16434026/incidents.json" with { type: "json" };

const row = {
  started: true,
  minutes: 90,
  rating: null,
  goals: 0,
  assists: 0,
  ownGoals: 0,
  yellow: false,
  yellowRed: false,
  red: false,
  penMissed: 0,
  penSaved: 0,
};
const match: ManualMatch = {
  eventId: 1,
  enteredBy: "alex",
  enteredAt: "2026-10-12T08:00:00Z",
  score: { home: 2, away: 0 },
  players: [
    { ...row, playerId: 10, goals: 2 },
    { ...row, playerId: 20 },
    { ...row, playerId: 99 },
  ],
};

describe("readManualMatch (KONZEPT 7.4)", () => {
  const read = () =>
    readManualMatch(
      match,
      (id) => (id === 99 ? undefined : id === 10 ? "FWD" : "GK"),
      (id) =>
        id === 10
          ? { teamId: 1, isHome: true }
          : id === 20
            ? { teamId: 2, isHome: false }
            : undefined,
    );

  it("rechnet Gegentore aus dem eingetragenen Endstand je Seite", () => {
    const m = read();
    expect(m.players.map((p) => [p.playerId, p.input.teamConceded])).toEqual([
      [10, 0],
      [20, 2],
    ]);
    expect(playerMatchPoints(m.players[0]!.input).base).toBe(10);
    expect(playerMatchPoints(m.players[1]!.input).parts.conceded).toBe(-1);
  });

  it("meldet unbekannte Spieler als Warnung", () => {
    expect(read().warnings).toEqual([
      "Nachtrag 1: Spieler 99 unbekannt, wird nicht gewertet",
    ]);
  });
});

describe("finalScoreFromIncidents", () => {
  it("liest den Endstand aus dem Abpfiff", () => {
    expect(finalScoreFromIncidents(incidents.data)).toEqual({
      home: 3,
      away: 3,
    });
  });
  it("gibt vor dem Abpfiff null zurück", () => {
    expect(
      finalScoreFromIncidents({
        incidents: [
          { incidentType: "period", text: "HT", homeScore: 1, awayScore: 0 },
        ],
      }),
    ).toBeNull();
  });
});
