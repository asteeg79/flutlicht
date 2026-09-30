import { awaitingData } from "@fm/core";
import { gameData, teamById } from "@/lib/game-data";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Frische-Banner (KONZEPT 6.3, 5.8): ein Spiel ist seit > 90 Min. beendet, aber es gibt
 * noch keine Punkte dafür. Stand ist der ausgelieferte Build von data/.
 */
export function FreshnessBanner() {
  const waiting = awaitingData(
    gameData.fixtures,
    new Date(),
    1.5 * HOUR_MS,
    72 * HOUR_MS,
  );
  if (waiting.length === 0) return null;
  const names = waiting.map(
    (f) =>
      `${teamById.get(f.homeTeamId)?.shortName} – ${teamById.get(f.awayTeamId)?.shortName}`,
  );
  return (
    <div
      role="status"
      className="border-b border-line bg-surface px-[18px] pt-[calc(env(safe-area-inset-top)+8px)] pb-2 text-sm text-muted lg:px-9 lg:pt-2"
    >
      ⏳ Daten ausstehend für {names.join(", ")}. Die Punkte erscheinen, sobald
      sie da sind.
    </div>
  );
}
