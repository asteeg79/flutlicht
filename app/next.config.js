// Übernommen aus Workgrid next.config.js, angepasst: Google-Hosts aus der CSP entfernt,
// @fm/core wird mitübersetzt (TypeScript-Quellen im Workspace), COOP und COEP ergänzt.
// Hinweis: next-pwa wurde entfernt (dessen aggressiver Cache verursachte
// veraltete App-Zustände). Stattdessen ein eigener, schlanker Service Worker
// (public/sw.js, registriert via components/pwa/ServiceWorkerRegister): macht
// die App installierbar, cacht aber NIE API-Antworten (kein Stale-Data-Bug).

const isDev = process.env.NODE_ENV !== "production";

// 'unsafe-eval' wird nur im Dev-Modus benötigt (React Fast Refresh). In
// Produktion wird es entfernt → härtere XSS-Abwehr. 'unsafe-inline' bleibt,
// solange Next ohne Nonce-Setup arbeitet (Folge-Härtung möglich).
const ContentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]
  .join("; ")
  .concat(";");

const securityHeaders = [
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Eigener Browsing-Kontext und nur eigene Ressourcen (Security-Wochenscan, ZAP 90004).
  // Die CSP erlaubt ohnehin nur 'self', und die Anmeldung kommt ohne Popup aus.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
  // HSTS: erzwingt HTTPS (2 Jahre, inkl. Subdomains, preload-fähig).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/**
 * Zeitpunkt des Builds als "TT.MM.JJJJ, HH:MM" in deutscher Ortszeit.
 *
 * Bewusst die Build-Zeit und nicht der Commit-Zeitpunkt: Vercel stellt kein
 * Env fuer das Commit-Datum bereit (nur SHA, Message, Author). Ein Re-Deploy
 * desselben Commits zeigt daher ein neues Datum bei gleichem Build-SHA.
 *
 * Feste Zeitzone Europe/Berlin statt UTC: der Build laeuft in UTC, die Nutzer
 * lesen deutsche Ortszeit — vorher stand hier eine Uhrzeit, die im Sommer zwei
 * Stunden zurueckhing. Die Zone ist hart gesetzt, weil der String beim Build
 * eingefroren wird; wuerde der Client ihn selbst formatieren, koennte eine
 * abweichende Zeitzone eine Hydration-Abweichung ausloesen.
 */
function buildDate() {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

/**
 * Version aus public/version.json (scripts/gen-version.mjs, Commit-Zeitstempel,
 * shallow-clone-sicher). Fehlt sie (next dev), gilt "dev".
 */
function builtVersion() {
  try {
    return require("./public/version.json");
  } catch {
    return { version: 0, commit: "dev" };
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Die Dev-Anzeige läge unten links genau über dem Team-Punkt der Navigation.
  devIndicators: false,
  transpilePackages: ["@fm/core"],
  // Vorab geladene Ladezustände (loading.tsx) eine Stunde statt 5 Min. wiederverwenden:
  // Nach etwa 10 Min. Leerlauf ist die Vercel-Funktion kalt (bis 2 s), und genau dann
  // soll das Skelett beim Tab-Wechsel sofort stehen. Seitendaten betrifft das nicht
  // (alle App-Seiten sind dynamisch, staleTimes.dynamic bleibt 0).
  experimental: { staleTimes: { static: 3600 } },
  // Build-Kennung (Git-SHA auf Vercel) — sichtbar in den Einstellungen, damit
  // verifizierbar ist, welche Client-Version geladen ist. Version kommt aus
  // der package.json, das Datum wird beim Build eingefroren.
  //
  // Das Datum wird hier bereits fertig formatiert (UTC), damit es weder auf
  // dem Server noch im Client neu formatiert werden muss — sonst koennten
  // unterschiedliche Zeitzonen eine Hydration-Abweichung ausloesen.
  env: {
    NEXT_PUBLIC_APP_VERSION: String(builtVersion().version),
    NEXT_PUBLIC_APP_COMMIT: builtVersion().commit,
    NEXT_PUBLIC_BUILD_DATE: buildDate(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
