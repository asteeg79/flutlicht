import { HeroHeader } from "@/components/arena/hero-header";
import { LeagueRows } from "@/components/arena/league-rows";
import { PageBody, SectionTitle } from "@/components/arena/page-layout";
import { STATUS_LABEL } from "@/components/points";
import { TableTabs } from "@/components/table-tabs";
import { gameData } from "@/lib/game-data";
import { currentLeagueTable, currentManager } from "@/lib/session";
import type { TableRow } from "@/lib/standings";

export const metadata = { title: "Tabelle" };

const PODIUM = [
  { rank: 2, height: "h-[74px]", look: "bg-podium-2 text-podium-2-text" },
  { rank: 1, height: "h-[100px]", look: "bg-lampe text-nacht" },
  { rank: 3, height: "h-14", look: "bg-bronze text-nacht" },
] as const;

export default async function StandingsPage() {
  const [me, table] = await Promise.all([
    currentManager(),
    currentLeagueTable(),
  ]);
  const scored = table.matchdays;
  const last = scored.at(-1);
  const mine = table.rows.find((r) => r.userId === me.userId);

  const hero = (
    <HeroHeader
      guide={{ chapter: "tabelle", label: "So wird die Tabelle gewertet" }}
      tag={
        last
          ? `Nach Spieltag ${last.matchday} · ${STATUS_LABEL[last.status]}`
          : `Ab Spieltag ${gameData.season.firstScoredMatchday}`
      }
      title="Tabelle"
      compact={{
        title: "Tabelle",
        right:
          mine && last ? `Platz ${mine.rank} · ${mine.total} P.` : undefined,
      }}
    >
      <TableTabs active="/tabelle" />
    </HeroHeader>
  );

  if (scored.length === 0) {
    return (
      <>
        {hero}
        <PageBody>
          <p className="text-muted">
            Die Tabelle beginnt mit Spieltag{" "}
            {gameData.season.firstScoredMatchday}, dem ersten gewerteten
            Spieltag.
          </p>
        </PageBody>
      </>
    );
  }

  const winners = Object.values(table.winners).reverse();
  const winnerIds = Object.fromEntries(
    Object.entries(table.winners).map(([md, w]) => [md, w.ids]),
  );
  const top = (rank: number): TableRow | undefined =>
    table.rows.filter((r) => r.rank <= 3)[rank - 1];

  return (
    <>
      {hero}
      <PageBody>
        <div className="flex flex-col gap-[22px] lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-7">
          <div className="min-w-0">
            {table.rows.length >= 3 ? (
              <section
                aria-label="Podest"
                className="mb-4 grid grid-cols-3 items-end gap-1.5 pt-1 lg:hidden"
              >
                {PODIUM.map(({ rank, height, look }) => {
                  const r = top(rank);
                  return r ? (
                    <div
                      key={rank}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <span className="max-w-full truncate font-display text-xl leading-none font-black uppercase">
                        {r.displayName}
                      </span>
                      <span className="text-[11px] font-semibold text-muted">
                        {r.total} P.
                      </span>
                      <div
                        className={`flex w-full justify-center pt-1.5 font-display text-[44px] leading-none font-black [clip-path:polygon(8px_0,calc(100%_-_8px)_0,100%_100%,0_100%)] ${height} ${look}`}
                      >
                        {r.rank}
                      </div>
                    </div>
                  ) : (
                    <div key={rank} />
                  );
                })}
              </section>
            ) : null}
            <LeagueRows
              rows={table.rows.map((r) => ({
                userId: r.userId,
                rank: r.rank,
                displayName: r.displayName,
                teamName: r.teamName,
                total: r.total,
                wins: r.wins,
                movement: r.movement,
                byMatchday: r.byMatchday,
              }))}
              me={me.userId}
              matchdays={scored.map((m) => m.matchday)}
              winners={winnerIds}
            />
            <p className="mt-2.5 hidden text-xs font-medium text-muted lg:block">
              Gelb = Spieltagssieger. ▲/▼ = Platzänderung zum Vorspieltag.
            </p>
          </div>

          <aside className="flex min-w-0 flex-col gap-[22px] lg:sticky lg:top-6">
            {winners.length > 0 ? (
              <section>
                <SectionTitle>Spieltagssieger</SectionTitle>
                <ul className="-mr-[18px] flex gap-2 overflow-x-auto pr-[18px] [scrollbar-width:none] lg:mr-0 lg:flex-col lg:overflow-visible lg:pr-0">
                  {winners.map((w) => (
                    <li
                      key={w.matchday}
                      className="w-[108px] shrink-0 border-t-4 border-lampe bg-surface px-3 py-2.5 lg:flex lg:w-auto lg:items-center lg:justify-between lg:border-t-0 lg:border-l-4 lg:px-3.5 lg:py-3"
                    >
                      <span>
                        <span className="block text-[11px] font-bold tracking-[0.12em] text-muted uppercase">
                          {w.matchday}. Spieltag
                        </span>
                        <span className="mt-1 block truncate font-display text-[22px] leading-none font-black uppercase lg:mt-0.5">
                          {w.names.join(", ")}
                        </span>
                      </span>
                      <span className="mt-0.5 block font-display text-base font-extrabold text-muted lg:text-[28px] lg:font-black lg:text-text">
                        {w.points}
                        <span className="lg:hidden"> P.</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="lg:hidden">
              <SectionTitle>Verlauf</SectionTitle>
              <div className="overflow-x-auto bg-surface px-3 py-1">
                <table className="w-full tabular-nums">
                  <thead>
                    <tr className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
                      <th scope="col" className="py-1.5 text-left font-bold">
                        Manager
                      </th>
                      {scored.map((m) => (
                        <th
                          key={m.matchday}
                          scope="col"
                          className="w-10 py-1.5 text-right font-bold"
                        >
                          {m.matchday}.
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((r) => (
                      <tr
                        key={r.userId}
                        className="border-t border-line font-display text-[17px] font-extrabold"
                      >
                        <th
                          scope="row"
                          className="py-1.5 text-left font-extrabold whitespace-nowrap uppercase"
                        >
                          {r.displayName}
                        </th>
                        {scored.map((m) => (
                          <td key={m.matchday} className="py-1.5 text-right">
                            <span
                              className={
                                winnerIds[m.matchday]?.includes(r.userId)
                                  ? "bg-win-bg px-1 text-win-text"
                                  : ""
                              }
                            >
                              {r.byMatchday[m.matchday] ?? "–"}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] font-medium text-muted">
                Gelb = Spieltagssieg.
              </p>
            </section>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
