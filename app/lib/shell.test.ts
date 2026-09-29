import type { Fixture } from "@fm/core";
import { describe, expect, it } from "vitest";
import { lockLabel, nextLock } from "@/lib/shell";

const game = (
  matchday: number,
  kickoffUtc: string,
  over: Partial<Fixture> = {},
): Fixture => ({
  matchday,
  openligaMatchId: Math.floor(Math.random() * 1e6),
  homeTeamId: 1,
  awayTeamId: 2,
  kickoffUtc,
  originalKickoffUtc: kickoffUtc,
  status: "scheduled",
  dataState: "none",
  ...over,
});

const fixtures = [
  game(4, "2026-10-02T18:30:00Z"),
  game(5, "2026-10-09T18:30:00Z"),
  game(5, "2026-10-10T13:30:00Z"),
  game(5, "2026-10-10T16:30:00Z", { status: "postponed" }),
];
const finals = new Map([
  [1, new Date()],
  [2, new Date()],
  [3, new Date()],
  [4, new Date()],
]);

describe("nextLock", () => {
  it("vor dem Spieltag: erste Sperre 90 Min. vor dem ersten Anpfiff", () => {
    const lock = nextLock(fixtures, finals, new Date("2026-10-01T00:00:00Z"));
    expect(lock?.at.toISOString()).toBe("2026-10-09T17:00:00.000Z");
    expect(lock?.running).toBe(false);
    expect(lockLabel(lock!)).toBe("Fixiert in");
  });

  it("während des Spieltags: die nächste noch offene Sperre, verlegte zählen nicht", () => {
    const lock = nextLock(fixtures, finals, new Date("2026-10-09T20:00:00Z"));
    expect(lock?.at.toISOString()).toBe("2026-10-10T12:00:00.000Z");
    expect(lockLabel(lock!)).toBe("Nächste fixiert in");
    expect(
      nextLock(fixtures, finals, new Date("2026-10-10T12:00:00Z")),
    ).toBeNull();
  });
});
