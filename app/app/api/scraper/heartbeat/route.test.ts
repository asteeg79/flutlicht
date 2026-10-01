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

const beat = (authorization?: string) =>
  POST(
    new Request("http://x/api/scraper/heartbeat", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
  );

describe("POST /api/scraper/heartbeat", () => {
  it("verlangt den Bearer SCRAPER_SECRET und speichert sonst nichts", async () => {
    expect((await beat()).status).toBe(401);
    expect((await beat("Bearer falsch")).status).toBe(401);
    expect(await storage.loadScraperSeenAt()).toBeNull();
  });

  it("lehnt alles ab, solange kein Secret gesetzt ist", async () => {
    vi.stubEnv("SCRAPER_SECRET", "");
    expect((await beat("Bearer ")).status).toBe(401);
  });

  it("merkt sich den Zeitpunkt der Meldung nach der Server-Uhr", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-10T12:00:00Z") });
    const res = await beat("Bearer pi-geheim");
    vi.useRealTimers();
    expect(res.status).toBe(200);
    expect(await storage.loadScraperSeenAt()).toBe("2026-10-10T12:00:00.000Z");
  });
});
