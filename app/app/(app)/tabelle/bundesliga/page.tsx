import { bundesligaTable } from "@fm/core";
import { HeroHeader } from "@/components/arena/hero-header";
import { PageBody } from "@/components/arena/page-layout";
import { ClubLogo } from "@/components/club-logo";
import { TableTabs } from "@/components/table-tabs";
import { signedInt } from "@/lib/format";
import { gameData, teamById } from "@/lib/game-data";

export const metadata = { title: "Bundesliga-Tabelle" };

/** Farbbalken links: Champions League, Relegation, Abstieg (Arena 5 „Bundesliga“). */
function zone(rank: number, teams: number): string {
  if (rank <= 4) return "shadow-[inset_3px_0_0_var(--color-lampe)]";
  if (rank === teams - 2)
    return "shadow-[inset_3px_0_0_var(--color-relegation)]";
  if (rank > teams - 2) return "shadow-[inset_3px_0_0_var(--color-karte)]";
  return "";
}

/** Bundesliga-Tabelle aus den beendeten Spielen des Spielplans (OpenLigaDB). */
export default function BundesligaPage() {
  const finished = gameData.fixtures.filter((f) => f.status === "finished");
  const last = Math.max(0, ...finished.map((f) => f.matchday));
  const rows = bundesligaTable(
    gameData.fixtures,
    gameData.teams.map((t) => t.id),
  );
  const head =
    "pb-2 text-[11px] font-bold tracking-[0.08em] text-muted uppercase";

  return (
    <>
      <HeroHeader
        tag={last > 0 ? `Nach Spieltag ${last}` : "Vor dem 1. Spieltag"}
        title="Tabelle"
        compact={{ title: "Bundesliga" }}
      >
        <TableTabs active="/tabelle/bundesliga" />
      </HeroHeader>
      <PageBody>
        <div className="lg:max-w-[860px]">
          <table aria-label="Bundesliga" className="w-full tabular-nums">
            <thead>
              <tr>
                <th scope="col" className={`w-7 pr-1.5 text-right ${head}`}>
                  #
                </th>
                <th scope="col" className={`text-left ${head}`}>
                  Verein
                </th>
                <th scope="col" className={`w-7 text-right ${head}`}>
                  Sp
                </th>
                <th scope="col" className={`w-14 text-right ${head}`}>
                  S-U-N
                </th>
                <th
                  scope="col"
                  className={`hidden w-14 text-right sm:table-cell ${head}`}
                >
                  Tore
                </th>
                <th scope="col" className={`w-11 text-right ${head}`}>
                  Diff
                </th>
                <th scope="col" className={`w-9 text-right ${head}`}>
                  Pkt
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const team = teamById.get(r.teamId);
                return (
                  <tr
                    key={r.teamId}
                    className={`border-t border-line ${zone(r.rank, rows.length)}`}
                  >
                    <td className="py-[7px] pr-1.5 text-right font-display text-lg font-black text-muted">
                      {r.rank}
                    </td>
                    <th
                      scope="row"
                      className="py-[7px] pl-1.5 text-left font-normal"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <ClubLogo
                          src={team?.logo}
                          className="h-[22px] w-[22px]"
                        />
                        <span className="truncate font-display text-[17px] font-extrabold uppercase">
                          {team?.shortName}
                        </span>
                      </span>
                    </th>
                    <td className="text-right text-xs font-semibold text-muted">
                      {r.played}
                    </td>
                    <td className="text-right text-xs font-semibold whitespace-nowrap text-muted">
                      {r.won}-{r.drawn}-{r.lost}
                    </td>
                    <td className="hidden text-right text-xs font-semibold whitespace-nowrap text-muted sm:table-cell">
                      {r.goalsFor}:{r.goalsAgainst}
                    </td>
                    <td className="text-right text-[13px] font-bold">
                      {signedInt(r.goalsFor - r.goalsAgainst)}
                    </td>
                    <td className="text-right font-display text-xl font-black">
                      {r.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-2.5 flex flex-wrap gap-3.5 text-[11px] font-medium text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-lampe" />
              Champions League
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-relegation" />
              Relegation
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-karte" />
              Abstieg
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">
            Nur beendete Spiele. Bei Gleichstand nach Punkten, Tordifferenz und
            Toren teilen sich Vereine den Platz; den direkten Vergleich rechnen
            wir nicht.
          </p>
        </div>
      </PageBody>
    </>
  );
}
