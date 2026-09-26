// Alarm „Scraper überfällig“ (KONZEPT M4): Spiele, die seit > 3 h beendet sind und noch keine Daten haben.
// Ältere Lücken (> 3 Tage) stehen in data/review/manual-needed.json und lösen keinen Alarm mehr aus.
import { awaitingData, type Fixture } from "@fm/core";

const HOUR_MS = 60 * 60 * 1000;

export function overdueFixtures(
  fixtures: readonly Fixture[],
  now: Date,
): Fixture[] {
  return awaitingData(fixtures, now, 3 * HOUR_MS, 72 * HOUR_MS);
}
