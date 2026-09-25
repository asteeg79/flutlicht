/**
 * API-Routen, die absichtlich ohne Session funktionieren — jede aus einem
 * eigenen Grund:
 *  - /api/health                öffentlicher Uptime-Check
 *  - /api/auth                  NextAuth selbst (An-/Abmeldung)
 *  - /api/passkey/authenticate  usernameless Login; eine Session gibt es dort
 *                               per Definition noch nicht
 *  - /api/push/send             Vercel-Cron, per CRON_SECRET-Bearer geschützt
 *
 * Eigenes Modul, damit sowohl die Middleware als auch Tests die Liste lesen
 * können, ohne NextAuth mitzuziehen.
 *
 * ACHTUNG: Das ist der zweite Ort, der weiß, welche Routen ohne Session
 * auskommen — der erste ist das Fehlen von `withUser` im jeweiligen Handler.
 * middleware.guard.test.ts hält beide gegeneinander konsistent.
 */
export const PUBLIC_API_PREFIXES = [
  "/api/health",
  "/api/auth",
  "/api/passkey/authenticate",
  "/api/push/send",
] as const;

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
