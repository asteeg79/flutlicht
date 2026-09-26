import { awaitingData } from "@fm/core";
import { gameData } from "@/lib/game-data";

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
  const club = new Map(gameData.teams.map((t) => [t.id, t.shortName]));
  const names = waiting.map(
    (f) => `${club.get(f.homeTeamId)} – ${club.get(f.awayTeamId)}`,
  );
  return (
    <div
      role="status"
      className="mb-4 rounded-xl border border-nacht-linie bg-nacht-hoch px-4 py-2 text-sm text-kreide-matt"
    >
      ⏳ Daten ausstehend für {names.join(", ")}. Die Punkte erscheinen, sobald
      sie da sind.
    </div>
  );
}
