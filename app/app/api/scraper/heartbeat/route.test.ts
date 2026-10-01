import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(async () => {
  vi.stubEnv("FM_LOCAL_DATA_DIR", await mkdtemp(join(tmpdir(), "fm-beat-")));
  vi.stubEnv("APP_ENCRYPTION_SECRET", "test-secret-00000000000000000000");
  vi.stubEnv("SCRAPER_SECRET", "pi-geheim");
});
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

const { POST } = await import("./route");
const storage = await import("@/lib/storage");

const STATUS = {
  pause: {
    until: "2026-10-10T15:41:21.585114+00:00",
    reason: "wiederholt 403/Bot-Challenge bei https://x/team/2671/players",
  },
  lastJob: null,
  due: [{ key: "squads:2026-10-08", attempts: 0 }],
  next: [{ key: "round:5", at: "2026-10-13T09:07:33.490940+00:00" }],
  gaveUp: [],
  commit: "5cfb8a4",
  unpushed: 0,
};

const beat = (authorization?: string, body: unknown = STATUS) =>
  POST(
    new Request("http://x/api/scraper/heartbeat", {
      method: "POST",
      headers: authorization ? { authorization } : {},
      body: JSON.stringify(body),
    }),
  );

describe("POST /api/scraper/heartbeat", () => {
  it("verlangt den Bearer SCRAPER_SECRET und speichert sonst nichts", async () => {
    expect((await beat()).status).toBe(401);
    expect((await beat("Bearer falsch")).status).toBe(401);
    expect(await storage.loadScraperHeartbeat()).toBeNull();
  });

  it("lehnt alles ab, solange kein Secret gesetzt ist", async () => {
    vi.stubEnv("SCRAPER_SECRET", "");
    expect((await beat("Bearer ")).status).toBe(401);
  });

  it("merkt sich den Stand und den Zeitpunkt der Meldung nach der Server-Uhr", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-10T12:00:00Z") });
    const res = await beat("Bearer pi-geheim");
    vi.useRealTimers();
    expect(res.status).toBe(200);
    expect(await storage.loadScraperHeartbeat()).toEqual({
      seenAt: "2026-10-10T12:00:00.000Z",
      status: STATUS,
    });
  });

  it("weist einen ungültigen Stand mit 400 ab und speichert nichts", async () => {
    const res = await beat("Bearer pi-geheim", { ...STATUS, unpushed: -1 });
    expect(res.status).toBe(400);
    expect(await storage.loadScraperHeartbeat()).toBeNull();
  });
});
