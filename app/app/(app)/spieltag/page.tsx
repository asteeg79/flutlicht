import { currentMatchday, formatKickoff } from "@fm/core";
import { PageHeader } from "@/components/page-header";
import { finals, gameData } from "@/lib/game-data";

export const metadata = { title: "Spieltag" };

export default function MatchdayPage() {
  const matchday = currentMatchday(finals());
  if (matchday === null) {
    return <PageHeader context="Saison beendet" title="Spieltag" />;
  }
  const teamName = new Map(gameData.teams.map((t) => [t.id, t.shortName]));
  const fixtures = gameData.fixtures.filter((f) => f.matchday === matchday);
  return (
    <>
      <PageHeader
        context="Aktueller Spieltag"
        title={`${matchday}. Spieltag`}
      />
      <ul className="divide-y divide-nacht-linie rounded-xl border border-nacht-linie bg-nacht-hoch">
        {fixtures.map((f) => (
          <li
            key={f.openligaMatchId}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <span>
              {teamName.get(f.homeTeamId)} – {teamName.get(f.awayTeamId)}
            </span>
            {f.score ? (
              <span className="font-display text-2xl font-bold tabular-nums">
                {f.score.home}:{f.score.away}
              </span>
            ) : (
              <span className="text-sm text-kreide-matt">
                {formatKickoff(f.kickoffUtc)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
