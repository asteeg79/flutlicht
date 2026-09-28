import { describe, expect, it } from "vitest";
import { parseDecimal } from "./decimal";

describe("parseDecimal", () => {
  it("versteht Komma und Punkt", () => {
    expect(parseDecimal("64,5")).toBe(64.5);
    expect(parseDecimal("64.5")).toBe(64.5);
    expect(parseDecimal(" 70 ")).toBe(70);
  });

  it("liefert NaN für Unsinn", () => {
    expect(parseDecimal("abc")).toBeNaN();
  });
});
