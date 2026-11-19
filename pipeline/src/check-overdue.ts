// Alarm „Scraper überfällig“ (KONZEPT M4): Spiele, die seit > 3 h beendet sind und noch keine Daten haben.
// Ältere Lücken (> 3 Tage) stehen in data/review/manual-needed.json und lösen keinen Alarm mehr aus.
import {
  awaitingData,
  DATA_ALARM_AFTER_MS,
  DATA_WINDOW_MS,
  type Fixture,
} from "@fm/core";

export function overdueFixtures(
  fixtures: readonly Fixture[],
  now: Date,
): Fixture[] {
  return awaitingData(fixtures, now, DATA_ALARM_AFTER_MS, DATA_WINDOW_MS);
}
