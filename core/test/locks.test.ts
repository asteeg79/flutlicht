import { describe, expect, it } from "vitest";
import { firstLock, isLocked, lockAt } from "../src";

const fixtures = [
  { homeTeamId: 100, awayTeamId: 101, kickoffUtc: "2026-10-03T13:30:00Z" },
  { homeTeamId: 102, awayTeamId: 103, kickoffUtc: "2026-10-02T18:30:00Z" },
];

describe("Sperren (KONZEPT 2.5)", () => {
  it("sperrt 90 Minuten vor Anpfiff", () => {
    expect(lockAt(fixtures[0]!).toISOString()).toBe("2026-10-03T12:00:00.000Z");
  });

  it("findet die früheste Sperre des Spieltags", () => {
    expect(firstLock(fixtures)?.toISOString()).toBe("2026-10-02T17:00:00.000Z");
    expect(firstLock([])).toBeNull();
  });

  it("ist vor der Sperrzeit offen und ab der Sperrzeit gesperrt", () => {
    const p = { teamId: 101 };
    expect(isLocked(p, new Date("2026-10-03T11:59:59Z"), fixtures)).toBe(false);
    expect(isLocked(p, new Date("2026-10-03T12:00:00Z"), fixtures)).toBe(true);
  });

  it("sperrt jeden Spieler nach seinem eigenen Spiel", () => {
    const now = new Date("2026-10-02T20:00:00Z");
    expect(isLocked({ teamId: 102 }, now, fixtures)).toBe(true);
    expect(isLocked({ teamId: 100 }, now, fixtures)).toBe(false);
  });

  it("sperrt Spieler ohne Spiel am Spieltag nicht", () => {
    expect(
      isLocked({ teamId: 999 }, new Date("2026-12-01T00:00:00Z"), fixtures),
    ).toBe(false);
  });
});
