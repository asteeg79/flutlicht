import { describe, expect, it } from "vitest";
import { lockLabel } from "@/lib/shell";

describe("lockLabel", () => {
  it("vor dem Spieltag „Fixiert in“, während des Spieltags „Nächste fixiert in“", () => {
    expect(lockLabel({ running: false })).toBe("Fixiert in");
    expect(lockLabel({ running: true })).toBe("Nächste fixiert in");
  });
});
