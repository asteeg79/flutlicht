import { describe, expect, it } from "vitest";
import { fixtureCounts, matchdayStatus, type Fixture } from "../src";

type F = Pick<
  Fixture,
  "kickoffUtc" | "originalKickoffUtc" | "status" | "dataState"
>;
const f = (over: Partial<F> = {}): F => ({
  kickoffUtc: "2026-10-10T13:30:00Z",
  originalKickoffUtc: "2026-10-10T13:30:00Z",
  status: "scheduled",
  dataState: "none",
  ...over,
});

describe("fixtureCounts (KONZEPT 2.9)", () => {
  it("zählt Spiele bis 3 Tage nach dem ursprünglichen Termin", () => {
    expect(fixtureCounts(f({ kickoffUtc: "2026-10-13T13:30:00Z" }))).toBe(true);
    expect(fixtureCounts(f({ kickoffUtc: "2026-10-13T13:30:01Z" }))).toBe(
      false,
    );
    expect(fixtureCounts(f({ kickoffUtc: "2026-10-09T18:30:00Z" }))).toBe(true);
  });
});

describe("matchdayStatus (KONZEPT 2.1)", () => {
  const done = (dataState: F["dataState"]) =>
    f({ status: "finished", dataState });

  it("ist null, solange kein gewertetes Spiel begonnen hat", () => {
    expect(matchdayStatus([f(), f()])).toBeNull();
    expect(matchdayStatus([])).toBeNull();
  });
  it("ist running, sobald ein Spiel läuft oder Daten hat", () => {
    expect(matchdayStatus([f({ status: "live" }), f()])).toBe("running");
    expect(matchdayStatus([done("provisional"), f()])).toBe("running");
    expect(matchdayStatus([done("pending"), done("final")])).toBe("running");
  });
  it("ist provisional, wenn alle beendet sind und Daten haben", () => {
    expect(matchdayStatus([done("provisional"), done("final")])).toBe(
      "provisional",
    );
  });
  it("ist final mit finalen oder manuellen Daten für alle gewerteten Spiele", () => {
    expect(matchdayStatus([done("final"), done("manual")])).toBe("final");
  });
  it("ignoriert Spiele, die mehr als 3 Tage verlegt wurden", () => {
    const moved = f({
      kickoffUtc: "2026-11-20T19:30:00Z",
      status: "postponed",
    });
    expect(matchdayStatus([done("final"), moved])).toBe("final");
  });
});
