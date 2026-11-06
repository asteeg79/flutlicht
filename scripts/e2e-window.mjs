// Offenes Transferfenster für die E2E-Tests (nur über stage-data.mjs mit
// FM_E2E_TRANSFER_WINDOW=open, siehe app/playwright.config.ts).
//
// Die E2E-Tests laufen gegen die echten Daten aus data/ und die echte Uhrzeit. Das
// Fenster schließt 90 Minuten vor dem ersten Anpfiff des aktuellen Spieltags und
// öffnet erst, wenn der Spieltag final ist (core/src/transfers.ts). Ohne diese
// Verschiebung findet „Holen“ (e2e/market.spec.ts) an jedem Spieltag-Wochenende
// keinen Spieler und jeder E2E-Lauf ist rot, am 06.11.2026 ab 18:00 UTC.
//
// Verschoben werden nur die gestagten Daten unter app/generated/data, nie data/.

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Unter diesem Vorlauf bis zum ersten Anpfiff gilt das Fenster als (bald) zu. */
export const MIN_LEAD_MS = DAY_MS;
/** So weit liegt der erste Anpfiff nach der Verschiebung in der Zukunft. */
export const TARGET_LEAD_MS = 3 * DAY_MS;

const shiftIso = (iso, ms) =>
  new Date(Date.parse(iso) + ms).toISOString().replace(/\.000Z$/, "Z");

/**
 * Hält das Transferfenster für die Testdauer offen: Liegt der erste Anpfiff des
 * aktuellen Spieltags (kleinster nicht finaler) weniger als MIN_LEAD_MS in der
 * Zukunft oder schon zurück, rücken dieser und alle späteren Spieltage um denselben
 * Betrag nach hinten, bis der erste Anpfiff TARGET_LEAD_MS nach `now` liegt.
 * kickoffUtc und originalKickoffUtc wandern gemeinsam, damit kein Spiel als
 * verlegt gilt. Abstände und Reihenfolge bleiben, der Status der Spiele auch.
 *
 * @param {readonly {matchday: number, kickoffUtc: string, originalKickoffUtc?: string | null}[]} fixtures
 * @param {ReadonlySet<number>} finalMatchdays finalisierte Spieltage
 * @param {Date} now
 */
export function openTransferWindow(fixtures, finalMatchdays, now) {
  const matchday = [...new Set(fixtures.map((f) => f.matchday))]
    .sort((a, b) => a - b)
    .find((md) => !finalMatchdays.has(md));
  if (matchday === undefined) return { fixtures, matchday: null, shiftMs: 0 };

  const firstKickoff = Math.min(
    ...fixtures
      .filter((f) => f.matchday === matchday)
      .map((f) => Date.parse(f.kickoffUtc)),
  );
  if (firstKickoff - now.getTime() >= MIN_LEAD_MS)
    return { fixtures, matchday, shiftMs: 0 };

  // Auf volle Minuten, damit die Zeiten wie in data/ ohne Sekunden bleiben.
  const shiftMs =
    Math.ceil((now.getTime() + TARGET_LEAD_MS - firstKickoff) / MINUTE_MS) *
    MINUTE_MS;
  return {
    matchday,
    shiftMs,
    fixtures: fixtures.map((f) =>
      f.matchday < matchday
        ? f
        : {
            ...f,
            kickoffUtc: shiftIso(f.kickoffUtc, shiftMs),
            ...(f.originalKickoffUtc
              ? { originalKickoffUtc: shiftIso(f.originalKickoffUtc, shiftMs) }
              : {}),
          },
    ),
  };
}
