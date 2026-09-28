import { describe, expect, it } from "vitest";
import { bundesligaTable, type Fixture } from "../src";

const game = (
  home: number,
  away: number,
  score: [number, number] | null,
  status: Fixture["status"] = score ? "finished" : "scheduled",
) => ({
  homeTeamId: home,
  awayTeamId: away,
  status,
  score: score ? { home: score[0], away: score[1] } : undefined,
});

describe("bundesligaTable", () => {
  it("zählt nur beendete Spiele: Punkte, Tore, Bilanz", () => {
    const rows = bundesligaTable(
      [
        game(1, 2, [2, 0]),
        game(3, 1, [1, 1]),
        game(2, 3, [3, 1]),
        game(1, 3, [5, 0], "live"),
        game(2, 1, null),
      ],
      [1, 2, 3, 4],
    );
    expect(rows).toEqual([
      // 1: S 2:0, U 1:1 → 4 P., 3:1
      {
        teamId: 1,
        rank: 1,
        played: 2,
        won: 1,
        drawn: 1,
        lost: 0,
        goalsFor: 3,
        goalsAgainst: 1,
        points: 4,
      },
      // 2: N 0:2, S 3:1 → 3 P., 3:3
      {
        teamId: 2,
        rank: 2,
        played: 2,
        won: 1,
        drawn: 0,
        lost: 1,
        goalsFor: 3,
        goalsAgainst: 3,
        points: 3,
      },
      // 3: U 1:1, N 1:3 → 1 P., 2:4
      {
        teamId: 3,
        rank: 3,
        played: 2,
        won: 0,
        drawn: 1,
        lost: 1,
        goalsFor: 2,
        goalsAgainst: 4,
        points: 1,
      },
      {
        teamId: 4,
        rank: 4,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      },
    ]);
  });

  it("ordnet nach Punkten, Tordifferenz, Toren; Gleichstand teilt den Platz", () => {
    const rows = bundesligaTable(
      [game(1, 2, [1, 0]), game(3, 4, [2, 1]), game(5, 6, [1, 0])],
      [1, 2, 3, 4, 5, 6],
    );
    expect(rows.map((r) => [r.teamId, r.rank])).toEqual([
      [3, 1], // +1, 2 Tore
      [1, 2], // +1, 1 Tor
      [5, 2],
      [4, 4], // −1, 1 Tor
      [2, 5],
      [6, 5],
    ]);
  });
});
