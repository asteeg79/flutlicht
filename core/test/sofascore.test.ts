import { describe, expect, it } from "vitest";
import {
  playerMatchPoints,
  positionFromSofascore,
  readSofascoreMatch,
  type PlayerMatchResult,
} from "../src";
import round from "./fixtures/sofascore/round-01.json" with { type: "json" };
import unionLineups from "./fixtures/sofascore/16434026/lineups.json" with { type: "json" };
import unionIncidents from "./fixtures/sofascore/16434026/incidents.json" with { type: "json" };
import bayernLineups from "./fixtures/sofascore/16434087/lineups.json" with { type: "json" };
import bayernIncidents from "./fixtures/sofascore/16434087/incidents.json" with { type: "json" };
import koelnLineups from "./fixtures/sofascore/16434022/lineups.json" with { type: "json" };
import koelnIncidents from "./fixtures/sofascore/16434022/incidents.json" with { type: "json" };
import bvbLineups from "./fixtures/sofascore/16434025/lineups.json" with { type: "json" };
import bvbIncidents from "./fixtures/sofascore/16434025/incidents.json" with { type: "json" };

/** Endstand aus der round-Datei (Sofascore homeScore/awayScore.current). */
function scoreOf(eventId: number) {
  const e = round.data.events.find((x) => x.id === eventId)!;
  return { home: e.homeScore.current, away: e.awayScore.current };
}

function read(
  eventId: number,
  lineups: { data: unknown },
  incidents: { data: unknown },
) {
  return readSofascoreMatch(lineups.data, incidents.data, scoreOf(eventId));
}

describe("Fixture-Spiel Union Berlin – Eintracht Frankfurt 3:3 (Event 16434026)", () => {
  const match = read(16434026, unionLineups, unionIncidents);
  const points = new Map<number, PlayerMatchResult>(
    match.players.map((p) => [p.playerId, playerMatchPoints(p.input)]),
  );

  it("rechnet alle 40 Spieler beider Kader ohne Warnung durch", () => {
    expect(match.warnings).toEqual([]);
    expect(points.size).toBe(40);
    const played = [...points.values()].filter((p) => p.minutes > 0);
    expect(played).toHaveLength(31);
    expect([...points.values()].every((p) => Number.isInteger(p.base))).toBe(
      true,
    );
  });

  // Von Hand nachgerechnet (KONZEPT 3.1–3.4):
  it("Ebnoutalib (ST, Frankfurt): 85′, Note 9.7, 3 Tore, Gelb → 16 + 15 − 1 = 30", () => {
    expect(points.get(1474296)).toMatchObject({
      minutes: 85,
      started: true,
      parts: { rating: 16, goals: 15, cards: -1 },
      base: 30,
    });
  });

  it("Raab (TW, Union): 90′, Note 5.2, 3 Gegentore → −6.5 − 2 = −8.5 → −9", () => {
    expect(points.get(842718)).toMatchObject({
      parts: { rating: -6.5, conceded: -2, cleanSheet: 0 },
      base: -9,
    });
  });

  it("Skarke (MF, Union): eingewechselt, 29′, Note 7.1, 1 Tor → 3 × 29/60 = 1.45; + 6 = 7.45 → 7", () => {
    const p = points.get(800252)!;
    expect(p.started).toBe(false);
    expect(p.parts.rating).toBeCloseTo(1.45, 10);
    expect(p.parts.goals).toBe(6);
    expect(p.base).toBe(7);
  });

  it("Querfeld (ABW, Union): 90′, Note 7.5, 1 Tor, 1 Vorlage, 3 Gegentore → 5 + 7 + 4 − 2 = 14", () => {
    expect(points.get(1086547)!.base).toBe(14);
  });

  it("gibt Ersatzspielern ohne Einsatz 0 Punkte", () => {
    expect(points.get(148167)).toMatchObject({ minutes: 0, base: 0 });
  });
});

