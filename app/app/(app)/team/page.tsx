import {
  latestAppearance,
  playerSeason,
  currentMatchday,
  firstLock,
  formatKickoff,
  formatMio,
  lineupForMatchday,
  lockAt,
  scoreManager,
} from "@fm/core";
import { STATUS_LABEL } from "@/components/points";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import type { PointsInfo } from "@/components/player-points-info";
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
  const logo = new Map(gameData.teams.map((t) => [t.id, t.logo]));
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
        image: p.image,
        clubLogo: logo.get(p.teamId) ?? "",
        opponent: f
          ? `${club.get(home ? f.awayTeamId : f.homeTeamId)} (${home ? "H" : "A"})`
          : null,
        lockAt: f ? lockAt(f).toISOString() : null,
        points: pointsInfo(p.id),
      },
    ];
  });
  const first = firstLock(fixtures);
  // Punkte des laufenden Spieltags (8.1), sobald es welche gibt und er für den Manager zählt.
  const points = gameData.points.find((p) => p.matchday === matchday);
  const lineup = points
    ? lineupForMatchday(manager, points.matchday, points.status)
    : null;
  const live =
    points && lineup && points.matchday >= manager.firstMatchday
      ? {
          matchday: points.matchday,
          status: points.status,
          total: scoreManager(
            points.matchday,
            lineup,
            points.players,
            manager.transfers,
            new Map(gameData.players.map((p) => [p.id, p.position])),
          ).total,
        }
      : null;

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
      {live ? (
        <Link
          href={`/spieltag/${live.matchday}`}
          className="mb-4 flex items-center justify-between rounded-xl border border-nacht-linie bg-nacht-hoch px-4 py-3"
        >
          <span className="text-sm">
            Spieltag {live.matchday} · {STATUS_LABEL[live.status]}
          </span>
          <span className="font-display text-3xl font-bold text-lampe tabular-nums">
            {live.total} P.
          </span>
        </Link>
      ) : null}
      <TeamLineup
        initialManager={publicManager(manager)}
        squad={squad}
        serverNow={ctx.now.toISOString()}
      />
    </>
  );
}

/** Letzter Einsatz und Saison eines Spielers für Tooltip und Auswahlleiste. */
function pointsInfo(id: number): PointsInfo {
  const latest = latestAppearance(gameData.points, id);
  const season = playerSeason(gameData.points, id);
  return {
    latest: latest && {
      matchday: latest.matchday,
      minutes: latest.entry.minutes,
      rating: latest.entry.rating,
      parts: latest.entry.parts,
      base: latest.entry.base,
    },
    season: season && {
      points: season.points,
      appearances: season.appearances,
      avgRating: season.avgRating,
    },
  };
}
