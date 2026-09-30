import { describe, expect, it } from "vitest";
import { lastName, mioNumber, signedInt } from "@/lib/format";

describe("Anzeigeformate", () => {
  it("Nachname ohne Vornamen-Kürzel", () => {
    expect(lastName("J. Friedrich")).toBe("Friedrich");
    expect(lastName("E.Duarte")).toBe("Duarte");
    expect(lastName("M. Van den Bosch")).toBe("Van den Bosch");
    expect(lastName("Rômulo")).toBe("Rômulo");
  });

  it("Mio. mit einer Nachkommastelle, Vorzeichen mit echtem Minus", () => {
    expect(mioNumber(12)).toBe("12,0");
    expect(mioNumber(4.6)).toBe("4,6");
    expect(signedInt(96)).toBe("+96");
    expect(signedInt(-5)).toBe("−5");
    expect(signedInt(0)).toBe("0");
  });
});
