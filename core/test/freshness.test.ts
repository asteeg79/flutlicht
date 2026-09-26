import { describe, expect, it } from "vitest";
import { awaitingData, type Fixture } from "../src";

const f = (dataState: Fixture["dataState"]): Fixture => ({
  matchday: 5,
  openligaMatchId: 1,
  homeTeamId: 1,
  awayTeamId: 2,
  kickoffUtc: "2026-10-10T13:30:00Z",
  originalKickoffUtc: "2026-10-10T13:30:00Z",
  status: "finished",
  dataState,
});
const HOUR = 60 * 60 * 1000;

describe("awaitingData", () => {
  it("meldet Spiele ohne Daten nach Spielende plus Frist, bis zum Ende des Fensters", () => {
    const grace = 1.5 * HOUR; // Frische-Banner: 90 Min. nach Spielende
    expect(
      awaitingData(
        [f("pending")],
        new Date("2026-10-10T17:00:00Z"),
        grace,
        72 * HOUR,
      ),
    ).toEqual([]);
    expect(
      awaitingData(
        [f("pending")],
        new Date("2026-10-10T17:01:00Z"),
        grace,
        72 * HOUR,
      ),
    ).toHaveLength(1);
    expect(
      awaitingData(
        [f("pending")],
        new Date("2026-10-13T13:31:00Z"),
        grace,
        72 * HOUR,
      ),
    ).toEqual([]);
  });
  it("ignoriert Spiele mit Daten", () => {
    expect(
      awaitingData(
        [f("provisional")],
        new Date("2026-10-10T20:00:00Z"),
        0,
        72 * HOUR,
      ),
    ).toEqual([]);
  });
});
