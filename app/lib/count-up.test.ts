import { describe, expect, it } from "vitest";
import { easeOutCubic, tween } from "@/lib/count-up";

describe("Hochzählen", () => {
  it("ease-out startet schnell und endet genau", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
  });

  it("tween landet nach der Dauer exakt auf dem Ziel, ohne Dauer sofort", () => {
    expect(tween(10, 20, 0, 550)).toBe(10);
    expect(tween(10, 20, 275, 550)).toBeCloseTo(18.75);
    expect(tween(10, 20, 550, 550)).toBe(20);
    expect(tween(10, 20, 0, 0)).toBe(20);
  });
});
