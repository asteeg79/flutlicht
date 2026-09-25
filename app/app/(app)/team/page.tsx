import {
  currentMatchday,
  firstLock,
  formatKickoff,
  formatMio,
  lockAt,
} from "@fm/core";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { TeamLineup, type SquadEntry } from "@/components/team-lineup";
import { gameData } from "@/lib/game-data";
import { currentManager } from "@/lib/session";
import { liveContext, publicManager } from "@/lib/squad";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const manager = await currentManager();

  if (manager.lineup === null) {
    return (
      <>
        <PageHeader
          context={`Gewertet ab Spieltag ${manager.firstMatchday}`}
          title={manager.teamName}
        />
        <p className="mb-6 text-kreide-matt">
          Dein Kader ist noch leer. Stell auf dem Markt 15 Spieler zusammen,
          danach steht hier deine Elf.
        </p>
        <Link
          href="/markt"
          className="inline-flex h-12 items-center rounded-xl bg-lampe px-5 font-semibold text-nacht"
        >
          Zum Markt · {formatMio(manager.cash)} Budget
        </Link>
      </>
    );
  }

  const ctx = liveContext();
  const matchday = currentMatchday(ctx.finals);
  const fixtures =
    matchday === null
      ? []
      : ctx.fixtures.filter((f) => f.matchday === matchday);
  const club = new Map(gameData.teams.map((t) => [t.id, t.shortName]));
  const byId = new Map(gameData.players.map((p) => [p.id, p]));
  const squad: SquadEntry[] = manager.squad.flatMap((id) => {
    const p = byId.get(id);
    if (!p) return [];
    const f = fixtures.find(
      (x) => x.homeTeamId === p.teamId || x.awayTeamId === p.teamId,
    );
    const home = f?.homeTeamId === p.teamId;
    return [
      {
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        position: p.position,
        price: p.price,
        club: club.get(p.teamId) ?? "",
        opponent: f
          ? `${club.get(home ? f.awayTeamId : f.homeTeamId)} (${home ? "H" : "A"})`
          : null,
        lockAt: f ? lockAt(f).toISOString() : null,
      },
    ];
  });
  const first = firstLock(fixtures);

  return (
    <>
      <PageHeader
        context={
          matchday === null
            ? "Saison beendet"
            : `Spieltag ${matchday}${first ? ` · erste Sperre ${formatKickoff(first.toISOString())}` : ""}`
        }
        title={manager.teamName}
      />
      <TeamLineup
        initialManager={publicManager(manager)}
        squad={squad}
        serverNow={ctx.now.toISOString()}
      />
    </>
  );
}
