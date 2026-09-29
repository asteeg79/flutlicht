import { HeroHeader } from "@/components/arena/hero-header";
import { PageBody } from "@/components/arena/page-layout";
import { STATUS_LABEL } from "@/components/points";
import { TableTabs } from "@/components/table-tabs";
import { gameData } from "@/lib/game-data";
import { currentManager } from "@/lib/session";
import { leagueTable } from "@/lib/standings";
import { listAllManagers } from "@/lib/storage";

export const metadata = { title: "Tabelle" };

export default async function StandingsPage() {
  const [me, managers] = await Promise.all([
    currentManager(),
    listAllManagers(),
  ]);
  const table = leagueTable(managers);
  const scored = table.matchdays;
  const last = scored.at(-1);

  if (scored.length === 0) {
    return (
      <>
        <HeroHeader title="Tabelle" compact={{ title: "Tabelle" }} />
        <PageBody>
          <TableTabs active="/tabelle" />
          <p className="text-muted">
            Die Tabelle beginnt mit Spieltag{" "}
            {gameData.season.firstScoredMatchday}, dem ersten gewerteten
            Spieltag.
          </p>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <HeroHeader
        tag={
          last
            ? `Nach Spieltag ${last.matchday} · ${STATUS_LABEL[last.status]}`
            : undefined
        }
        title="Tabelle"
        compact={{ title: "Tabelle" }}
      />
      <PageBody>
        <TableTabs active="/tabelle" />

        <ol
          aria-label="Gesamttabelle"
          className="mb-8 divide-y divide-line rounded-xl border border-line bg-surface"
        >
          {table.rows.map((r) => (
            <li
              key={r.userId}
              aria-current={r.userId === me.userId ? "true" : undefined}
              className={`flex items-center gap-3 px-4 py-3 ${r.userId === me.userId ? "bg-me-row" : ""}`}
            >
              <span className="w-7 font-display text-2xl font-bold text-muted tabular-nums">
                {r.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.displayName}</p>
                <p className="truncate text-xs text-muted">
                  {r.teamName}
                  {r.wins > 0
                    ? ` · ${r.wins} ${r.wins === 1 ? "Spieltagssieg" : "Spieltagssiege"}`
                    : ""}
                  {last && r.byMatchday[last.matchday] !== undefined
                    ? ` · zuletzt ${r.byMatchday[last.matchday]}`
                    : ""}
                </p>
              </div>
              <span className="font-display text-3xl font-bold tabular-nums">
                {r.total}
              </span>
            </li>
          ))}
        </ol>

        {Object.keys(table.winners).length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-muted">
              Spieltagssieger
            </h2>
            <ul className="space-y-1 text-sm">
              {Object.values(table.winners)
                .reverse()
                .map((w) => (
                  <li key={w.matchday} className="flex justify-between gap-3">
                    <span className="text-muted">{w.matchday}. Spieltag</span>
                    <span>
                      {w.names.join(", ")}{" "}
                      <span className="tabular-nums text-muted">
                        ({w.points})
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted">Verlauf</h2>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-muted">
                  <th
                    scope="col"
                    className="sticky left-0 bg-surface px-3 py-2 text-left font-medium"
                  >
                    Manager
                  </th>
                  {scored.map((m) => (
                    <th
                      key={m.matchday}
                      scope="col"
                      className="px-2 py-2 text-right font-medium"
                    >
                      {m.matchday}.
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.rows.map((r) => (
                  <tr key={r.userId}>
                    <th
                      scope="row"
                      className="sticky left-0 bg-surface px-3 py-2 text-left font-medium whitespace-nowrap"
                    >
                      {r.displayName}
                    </th>
                    {scored.map((m) => (
                      <td key={m.matchday} className="px-2 py-2 text-right">
                        {r.byMatchday[m.matchday] ?? "–"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </PageBody>
    </>
  );
}
