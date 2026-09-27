// Übernommen aus Workgrid middleware.ts, angepasst: Domain-Redirect auf die neue
// Domain, Matcher für die Routen von Flutlicht, strenges Limit für Login,
// Registrierung und Reset (KONZEPT 8.3).
import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { AUTH_LIMITED_PATHS, isRateLimited } from "@/lib/rate-limit";
import { isPublicApiPath } from "@/lib/public-api-paths";

const { auth } = NextAuth(authConfig);

const VERCEL_HOST = "flutlicht.vercel.app";
const CANONICAL_ORIGIN = "https://flutlicht.a-tec.dev";

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function tooMany() {
  return NextResponse.json(
    { error: "Zu viele Versuche. Bitte warte etwas." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}

// auth() umschließt die Middleware: erst wertet NextAuth den authorized-Callback
// aus (Guard für die App-Seiten), dann steht die Session als req.auth bereit, und
// der API-Riegel unten kann selbst mit 401 JSON antworten.
export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Kanonische Domain erzwingen; /api ausgenommen (server-zu-server, z. B. der Tick).
  if (req.nextUrl.hostname === VERCEL_HOST && !pathname.startsWith("/api")) {
    return NextResponse.redirect(
      new URL(pathname + req.nextUrl.search, CANONICAL_ORIGIN),
      308,
    );
  }

  if (pathname.startsWith("/api")) {
    const ip = getClientIp(req);
    if (
      req.method === "POST" &&
      (AUTH_LIMITED_PATHS as readonly string[]).includes(pathname)
    ) {
      if (await isRateLimited(ip, "auth")) return tooMany();
    }
    if (pathname !== "/api/health" && (await isRateLimited(ip)))
      return tooMany();

    // Riegel VOR den Handlern: eine Route, die withUser vergisst, ist trotzdem
    // geschützt. Allowlist in lib/public-api-paths.ts, geprüft von middleware.guard.test.ts.
    if (!isPublicApiPath(pathname) && !req.auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
});

// Next.js liest den Matcher statisch aus: keine Ausdrücke, nur Literale.
// Muss PROTECTED_PREFIXES aus lib/auth.config.ts abdecken (middleware.auth.test.ts).
export const config = {
  matcher: [
    "/",
    "/login",
    "/registrieren",
    "/passwort-reset",
    "/team/:path*",
    "/markt/:path*",
    "/spieltag/:path*",
    "/tabelle/:path*",
    "/spieler/:path*",
    "/einstellungen/:path*",
    "/admin/:path*",
    "/historie/:path*",
    "/api/:path*",
  ],
};
