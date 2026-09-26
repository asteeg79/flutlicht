// Übernommen aus Workgrid middleware.guard.test.ts, angepasst: withAdmin zählt wie withUser,
// Routen und Pfade von Flutlicht.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_API_PREFIXES, isPublicApiPath } from "@/lib/public-api-paths";

/**
 * Hält die zwei Orte konsistent, die wissen, welche API-Routen ohne Session
 * auskommen: die Allowlist in middleware.ts und das Fehlen von `withUser` im
 * jeweiligen Handler.
 *
 * Ohne diesen Test könnte die Allowlist leise veralten — genau das Risiko, das
 * ein zweiter Durchsetzungsort mitbringt. Eine neue Route, die withUser
 * vergisst, faellt hier ebenfalls auf.
 */

// Relativ zu dieser Datei, nicht zum Arbeitsverzeichnis: der Root-Lauf startet im Repo-Stamm.
const API_DIR = fileURLToPath(new URL("./app/api", import.meta.url));

/** Alle route.ts unter app/api mit ihrem URL-Pfad. */
function findRoutes(
  dir = API_DIR,
  prefix = "/api",
): { path: string; file: string }[] {
  const out: { path: string; file: string }[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // [...nextauth] o. ä. → als Segment übernehmen
      out.push(...findRoutes(full, `${prefix}/${entry}`));
    } else if (entry === "route.ts") {
      out.push({ path: prefix, file: full });
    }
  }
  return out;
}

const routes = findRoutes();

describe("API-Routen: Auth-Abdeckung", () => {
  it("findet überhaupt Routen (sonst prüft der Test nichts)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(5);
  });

  it.each(routes.map((r) => [r.path, r.file]))(
    "%s ist entweder durch withUser geschützt oder ausdrücklich öffentlich",
    (path, file) => {
      const source = readFileSync(file, "utf8");
      const usesWithUser =
        source.includes("withUser(") || source.includes("withAdmin(");
      const isPublic = isPublicApiPath(path);

      // Genau eines von beidem muss zutreffen. Beides zugleich wäre ein
      // Widerspruch, keines ein Loch.
      expect(
        usesWithUser !== isPublic,
        usesWithUser
          ? `${path} nutzt withUser, steht aber auf der Allowlist`
          : `${path} nutzt kein withUser und steht nicht auf der Allowlist`,
      ).toBe(true);
    },
  );

  it("jeder Eintrag der Allowlist deckt mindestens eine echte Route", () => {
    // Verhindert, dass ein Eintrag stehen bleibt, dessen Route es nicht mehr gibt.
    for (const prefix of PUBLIC_API_PREFIXES) {
      const matching = routes.filter(
        (r) => r.path === prefix || r.path.startsWith(`${prefix}/`),
      );
      expect(
        matching.length,
        `Allowlist-Eintrag ${prefix} deckt keine Route`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("isPublicApiPath", () => {
  it.each([
    ["/api/health", true],
    ["/api/auth/signin", true],
    ["/api/auth/callback/credentials", true],
    ["/api/auth/register", true],
    ["/api/auth/reset", true],
  ])("%s ist öffentlich", (path, expected) => {
    expect(isPublicApiPath(path)).toBe(expected);
  });

  it.each([
    "/api/me",
    "/api/squad/initial",
    "/api/transfer",
    "/api/lineup",
    "/api/standings",
    "/api/admin/invites",
  ])("%s braucht eine Session", (path) => {
    expect(isPublicApiPath(path)).toBe(false);
  });

  it("ein Präfix schützt nicht versehentlich Nachbarpfade", () => {
    // "/api/healthcheck" darf NICHT von "/api/health" abgedeckt sein.
    expect(isPublicApiPath("/api/healthcheck")).toBe(false);
    expect(isPublicApiPath("/api/authx")).toBe(false);
  });
});
