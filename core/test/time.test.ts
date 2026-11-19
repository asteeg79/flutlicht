import { describe, expect, it } from "vitest";
import { formatDate, pad2 } from "../src";
import { formatKickoff } from "../src/time";

describe("Zeiten in Europe/Berlin", () => {
  it("rechnet UTC in Sommer- und Winterzeit um", () => {
    expect(formatKickoff("2026-10-09T18:30:00Z")).toBe("Fr., 09.10., 20:30");
    expect(formatKickoff("2026-11-20T19:30:00Z")).toBe("Fr., 20.11., 20:30");
  });
  it("nimmt das Berliner Datum, auch kurz vor Mitternacht UTC", () => {
    expect(formatDate("2026-10-24T22:30:00Z")).toBe("25.10.2026");
    expect(pad2(7)).toBe("07");
  });
});
