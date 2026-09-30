import {
  currentMatchday,
  formatMio,
  latestAppearance,
  lineupForMatchday,
  lockAt,
  pad2,
  participation,
  playerSeason,
  scoreManager,
} from "@fm/core";
import Link from "next/link";
import { BoardTile } from "@/components/arena/board-tile";
import { CountdownText, HeroCountdown } from "@/components/arena/countdown";
import { HeroHeader } from "@/components/arena/hero-header";
import { PageBody } from "@/components/arena/page-layout";
import type { PointsInfo } from "@/components/player-points-info";
import { STATUS_LABEL } from "@/components/points";
import { TeamLineup, type SquadEntry } from "@/components/team-lineup";
import { lastName, signedInt } from "@/lib/format";
import {
  gameData,
  playerById,
  positionById,
  statsById,
  teamById,
} from "@/lib/game-data";
import { POS_LABEL } from "@/lib/positions";
import { allManagers, currentManager } from "@/lib/session";
import { lockLabel, nextLock } from "@/lib/shell";
import { liveContext, publicManager } from "@/lib/squad";
import { leagueTable } from "@/lib/standings";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const [manager, managers] = await Promise.all([
    currentManager(),
    allManagers(),
  ]);

  if (manager.lineup === null) {
    return (
      <>
        <HeroHeader
          tag={`Gewertet ab Spieltag ${manager.firstMatchday}`}
          title={manager.teamName}
          compact={{ title: manager.teamName }}
        />
        <PageBody>
          <p className="mb-6 text-muted">
            Dein Kader ist noch leer. Stell auf dem Markt 15 Spieler zusammen,
            danach steht hier deine Elf.
          </p>
          <Link
            href="/markt"
            className="slant inline-flex h-12 items-center bg-lampe px-5 font-display text-xl font-black text-nacht uppercase"
          >
            Zum Markt · {formatMio(manager.cash)} Budget
          </Link>
        </PageBody>
      </>
    );
  }

  const ctx = liveContext();
  const matchday = currentMatchday(ctx.finals);
  const fixtures =
    matchday === null
      ? []
      : ctx.fixtures.filter((f) => f.matchday === matchday);
  const name = (id: number) => teamById.get(id)?.shortName ?? "";
  const squad: SquadEntry[] = manager.squad.flatMap((id) => {
    const p = playerById.get(id);
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
        lastName: lastName(p.shortName),
        position: p.position,
        posLabel: POS_LABEL[p.position],
        price: p.price,
        club: name(p.teamId),
        image: p.image,
        clubLogo: teamById.get(p.teamId)?.logo ?? "",
        opponent: f
          ? `${name(home ? f.awayTeamId : f.homeTeamId)} (${home ? "H" : "A"})`
          : null,
        match: f ? `${name(f.homeTeamId)} – ${name(f.awayTeamId)}` : null,
        lockAt: f ? lockAt(f).toISOString() : null,
        points: pointsInfo(p.id),
        form: statsById.get(p.id)?.form ?? null,
      },
    ];
  });

  // Tafel: Platz und Saison wie auf /tabelle; dazu der letzte finale oder der laufende Spieltag.
  const table = leagueTable(managers);
  const row = table.rows.find((r) => r.userId === manager.userId);
  const scored = table.matchdays.length > 0 && row !== undefined;
  const lastFinal = table.matchdays.filter((m) => m.status === "final").at(-1);
  const points = gameData.points.find((p) => p.matchday === matchday);
  const lineup = points
    ? lineupForMatchday(manager, points.matchday, points.status)
    : null;
  const live =
    points &&
    lineup &&
    participation(
      manager,
      points.matchday,
      gameData.season.firstScoredMatchday,
    ) === "scored"
      ? {
          matchday: points.matchday,
          status: points.status,
          total: scoreManager(
            points.matchday,
            lineup,
            points.players,
            manager.transfers,
            positionById,
          ).total,
        }
      : null;

  const now = ctx.now;
  const lock = nextLock(ctx.fixtures, ctx.finals, now);
  const serverNow = now.toISOString();

  return (
    <>
      <HeroHeader
        tag={
          matchday === null
            ? "Saison beendet"
            : `Spieltag ${pad2(matchday)}${lock?.running ? " · läuft" : ""}`
        }
        right={
          lock ? (
            <HeroCountdown
              label={lockLabel(lock)}
              target={lock.at.toISOString()}
              serverNow={serverNow}
            />
          ) : undefined
        }
        title={manager.teamName}
        compact={{
          title: manager.teamName,
          right: lock ? (
            <>
              {lock.running ? "Nächste" : "Fixiert in"}{" "}
              <CountdownText
                target={lock.at.toISOString()}
                serverNow={serverNow}
              />
            </>
          ) : undefined,
        }}
      >
        <BoardTile
          plainOnMobile
          label="Platz"
          value={scored ? row.rank : "–"}
          unit={scored ? `/${table.rows.length}` : undefined}
        />
        <BoardTile
          plainOnMobile
          label="Saison"
          value={scored ? row.total : 0}
          unit=" P."
        />
        {live ? (
          <Link href={`/spieltag/${live.matchday}`} className="min-w-0">
            <BoardTile
              plainOnMobile
              accent
              label={`${live.matchday}. Spieltag · ${STATUS_LABEL[live.status]}`}
              value={live.total}
              unit=" P."
            />
          </Link>
        ) : scored && lastFinal ? (
          <Link href={`/spieltag/${lastFinal.matchday}`} className="min-w-0">
            <BoardTile
              plainOnMobile
              accent
              label={`${lastFinal.matchday}. Spieltag`}
              value={signedInt(row.byMatchday[lastFinal.matchday] ?? 0)}
            />
          </Link>
        ) : (
          <BoardTile
            plainOnMobile
            label="Gewertet ab"
            value={`Sp. ${manager.firstMatchday}`}
          />
        )}
      </HeroHeader>
      <PageBody>
        <TeamLineup
          initialManager={publicManager(manager)}
          squad={squad}
          serverNow={serverNow}
        />
      </PageBody>
    </>
  );
}

/** Letzter Einsatz und Saison eines Spielers für Punkte-Chip und Auswahl. */
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
