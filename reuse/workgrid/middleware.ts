import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { isRateLimited } from "@/lib/rate-limit";
import { isPublicApiPath } from "@/lib/public-api-paths";

const { auth } = NextAuth(authConfig);

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// auth() umschließt die gesamte Middleware, statt sie nur weiterzureichen:
// NextAuth wertet zuerst den authorized-Callback aus (Guard für die App-Routen)
// und stellt dem Handler danach die Session als req.auth bereit. Nur mit der
// Session in der Hand kann der API-Riegel unten selbst antworten — 401 JSON
// statt des Redirects auf /login, mit dem ein fetch() nichts anfangen kann.
//
// Nebeneffekt der Reihenfolge: ist jemand abgemeldet auf der alten Vercel-URL
// unterwegs, greift erst der /login-Redirect von NextAuth und beim Folgeaufruf
// der Domain-Redirect unten. Ein Hop mehr, dasselbe Ziel.
export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Kanonische Domain erzwingen: Besucher der alten Vercel-Produktions-URL auf
  // die (Cloudflare-Access-geschützte) Domain umleiten. /api ausgenommen, damit
  // server-zu-server-Aufrufe (z. B. Vercel-Cron auf /api/push/send) nicht
  // umgeleitet werden. Preview-Deployments (…-hash.vercel.app) bleiben offen.
  if (
    req.nextUrl.hostname === "myworkgrid.vercel.app" &&
    !pathname.startsWith("/api")
  ) {
    return NextResponse.redirect(
      new URL(pathname + req.nextUrl.search, "https://workgrid.a-tec.dev"),
      308,
    );
  }

  if (pathname.startsWith("/api")) {
    // Rate Limiting für API-Routen (Spec Abschnitt 8). Health-Check ausgenommen.
    // Läuft vor dem 401-Riegel unten — NICHT vor jeder Auth-Arbeit: der
    // auth()-Wrapper löst die Session schon auf, bevor dieser Handler startet.
    if (
      pathname !== "/api/health" &&
      (await isRateLimited(getClientIp(req)))
    ) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    // Auth-Riegel VOR den Handlern: eine neue API-Route, die withUser vergisst,
    // ist dadurch trotzdem geschützt. withUser bleibt in den Handlern bestehen —
    // es liefert ihnen die Identität und muss ohnehin prüfen, falls der Matcher
    // einen Pfad verfehlt. Deshalb ist das hier Defense in depth, kein Ersatz.
    //
    // Die Allowlist steht in lib/public-api-paths.ts; middleware.guard.test.ts
    // hält sie gegen die tatsächlichen Handler konsistent.
    if (!isPublicApiPath(pathname) && !req.auth?.user) {
      // Gleiche Form wie errorResponse in lib/api-route.ts — der Client soll
      // nicht merken, ob der Riegel oder der Handler ihn abgewiesen hat.
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
});

export const config = {
  // App-Routen (Auth-Guard) + alle API-Routen (Rate Limiting) + Einstiegspfade
  // (/, /login) für den Domain-Redirect von der alten Vercel-URL.
  matcher: [
    "/",
    "/login",
    "/board/:path*",
    "/notes/:path*",
    "/settings/:path*",
    "/api/:path*",
  ],
};
