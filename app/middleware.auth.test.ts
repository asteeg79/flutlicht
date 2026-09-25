// Übernommen aus Workgrid middleware.auth.test.ts, angepasst: Pfade des Fußballmanagers,
// strenges Auth-Limit, Matcher deckt alle geschützten Seiten ab.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PROTECTED_PREFIXES } from "@/lib/auth.config";
import { PUBLIC_API_PREFIXES } from "@/lib/public-api-paths";

/**
 * Fährt die Middleware selbst gegen API-Pfade, mit und ohne Session.
 * middleware.guard.test.ts prüft nur Quelltext; dieser Test schaut auf die Antwort.
 */

let session: { user?: { id: string } } | null = null;
let limited: Record<string, boolean> = {};

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

vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  isRateLimited: async (_ip: string, kind = "api") => limited[kind] ?? false,
}));

const { NextRequest } = await import("next/server");
const mod = await import("./middleware");
const middleware = mod.default as unknown as (
  req: unknown,
) => Promise<Response>;

function request(path: string, init?: { method?: string; host?: string }) {
  return new NextRequest(
    `https://${init?.host ?? "fussballmanager.a-tec.dev"}${path}`,
    {
      method: init?.method ?? "GET",
    },
  );
}

beforeEach(() => {
  session = null;
  limited = {};
});

describe("API-Riegel in der Middleware", () => {
  it.each([
    "/api/me",
    "/api/squad/initial",
    "/api/lineup",
    "/api/admin/invites",
  ])("%s antwortet ohne Session mit 401 JSON", async (path) => {
    const res = await middleware(request(path));
    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("lässt dieselbe Route mit Session durch", async () => {
    session = { user: { id: "u1" } };
    expect((await middleware(request("/api/me"))).status).toBe(200);
  });

  it.each([...PUBLIC_API_PREFIXES])(
    "%s bleibt ohne Session erreichbar",
    async (path) => {
      expect((await middleware(request(path))).status).toBe(200);
    },
  );

  it("bremst vor dem Auth-Riegel: Rate Limit schlägt zuerst zu", async () => {
    limited.api = true;
    expect((await middleware(request("/api/me"))).status).toBe(429);
  });

  it("nimmt den Health-Check vom Rate Limit aus", async () => {
    limited.api = true;
    expect((await middleware(request("/api/health"))).status).toBe(200);
  });

  it.each([
    "/api/auth/callback/credentials",
    "/api/auth/register",
    "/api/auth/reset",
  ])("%s hat per POST das strenge Auth-Limit", async (path) => {
    limited.auth = true;
    expect((await middleware(request(path, { method: "POST" }))).status).toBe(
      429,
    );
    expect((await middleware(request(path))).status).toBe(200);
  });
});

describe("Domain und Matcher", () => {
  it("leitet die Vercel-URL auf die eigene Domain um, API ausgenommen", async () => {
    const res = await middleware(
      request("/team?x=1", { host: "fussballmanager.vercel.app" }),
    );
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(
      "https://fussballmanager.a-tec.dev/team?x=1",
    );
    session = { user: { id: "u1" } };
    expect(
      (
        await middleware(
          request("/api/me", { host: "fussballmanager.vercel.app" }),
        )
      ).status,
    ).toBe(200);
  });

  it("deckt alle geschützten Seiten im Matcher ab", () => {
    for (const prefix of PROTECTED_PREFIXES) {
      expect(mod.config.matcher, prefix).toContain(`${prefix}/:path*`);
    }
  });
});
