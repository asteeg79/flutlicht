// Aufstellung ändern (KONZEPT 2.3–2.5, 8.2). Der Server entscheidet über Sperren,
// maßgeblich ist die Serverzeit und die aktuelle Anstoßzeit laut fixtures.json.
import {
  currentMatchday,
  diffLineupRespectsLocks,
  Lineup,
  lockedPlayers,
  validateLineup,
  type Player,
} from "@fm/core";
import { z } from "zod";
import { BadRequest } from "@/lib/api-route";
import {
  loadFresh,
  parse,
  publicManager,
  type GameContext,
  type PublicManager,
} from "@/lib/squad";
import { saveManager } from "@/lib/storage";

const LineupInput = z.object({ lineup: Lineup, updatedAt: z.string().min(1) });

/** Gesperrte Spieler des Kaders am aktuellen Spieltag. */
export function lockedInSquad(
  squad: readonly Player[],
  ctx: GameContext,
): Set<number> {
  const md = currentMatchday(ctx.finals);
  const fixtures =
    md === null ? [] : ctx.fixtures.filter((f) => f.matchday === md);
  return lockedPlayers(squad, ctx.now, fixtures);
}

export async function updateLineup(
  userId: string,
  raw: unknown,
  ctx: GameContext,
): Promise<PublicManager> {
  const input = parse(LineupInput, raw);
  const doc = await loadFresh(userId, input.updatedAt);
  if (doc.lineup === null)
    throw new BadRequest("Stelle zuerst deinen Erstkader auf.");

  const byId = new Map(ctx.players.map((p) => [p.id, p]));
  const squad = doc.squad
    .map((id) => byId.get(id))
    .filter((p): p is Player => p !== undefined);
  const invalid = validateLineup(input.lineup, squad);
  if (invalid.length > 0)
    throw new BadRequest(invalid.map((v) => v.message).join(" "));

  const violations = diffLineupRespectsLocks(
    doc.lineup,
    input.lineup,
    lockedInSquad(squad, ctx),
  );
  if (violations.length > 0) {
    const v = violations[0]!;
    const name =
      v.playerId === undefined ? undefined : byId.get(v.playerId)?.name;
    throw new BadRequest(name ? `${name}: ${v.message}` : v.message);
  }

  const next = {
    ...doc,
    lineup: input.lineup,
    updatedAt: ctx.now.toISOString(),
  };
  await saveManager(next);
  return publicManager(next);
}