describe("Sonderfälle aus Spieltag 1", () => {
  it("Eigentor: Vagnoman (Stuttgart) erzielt 1 Tor und 1 Eigentor", () => {
    const m = read(16434087, bayernLineups, bayernIncidents);
    const p = m.players.find((x) => x.playerId === 906278)!;
    expect(p.input).toMatchObject({ goals: 1, ownGoals: 1 });
    expect(playerMatchPoints(p.input).parts.ownGoals).toBe(-3);
  });

  it("Glatt Rot: Inacio (Dortmund)", () => {
    const m = read(16434025, bvbLineups, bvbIncidents);
    expect(m.players.find((x) => x.playerId === 1861666)!.input.red).toBe(true);
  });

  it("Elfmeter: Moerstedt verschießt, Schwäbe hält", () => {
    const m = read(16434022, koelnLineups, koelnIncidents);
    const get = (id: number) => m.players.find((x) => x.playerId === id)!.input;
    expect(get(1418703).penMissed).toBe(1);
    expect(get(187185)).toMatchObject({ position: "GK", penSaved: 1 });
    expect(playerMatchPoints(get(187185)).parts.penSaved).toBe(6);
  });
});

describe("readSofascoreMatch: Robustheit", () => {
  const lineups = {
    home: {
      players: [
        {
          player: { id: 1, position: "G" },
          teamId: 10,
          substitute: false,
          statistics: { minutesPlayed: 90, goalAssist: 1 },
        },
        { player: { id: 2 }, teamId: 10, substitute: false },
      ],
    },
    away: { players: [] },
  };

  it("meldet unbekannte Typen und Klassen als Warnung statt abzubrechen", () => {
    const m = readSofascoreMatch(
      lineups,
      {
        incidents: [
          { incidentType: "mystery" },
          { incidentType: "card", incidentClass: "orange", player: { id: 1 } },
          {
            incidentType: "inGamePenalty",
            incidentClass: "scored",
            player: { id: 1 },
          },
          { incidentType: "goal", incidentClass: "header", player: { id: 1 } },
          {
            incidentType: "goal",
            incidentClass: "regular",
            player: { id: 99 },
          },
          {
            incidentType: "card",
            incidentClass: "yellow",
            rescinded: true,
            player: { id: 1 },
          },
          {
            incidentType: "card",
            incidentClass: "yellowRed",
            manager: { id: 7 },
          },
        ],
      },
      { home: 0, away: 0 },
    );
    expect(m.warnings).toEqual([
      "Spieler 2: keine Position bekannt, wird nicht gewertet",
      'Unbekannter Incident-Typ "mystery", ignoriert',
      'Unbekannte Karten-Klasse "orange", ignoriert',
      'Unbekannte Elfmeter-Klasse "scored", ignoriert',
      'Unbekannte Tor-Klasse "header", als Tor gewertet',
      "Tor (regular): Spieler 99 fehlt in den Aufstellungen",
      "Spieler 1: 1 Vorlagen laut Statistik, 0 laut Incidents",
    ]);
    expect(m.players[0]!.input).toMatchObject({
      goals: 1,
      assists: 1,
      yellow: false,
    });
  });

  it("wertet Elfmeter ohne Parade nur als verschossen und meldet fehlende Angaben", () => {
    const withGoals = {
      ...lineups,
      home: {
        players: [
          {
            ...lineups.home.players[0]!,
            statistics: { minutesPlayed: 90, goals: 2 },
          },
        ],
      },
    };
    const m = readSofascoreMatch(
      withGoals,
      {
        incidents: [
          {
            incidentType: "inGamePenalty",
            incidentClass: "missed",
            reason: "woodwork",
            player: { id: 1 },
          },
          {
            incidentType: "inGamePenalty",
            incidentClass: "missed",
            reason: "goalkeeperSave",
            player: { id: 1 },
          },
          {
            incidentType: "goal",
            incidentClass: "ownGoal",
            player: { id: 98 },
          },
        ],
      },
      { home: 0, away: 0 },
    );
    expect(m.players[0]!.input).toMatchObject({ penMissed: 2, penSaved: 0 });
    expect(m.warnings).toEqual([
      "Elfmeter gehalten: Spieler ? fehlt in den Aufstellungen",
      "Tor (ownGoal): Spieler 98 fehlt in den Aufstellungen",
      "Spieler 1: 2 Tore laut Statistik, 0 laut Incidents",
    ]);
  });

  it("nimmt die Saison-Position vor der Sofascore-Position", () => {
    const m = readSofascoreMatch(
      lineups,
      { incidents: [] },
      { home: 0, away: 0 },
      (id) => (id === 2 ? "MID" : undefined),
    );
    expect(m.players.map((p) => p.input.position)).toEqual(["GK", "MID"]);
  });

  it("übersetzt Sofascore-Positionscodes", () => {
    expect(
      ["G", "D", "M", "F", "X", undefined].map(positionFromSofascore),
    ).toEqual(["GK", "DEF", "MID", "FWD", undefined, undefined]);
  });
});
