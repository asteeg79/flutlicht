// Sicherheits-Header (Security-Wochenscan, ZAP) und Domain-Redirect aus next.config.js.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const nextConfig = createRequire(import.meta.url)("./next.config.js");
// Derselbe Matcher, mit dem Next.js `source` auswertet (ohne Typen, daher per require).
const { pathToRegexp } = createRequire(import.meta.url)(
  "next/dist/compiled/path-to-regexp",
);

describe("Sicherheits-Header", () => {
  it("setzen COOP und COEP für alle Pfade", async () => {
    const [regel] = await nextConfig.headers();
    expect(regel.source).toBe("/:path*");
    const header = Object.fromEntries(
      regel.headers.map((h: { key: string; value: string }) => [
        h.key,
        h.value,
      ]),
    );
    expect(header["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(header["Cross-Origin-Embedder-Policy"]).toBe("require-corp");
  });
});

describe("Domain-Redirect", () => {
  it("leitet nur die Vercel-URL um, alle Seiten, aber nie /api", async () => {
    const [regel] = await nextConfig.redirects();
    expect(regel.has).toEqual([
      { type: "host", value: "flutlicht.vercel.app" },
    ]);
    expect(regel.destination).toBe("https://flutlicht.a-tec.dev/:path");
    expect(regel.permanent).toBe(true);
    const passt = (pfad: string) =>
      pathToRegexp(regel.source, [], { strict: true, delimiter: "/" }).test(
        pfad,
      );
    for (const pfad of ["/", "/team", "/team/abc", "/login", "/apix"])
      expect(passt(pfad), pfad).toBe(true);
    for (const pfad of ["/api", "/api/me", "/api/cron/tick"])
      expect(passt(pfad), pfad).toBe(false);
  });
});
