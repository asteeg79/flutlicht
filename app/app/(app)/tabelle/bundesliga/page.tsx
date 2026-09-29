import { bundesligaTable } from "@fm/core";
import { ClubLogo } from "@/components/club-logo";
import { HeroHeader } from "@/components/arena/hero-header";
import { PageBody } from "@/components/arena/page-layout";
import { TableTabs } from "@/components/table-tabs";
import { gameData, teamById } from "@/lib/game-data";

export const metadata = { title: "Bundesliga-Tabelle" };

/** Bundesliga-Tabelle aus den beendeten Spielen des Spielplans (OpenLigaDB). */
export default function BundesligaPage() {
  const finished = gameData.fixtures.filter((f) => f.status === "finished");
  const last = Math.max(0, ...finished.map((f) => f.matchday));
  const rows = bundesligaTable(
    gameData.fixtures,
    gameData.teams.map((t) => t.id),
  );

  return (
    <>
      <HeroHeader
        tag={last > 0 ? `Nach Spieltag ${last}` : "Vor dem 1. Spieltag"}
        title="Tabelle"
        compact={{ title: "Tabelle" }}
      />
      <PageBody>
        <TableTabs active="/tabelle/bundesliga" />
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table
            aria-label="Bundesliga"
            className="w-full text-sm tabular-nums"
          >
            <thead>
              <tr className="text-xs text-muted">
                <th
                  scope="col"
                  className="w-8 px-2 py-2 text-right font-medium"
                >
                  #
                </th>
                <th scope="col" className="px-2 py-2 text-left font-medium">
                  Verein
                </th>
                <th scope="col" className="px-1 py-2 text-right font-medium">
                  Sp.
                </th>
                <th scope="col" className="px-1 py-2 text-right font-medium">
                  S-U-N
                </th>
                <th scope="col" className="px-1 py-2 text-right font-medium">
                  Tore
                </th>
                <th scope="col" className="px-1 py-2 text-right font-medium">
                  Diff.
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Pkt.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const team = teamById.get(r.teamId);
                const diff = r.goalsFor - r.goalsAgainst;
                return (
                  <tr key={r.teamId}>
                    <td className="px-2 py-2 text-right text-muted">
                      {r.rank}
                    </td>
                    <th scope="row" className="px-2 py-2 text-left font-medium">
                      <span className="flex items-center gap-2">
                        <ClubLogo src={team?.logo} />
                        <span className="truncate">{team?.shortName}</span>
                      </span>
                    </th>
                    <td className="px-1 py-2 text-right">{r.played}</td>
                    <td className="px-1 py-2 text-right whitespace-nowrap text-muted">
                      {r.won}-{r.drawn}-{r.lost}
                    </td>
                    <td className="px-1 py-2 text-right whitespace-nowrap">
                      {r.goalsFor}:{r.goalsAgainst}
                    </td>
                    <td className="px-1 py-2 text-right">
                      {diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : "0"}
                    </td>
                    <td className="px-2 py-2 text-right font-bold">
                      {r.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Nur beendete Spiele. Bei Gleichstand nach Punkten, Tordifferenz und
          Toren teilen sich Vereine den Platz; den direkten Vergleich rechnen
          wir nicht.
        </p>
      </PageBody>
    </>
  );
}
