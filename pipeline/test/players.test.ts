import { describe, expect, it } from "vitest";
import {
  buildPlayers,
  type PlayersInput,
  type SquadPlayer,
} from "../src/steps/players";
import { buildSeason } from "../src/steps/season";

const sp = (id: number, over: Partial<SquadPlayer> = {}): SquadPlayer => ({
  id,
  name: `Spieler ${id}`,
  shortName: `S. ${id}`,
  lastName: `Nachname${id}`,
  position: "MID",
  birthDate: "2000-01-01",
  sofascoreValueEur: 1_000_000,
  ...over,
});

const base: PlayersInput = {
  teams: [
    { id: 10, tmClubId: "100" },
    { id: 20, tmClubId: "200" },
  ],
  snapshots: [],
  tmCrawl: [],
  dcaribou: [],
  manualPositions: {},
  manualValues: {},
  manualMapping: {},
  imageIds: new Set(),
};

describe("buildPlayers", () => {
  it("friert die Position aus dem ersten Kader-Stand ein, nimmt Name und Verein aus dem neuesten", () => {
    const r = buildPlayers({
      ...base,
      snapshots: [
        {
          date: "2026-10-01",
          teamId: 20,
          players: [sp(1, { position: "FWD", name: "Neu Name" })],
        },
        {
          date: "2026-09-25",
          teamId: 10,
          players: [sp(1, { position: "DEF" })],
        },
      ],
    });
    expect(r.players[0]).toMatchObject({
      id: 1,
      position: "DEF",
      name: "Neu Name",
      teamId: 20,
      active: true,
    });
  });

  it("markiert Spieler, die aus dem neuesten Kader verschwunden sind, als inaktiv und nicht kaufbar", () => {
    const r = buildPlayers({
      ...base,
      manualMapping: { "1": "11", "2": "12" },
      snapshots: [
        { date: "2026-09-25", teamId: 10, players: [sp(1), sp(2), sp(3)] },
        { date: "2026-10-01", teamId: 10, players: [sp(1), sp(3)] },
      ],
    });
    // 3 ist aktiv, aber ohne Transfermarkt-Zuordnung: nicht kaufbar.
    expect(r.players.map((p) => [p.id, p.active, p.purchasable])).toEqual([
      [1, true, true],
      [2, false, false],
      [3, true, false],
    ]);
  });

  it("wählt den Wert nach Priorität und rechnet den Startpreis mit dem eingefrorenen vMax", () => {
    const r = buildPlayers({
      ...base,
      snapshots: [
        {
          date: "2026-09-25",
          teamId: 10,
          players: [
            sp(1, { sofascoreValueEur: 140_000_000 }),
            sp(2, { lastName: "Querfeld" }),
          ],
        },
        // Später dazugekommen: zählt nicht für vMax.
        {
          date: "2026-10-01",
          teamId: 10,
          players: [
            sp(1),
            sp(2, { lastName: "Querfeld" }),
            sp(3, { sofascoreValueEur: 500_000_000 }),
          ],
        },
      ],
      tmCrawl: [
        {
          tmId: "77",
          name: "Spieler 2",
          lastName: "Querfeld",
          birthDate: "2000-01-01",
          tmClubId: "100",
          valueEur: 35_000_000,
        },
      ],
      manualValues: { "3": 8_750_000 },
    });
    expect(r.vMaxEur).toBe(140_000_000);
    expect(
      r.players.map((p) => [
        p.id,
        p.valueSource,
        p.startValueEur,
        p.price,
        p.tmId,
      ]),
    ).toEqual([
      [1, "sofascore", 140_000_000, 25, undefined],
      [2, "tm-crawl", 35_000_000, 12.5, "77"],
      [3, "manual", 8_750_000, 6.3, undefined],
    ]);
  });

  it("listet Spieler ohne Wert und nimmt Positionskorrekturen und Bilder auf", () => {
    const r = buildPlayers({
      ...base,
      snapshots: [
        {
          date: "2026-09-25",
          teamId: 10,
          players: [
            sp(1),
            sp(2, { sofascoreValueEur: undefined, position: undefined }),
          ],
        },
      ],
      manualPositions: { "2": "GK" },
      imageIds: new Set([1]),
    });
    expect(r.players[0]!.image).toBe("/img/players/1.webp");
    expect(r.players[1]).toMatchObject({
      position: "GK",
      valueSource: "missing",
      price: 0.5,
      purchasable: false,
    });
    expect(r.missingValues).toEqual([
      { playerId: 2, name: "Spieler 2", teamId: 10, position: "GK" },
    ]);
    expect(r.mappingReview.map((m) => m.reason)).toEqual([
      "not-found",
      "not-found",
    ]);
  });

  it("bricht bei fehlender Position oder ohne jeden Marktwert ab", () => {
    expect(() =>
      buildPlayers({
        ...base,
        snapshots: [
          { date: "d", teamId: 10, players: [sp(1, { position: undefined })] },
        ],
      }),
    ).toThrow(/ohne Position/);
    expect(() =>
      buildPlayers({
        ...base,
        snapshots: [
          {
            date: "d",
            teamId: 10,
            players: [sp(1, { sofascoreValueEur: undefined })],
          },
        ],
      }),
    ).toThrow(/Marktwert/);
  });
});

describe("buildSeason", () => {
  const players = Array.from({ length: 12 }, (_, i) => ({
    ...sp(i + 1),
    teamId: 10,
    position: "MID" as const,
    valueSource: "sofascore" as const,
    price: i < 11 ? 4.2 : 20,
    purchasable: true,
    active: true,
  }));
  const minutes = new Map(players.map((p) => [p.id, p.id <= 11 ? 90 : 0]));

  it("rechnet das Startbudget aus den Stammspielern: Median 4.2 → 65 Mio.", () => {
    const s = buildSeason(
      players,
      minutes,
      { firstScoredMatchday: 8 },
      140_000_000,
    );
    expect(s).toMatchObject({
      startBudget: 65,
      vMaxEur: 140_000_000,
      firstScoredMatchday: 8,
      matchdays: 34,
    });
  });

  it("übernimmt ein Startbudget des Admins", () => {
    expect(
      buildSeason(
        players,
        minutes,
        { firstScoredMatchday: 8, startBudget: 70 },
        1,
      ).startBudget,
    ).toBe(70);
  });
});
