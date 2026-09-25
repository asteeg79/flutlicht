import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUBLIC_API_PREFIXES } from "@/lib/public-api-paths";

/**
 * Fährt die Middleware selbst gegen API-Pfade — mit und ohne Session.
 *
 * middleware.guard.test.ts prüft nur Quelltext (withUser vs. Allowlist) und
 * konnte deshalb nicht sehen, dass der Riegel eine Zeit lang wirkungslos war:
 * der authorized-Callback gibt für /api-Pfade `true` zurück, also lief jeder
 * Request durch. Dieser Test hier ruft den Handler auf und schaut auf die
 * Antwort.
 *
 * Der authorized-Callback (Guard für /board, /notes, /settings) steckt im
 * gemockten auth()-Wrapper und ist hier bewusst nicht Gegenstand — dieser Test
 * gilt dem API-Riegel.
 */

let session: { user?: { id: string } } | null = null;
let rateLimited = false;

vi.mock("next-auth", () => ({
  default: () => ({
    auth:
      (handler: (req: unknown) => unknown) =>
      (req: Record<string, unknown>) => {
        req.auth = session;
        return handler(req);
      },
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: async () => rateLimited,
}));

const { NextRequest } = await import("next/server");
const middleware = (await import("./middleware")).default as unknown as (
  req: unknown,
) => Promise<Response>;

function request(path: string) {
  return new NextRequest(`https://workgrid.a-tec.dev${path}`);
}

beforeEach(() => {
  session = null;
  rateLimited = false;
});

describe("API-Riegel in der Middleware", () => {
  it.each([
    "/api/data",
    "/api/data/version",
    "/api/calendar",
    "/api/passkey/register/options",
    "/api/passkey/list",
    "/api/push/subscribe",
    "/api/account",
  ])("%s antwortet ohne Session mit 401", async (path) => {
    const res = await middleware(request(path));
    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("lässt dieselbe Route mit Session durch", async () => {
    session = { user: { id: "u1" } };
    const res = await middleware(request("/api/data"));
    expect(res.status).toBe(200);
  });

  // Aus der Allowlist gespeist statt abgeschrieben: wird dort ein Eintrag
  // ergänzt oder gestrichen, zieht dieser Test von selbst nach.
  it.each([...PUBLIC_API_PREFIXES])(
    "%s bleibt ohne Session erreichbar",
    async (path) => {
      const res = await middleware(request(path));
      expect(res.status).toBe(200);
    },
  );

  it("bremst vor dem Auth-Riegel: Rate Limit schlägt zuerst zu", async () => {
    rateLimited = true;
    const res = await middleware(request("/api/data"));
    expect(res.status).toBe(429);
  });

  it("nimmt den Health-Check vom Rate Limit aus", async () => {
    rateLimited = true;
    const res = await middleware(request("/api/health"));
    expect(res.status).toBe(200);
  });
});
