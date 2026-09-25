// Übernommen aus Workgrid lib/time-local.ts, angepasst: statt lokaler Zeit feste
// Zeitzone Europe/Berlin über Intl, denn der Server läuft in UTC (KONZEPT 2.1).

export const TIMEZONE = "Europe/Berlin";

/** Zweistellig mit führender Null. */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const kickoffFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: TIMEZONE,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** "Fr., 09.10., 20:30" in Berliner Zeit. */
export function formatKickoff(isoUtc: string): string {
  return kickoffFormat.format(new Date(isoUtc));
}

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "09.10.2026" in Berliner Zeit. */
export function formatDate(isoUtc: string): string {
  return dateFormat.format(new Date(isoUtc));
}
