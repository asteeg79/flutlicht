import { describe, expect, it } from "vitest";
import {
  defaultLineup,
  playerStats,
  validateLineup,
  type MatchdayPoints,
} from "../src";
import { squadPlayers } from "./helpers";

describe("defaultLineup (KONZEPT 2.3)", () => {
  // Preise: je höher die ID innerhalb der Position, desto teurer.
  const squad = squadPlayers.map((p) => ({ ...p, price: p.id }));

  it("stellt ein gültiges 4-4-2 mit den teuersten Spielern auf", () => {
    const l = defaultLineup(squad);
    expect(validateLineup(l, squad)).toEqual([]);
    expect(l).toEqual({
      formation: "4-4-2",
      starters: [2, 7, 6, 5, 4, 12, 11, 10, 9, 15, 14],
      bench: { gk: 1, b: [13, 8, 3] },
      captain: 15,
    });
  });

  it("nimmt bei gleichem Preis die kleinere ID zuerst", () => {
    const l = defaultLineup(squadPlayers);
    expect(l.starters[0]).toBe(1);
    expect(l.captain).toBe(1);
    expect(l.bench.b).toEqual([7, 12, 15]);
  });
});

describe("playerStats", () => {
  const md = (
    matchday: number,
    players: Record<string, [number, number]>,
  ): MatchdayPoints => ({
    matchday,
    status: "final",
    generatedAt: "2026-10-01T08:00:00Z",
    players: Object.fromEntries(
      Object.entries(players).map(([id, [minutes, base]]) => [
        id,
        {
          eventId: 1,
          minutes,
          started: true,
          rating: null,
          parts: {
            rating: 0,
            goals: 0,
            assists: 0,
            cleanSheet: 0,
            conceded: 0,
            penSaved: 0,
            penMissed: 0,
            ownGoals: 0,
            cards: 0,
          },
          base,
        },
      ]),
    ),
  });

  it("summiert Punkte und mittelt die letzten 5 Einsätze, Einsätze ohne Minuten zählen nicht", () => {
    const points = [1, 2, 3, 4, 5, 6].map((n) =>
      md(n, { "7": [90, n * 2], "8": [0, 0] }),
    );
    const s = playerStats([...points].reverse());
    expect(s.get(7)).toEqual({ points: 42, appearances: 6, form: 8 }); // (4+6+8+10+12)/5
    expect(s.has(8)).toBe(false);
  });
});
