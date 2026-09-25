// Alarm „Scraper überfällig“ (KONZEPT M4): Spiele, die seit > 3 h beendet sind und noch keine Daten haben.
// Ältere Lücken (> 3 Tage) stehen in data/review/manual-needed.json und lösen keinen Alarm mehr aus.
import type { Fixture } from "@fm/core";

const HOUR_MS = 60 * 60 * 1000;
/** Anpfiff + 2 h Spieldauer + 3 h Frist */
const OVERDUE_AFTER_MS = 5 * HOUR_MS;
const ALARM_WINDOW_MS = 72 * HOUR_MS;

export function overdueFixtures(
  fixtures: readonly Fixture[],
  now: Date,
): Fixture[] {
  return fixtures.filter((f) => {
    const age = now.getTime() - Date.parse(f.kickoffUtc);
    return (
      f.dataState === "pending" &&
      age > OVERDUE_AFTER_MS &&
      age <= ALARM_WINDOW_MS
    );
  });
}
