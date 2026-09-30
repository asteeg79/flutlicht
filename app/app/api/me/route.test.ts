import { describe, expect, it, vi } from "vitest";

let session: { user: { id: string } } | null = null;
vi.mock("@/lib/auth", () => ({ auth: async () => session }));
const updateProfile = vi.fn(async (_id: string, raw: unknown) => ({
  ...(raw as object),
  userId: "u1",
}));
vi.mock("@/lib/accounts", () => ({ updateProfile }));
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

const { GET, PUT } = await import("./route");

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

describe("PUT /api/me", () => {
  const put = (body: unknown) =>
    PUT(
      new Request("http://x/api/me", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    );

  it("antwortet ohne Session mit 401 und ändert nichts", async () => {
    session = null;
    updateProfile.mockClear();
    expect((await put({ displayName: "A", teamName: "B" })).status).toBe(401);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("ändert nur das eigene Konto und liefert die neuen Namen", async () => {
    session = { user: { id: "u1" } };
    const res = await put({ displayName: "Tommy", teamName: "Kreidelinie FC" });
    expect(updateProfile).toHaveBeenCalledWith("u1", {
      displayName: "Tommy",
      teamName: "Kreidelinie FC",
    });
    expect(await res.json()).toEqual({
      displayName: "Tommy",
      teamName: "Kreidelinie FC",
    });
  });
});
