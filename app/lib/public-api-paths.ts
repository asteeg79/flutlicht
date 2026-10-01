// Übernommen aus Workgrid lib/public-api-paths.ts, angepasst: Routen von Flutlicht.
/**
 * API-Routen, die absichtlich ohne Session funktionieren, jede aus einem eigenen Grund:
 *  - /api/health  öffentlicher Uptime-Check
 *  - /api/auth    NextAuth (An-/Abmeldung), Registrierung mit Einladungscode,
 *                 Passwort-Reset mit Admin-Code; vor dem Login gibt es keine Session
 *  - /api/cron/tick  Taktgeber (Cloudflare-Worker), per CRON_SECRET-Bearer geschützt
 *  - /api/scraper/heartbeat  Lebenszeichen des Heim-Rechners, per SCRAPER_SECRET-Bearer
 *                 geschützt; der Scraper hat keine Session
 *
 * Eigenes Modul, damit Middleware und Tests die Liste lesen können, ohne NextAuth
 * mitzuziehen. middleware.guard.test.ts hält sie gegen die Handler konsistent.
 */
export const PUBLIC_API_PREFIXES = [
  "/api/health",
  "/api/auth",
  "/api/cron/tick",
  "/api/scraper/heartbeat",
] as const;

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
