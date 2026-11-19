import { describe, expect, it } from "vitest";
import type { ManualMatch } from "@fm/core";
import { chooseMatchData, type MatchSources } from "../src/steps/points";

const phase = (at: string) => ({ lineups: { at }, incidents: { at }, at });
const manual: ManualMatch = {
  eventId: 1,
  enteredBy: "alex",
  enteredAt: "2026-10-12T08:00:00Z",
  score: { home: 0, away: 3 },
  players: [],
};

describe("chooseMatchData: welche Quelle je Spiel gilt (KONZEPT 6.5)", () => {
  it("Admin-Nachtrag vor Sofascore-final vor Sofascore-vorläufig", () => {
    const sources = new Map<number, MatchSources>([
      [1, { provisional: phase("p"), final: phase("f"), manual }],
      [2, { provisional: phase("p"), final: phase("f") }],
      [3, { provisional: phase("p") }],
      [4, {}],
    ]);
    const chosen = chooseMatchData(sources);
    expect(chosen.get(1)).toEqual({
      kind: "manual",
      match: manual,
      at: manual.enteredAt,
    });
    expect(chosen.get(2)).toEqual({ kind: "final", ...phase("f") });
    expect(chosen.get(3)).toEqual({ kind: "provisional", ...phase("p") });
    expect(chosen.has(4)).toBe(false);
  });
});
