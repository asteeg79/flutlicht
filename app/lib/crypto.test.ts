import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt } from "@/lib/crypto";

beforeEach(() => {
  vi.stubEnv("APP_ENCRYPTION_SECRET", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("crypto", () => {
  it("entschlüsselt, was encrypt verschlüsselt hat", () => {
    expect(decrypt(encrypt("Kader", "u1"), "u1")).toBe("Kader");
  });

  it("lehnt ein verkürztes Auth-Tag ab", () => {
    // Ein Wert unter 28 Byte liefert ein kürzeres Tag als 16 Byte. Ohne feste
    // Tag-Länge nähme GCM auch 4 Byte an, und das Tag wäre leicht zu erraten.
    const kurz = Buffer.concat([randomBytes(12), randomBytes(4)]).toString(
      "base64",
    );
    expect(() => decrypt(kurz, "u1")).toThrow(/authentication tag length/i);
  });
});
