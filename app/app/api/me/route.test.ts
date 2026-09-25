import { describe, expect, it, vi } from "vitest";

let session: { user: { id: string } } | null = null;
vi.mock("@/lib/auth", () => ({ auth: async () => session }));
vi.mock("@/lib/storage", () => ({
  loadManager: async (id: string) =>
    id === "u1"
      ? {
          userId: "u1",
          email: "tom@example.org",
          passwordHash: "scrypt$geheim",
        }
      : null,
}));

const { GET } = await import("./route");

describe("GET /api/me", () => {
  it("antwortet ohne Session mit 401 JSON", async () => {
    session = null;
    const res = await GET(new Request("http://x/api/me"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("liefert das eigene Dokument ohne Passwort-Hash", async () => {
    session = { user: { id: "u1" } };
    const res = await GET(new Request("http://x/api/me"));
    expect(await res.json()).toEqual({
      userId: "u1",
      email: "tom@example.org",
    });
  });

  it("antwortet mit 404, wenn das Konto fehlt", async () => {
    session = { user: { id: "u2" } };
    expect((await GET(new Request("http://x/api/me"))).status).toBe(404);
  });
});
