// Spiele, die beendet sein müssten, aber noch keine Daten haben (KONZEPT 5.8, 6.3, M4).
// Genutzt vom Überfällig-Alarm der Pipeline und vom Frische-Banner der App.
import { formatKickoff } from "./time";
import type { Fixture } from "./schemas/data";
import type { ScraperHeartbeat } from "./schemas/scraper";

/** Angenommene Spieldauer ab Anpfiff inklusive Pause und Nachspielzeit. */
export const MATCH_DURATION_MS = 2 * 60 * 60 * 1000;

/**
 * Spiele ohne Daten (`pending`), die seit mehr als `graceMs` beendet sind; ältere als
 * `windowMs` nach Anpfiff zählen nicht mehr (die stehen in review/manual-needed.json).
 */
export function awaitingData(
  fixtures: readonly Fixture[],
  now: Date,
  graceMs: number,
  windowMs: number,
): Fixture[] {
  return fixtures.filter((f) => {
    const age = now.getTime() - Date.parse(f.kickoffUtc);
    return (
      f.dataState === "pending" &&
      age > MATCH_DURATION_MS + graceMs &&
      age <= windowMs
    );
  });
}

/**
 * So lange darf der Heim-Rechner schweigen. Er meldet sich bei jedem Scheduler-Lauf
 * (alle 5 Min.) und nach jedem Job; der längste Job (60 Bilder) dauert rund 20 Min.
 */
export const SCRAPER_SILENT_MS = 45 * 60 * 1000;

/** Der Heim-Rechner hat sich schon einmal gemeldet, seither aber zu lange nicht mehr. */
export function scraperSilent(seenAt: string | null, now: Date): boolean {
  return (
    seenAt !== null && now.getTime() - Date.parse(seenAt) > SCRAPER_SILENT_MS
  );
}

export interface ScraperAlarm {
  key: string;
  title: string;
  body: string;
}

/**
 * Alarme aus dem Lebenszeichen, je Schlüssel ein Push an die Admins: Stille, eine
 * laufende Sofascore-Pause, aufgegebene Jobs. Bei Stille ist der mitgeschickte Stand
 * veraltet und zählt nicht.
 */
export function scraperAlarms(
  beat: ScraperHeartbeat | null,
  now: Date,
): ScraperAlarm[] {
  if (beat === null) return [];
  if (scraperSilent(beat.seenAt, now))
    return [
      {
        key: `scraperdown:${beat.seenAt}`,
        title: "Scraper meldet sich nicht",
        body: `⚠️ Letztes Lebenszeichen des Heim-Rechners: ${formatKickoff(beat.seenAt)} Uhr.`,
      },
    ];
  const { pause, gaveUp } = beat.status;
  const alarms: ScraperAlarm[] = [];
  if (pause !== null && Date.parse(pause.until) > now.getTime())
    alarms.push({
      key: `scraperpause:${pause.until}`,
      title: "Scraper pausiert",
      body: `⚠️ ${pause.reason ?? "429/403 von Sofascore"}. Pause bis ${formatKickoff(pause.until)} Uhr.`,
    });
  for (const job of gaveUp)
    alarms.push({
      key: `scrapergaveup:${job.key}:${job.at}`,
      title: "Scraper-Job aufgegeben",
      body: `⚠️ ${job.key} wurde nach mehreren Versuchen aufgegeben.`,
    });
  return alarms;
}
