import { describe, expect, it } from "vitest";
import {
  MIN_LEAD_MS,
  TARGET_LEAD_MS,
  openTransferWindow,
} from "./e2e-window.mjs";

const fx = (matchday, kickoffUtc, originalKickoffUtc = kickoffUtc) => ({
  matchday,
  kickoffUtc,
  originalKickoffUtc,
  status: "scheduled",
});

// Wie am 06.11.2026: Spieltag 8 final, Spieltag 9 beginnt Freitag 19:30 UTC.
const FIXTURES = [
  fx(8, "2026-10-30T19:30:00Z"),
  fx(9, "2026-11-06T19:30:00Z"),
  fx(9, "2026-11-07T14:30:00Z"),
  fx(9, "2026-11-08T18:30:00Z", "2026-11-08T16:30:00Z"),
  fx(10, "2026-11-20T19:30:00Z"),
];
const FINAL = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const at = (iso) => new Date(iso);

describe("openTransferWindow", () => {
  it("lässt die Daten, wenn das Fenster noch mehr als einen Tag offen ist", () => {
    const r = openTransferWindow(FIXTURES, FINAL, at("2026-11-04T12:00:00Z"));
    expect(r.shiftMs).toBe(0);
    expect(r.fixtures).toBe(FIXTURES);
    expect(r.matchday).toBe(9);
  });

  it("verschiebt bei geschlossenem Fenster den Spieltag und alle späteren", () => {
    const now = at("2026-11-06T20:46:30Z");
    const r = openTransferWindow(FIXTURES, FINAL, now);
    const md9 = r.fixtures.filter((f) => f.matchday === 9);
    // Erster Anpfiff drei Tage nach now, auf die Minute aufgerundet.
    expect(
      Date.parse(md9[0].kickoffUtc) - now.getTime(),
    ).toBeGreaterThanOrEqual(TARGET_LEAD_MS);
    expect(Date.parse(md9[0].kickoffUtc) - now.getTime()).toBeLessThan(
      TARGET_LEAD_MS + 60_000,
    );
    expect(md9[0].kickoffUtc).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00Z$/);
    // Abstände und Reihenfolge bleiben, auch zum nächsten Spieltag.
    const d = (a, b) => Date.parse(a) - Date.parse(b);
    expect(d(md9[2].kickoffUtc, md9[0].kickoffUtc)).toBe(
      d("2026-11-08T18:30:00Z", "2026-11-06T19:30:00Z"),
    );
    expect(d(r.fixtures[4].kickoffUtc, FIXTURES[4].kickoffUtc)).toBe(r.shiftMs);
    // Verlegt bleibt verlegt, unverlegt bleibt unverlegt.
    expect(d(md9[2].kickoffUtc, md9[2].originalKickoffUtc)).toBe(2 * 3_600_000);
    expect(md9[1].kickoffUtc).toBe(md9[1].originalKickoffUtc);
    // Finale Spieltage bleiben unberührt, der Status auch.
    expect(r.fixtures[0]).toBe(FIXTURES[0]);
    expect(md9.every((f) => f.status === "scheduled")).toBe(true);
  });

  it("verschiebt auch, wenn das Fenster in weniger als einem Tag schließt", () => {
    const now = new Date(
      Date.parse("2026-11-06T19:30:00Z") - MIN_LEAD_MS + 60_000,
    );
    expect(openTransferWindow(FIXTURES, FINAL, now).shiftMs).toBeGreaterThan(0);
  });

  it("ändert nichts, wenn alle Spieltage final sind", () => {
    const r = openTransferWindow(
      FIXTURES,
      new Set([8, 9, 10]),
      at("2027-06-01T00:00:00Z"),
    );
    expect(r).toEqual({ fixtures: FIXTURES, matchday: null, shiftMs: 0 });
  });
});
