// Übernommen aus WM-Tipp infra/cron-worker/worker.mjs, angepasst: statt
// repository_dispatch ein POST auf /api/cron/tick der App; kein Monatsfilter,
// keine Nachtpause (der Tick ist billig, KONZEPT 9).
/**
 * Externer Taktgeber: Vercel Hobby erlaubt Crons nur einmal täglich, Cloudflare-
 * Cron-Trigger laufen exakt. Der Tick ist idempotent; doppelte Aufrufe schaden nicht.
 *
 * Secret (über `wrangler secret put`, NIE im Code): CRON_SECRET, gleicher Wert wie
 * in Vercel. APP_URL steht in wrangler.jsonc unter "vars".
 */
export default {
  async scheduled(_event, env) {
    const res = await fetch(`${env.APP_URL}/api/cron/tick`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CRON_SECRET}`,
        "User-Agent": "flutlicht-cron-worker",
      },
    });
    // Ergebnis sichtbar über `wrangler tail` bzw. Dashboard → Worker → Logs.
    if (res.ok) {
      console.log(`tick OK: ${await res.text()}`);
    } else {
      console.error(
        `tick fehlgeschlagen: HTTP ${res.status} — ${await res.text()}`,
      );
    }
  },
};
