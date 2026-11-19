import { describe, expect, it, vi } from "vitest";

// lib/api-route hängt an NextAuth; hier geht es nur ums Lesen des Bodys.
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

const { readBody } = await import("@/lib/api-route");
const { BadRequest } = await import("@/lib/errors");

const post = (body: string) =>
  new Request("http://localhost/api/x", { method: "POST", body });

describe("readBody", () => {
  it("liefert gültiges JSON unverändert", async () => {
    await expect(readBody(post('{"a":1}'))).resolves.toEqual({ a: 1 });
  });

  it("kaputtes JSON ist 400 mit fester Meldung", async () => {
    const err = await readBody(post("{kaputt")).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequest);
    expect(err).toMatchObject({ status: 400, message: "Ungültige Eingabe" });
  });
});
