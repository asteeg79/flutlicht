import { firstLock } from "@fm/core";
import { Invites, Managers, type ManagerRow } from "@/components/admin/codes";
import {
  ManualMatchForm,
  type MatchOption,
} from "@/components/admin/manual-match";
import {
  Mapping,
  MissingValues,
  Positions,
  Recompute,
  Season,
  Status,
} from "@/components/admin/world";
import { HeroHeader } from "@/components/arena/hero-header";
import { PageBody } from "@/components/arena/page-layout";
import { gameData } from "@/lib/game-data";
import { allManagers, requireAdmin } from "@/lib/session";
import { loadLeague } from "@/lib/storage";

export const metadata = { title: "Admin" };

const SECTIONS = [
  ["status", "Status"],
  ["einladungen", "Einladungen"],
  ["manager", "Manager"],
  ["saison", "Saison"],
  ["zuordnung", "Zuordnung"],
  ["werte", "Werte"],
  ["positionen", "Positionen"],
  ["nachtrag", "Nachtrag"],
  ["neuberechnung", "Neu berechnen"],
] as const;

export default async function AdminPage() {
  const me = await requireAdmin();
  const [managers, league] = await Promise.all([allManagers(), loadLeague()]);
  const clubs = Object.fromEntries(
    gameData.teams.map((t) => [t.id, t.shortName]),
  );

  const rows: ManagerRow[] = managers
    .map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      teamName: m.teamName,
      email: m.email,
      role: m.role,
      firstMatchday: m.firstMatchday,
      hasSquad: m.squad.length > 0,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "de"));

  // Saisonstart änderbar, solange die erste Sperre des ersten gewerteten Spieltags aussteht.
  const firstScored = gameData.season.firstScoredMatchday;
  const lock = firstLock(
    gameData.fixtures.filter((f) => f.matchday === firstScored),
  );
  const seasonEditable = lock !== null && new Date() < lock;

  // Nachtrag: „manuell nachtragen“ zuerst, dann die übrigen beendeten Spiele mit Sofascore-Event.
  const needed = new Set(
    gameData.review.manualNeeded.map((m) => m.openligaMatchId),
  );
  const matches: MatchOption[] = gameData.fixtures
    .filter((f) => f.sofascoreEventId !== undefined && f.status === "finished")
    .map((f) => ({
      eventId: f.sofascoreEventId!,
      matchday: f.matchday,
      label: `${clubs[f.homeTeamId]} – ${clubs[f.awayTeamId]}${f.dataState === "manual" ? " (nachgetragen)" : ""}`,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      homeName: clubs[f.homeTeamId] ?? "Heim",
      awayName: clubs[f.awayTeamId] ?? "Gast",
      needed: needed.has(f.openligaMatchId),
    }))
    .sort(
      (a, b) => Number(b.needed) - Number(a.needed) || b.matchday - a.matchday,
    );
  const squads: Record<
    number,
    {
      id: number;
      name: string;
      position: (typeof gameData.players)[number]["position"];
    }[]
  > = {};
  for (const p of gameData.players) {
    if (!p.active) continue;
    (squads[p.teamId] ??= []).push({
      id: p.id,
      name: p.name,
      position: p.position,
    });
  }
  const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 } as const;
  for (const list of Object.values(squads))
    list.sort(
      (a, b) =>
        order[a.position] - order[b.position] ||
        a.name.localeCompare(b.name, "de"),
    );

  return (
    <>
      <HeroHeader
        tag={`Angemeldet als ${me.displayName}`}
        title="Admin"
        compact={{ title: "Admin" }}
      />
      <PageBody>
        <nav
          aria-label="Bereiche"
          className="mb-6 flex flex-wrap gap-2 text-sm"
        >
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-lg border border-line px-3 py-1.5 text-muted hover:text-text"
            >
              {label}
            </a>
          ))}
        </nav>
        <Status />
        <Invites
          initial={league.invites}
          names={Object.fromEntries(
            managers.map((m) => [m.userId, m.displayName]),
          )}
        />
        <Managers initial={rows} selfId={me.userId} />
        <Season
          firstScored={firstScored}
          budget={gameData.season.startBudget}
          editable={seasonEditable}
        />
        <Mapping entries={gameData.review.mapping} clubs={clubs} />
        <MissingValues entries={gameData.review.missingValues} clubs={clubs} />
        <Positions
          players={gameData.players.map((p) => ({
            id: p.id,
            name: p.name,
            teamId: p.teamId,
            position: p.position,
          }))}
          clubs={clubs}
        />
        <ManualMatchForm matches={matches} squads={squads} />
        <Recompute />
      </PageBody>
    </>
  );
}
