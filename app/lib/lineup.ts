// Aufstellung ändern (KONZEPT 2.3–2.5, 8.2). Der Server entscheidet über Sperren,
// maßgeblich ist die Serverzeit und die aktuelle Anstoßzeit laut fixtures.json.
import {
  diffLineupRespectsLocks,
  Lineup,
  matchdayCalendar,
  validateLineup,
  type Player,
} from "@fm/core";
import { z } from "zod";
import { BadRequest, parse } from "@/lib/errors";
import { updateManager } from "@/lib/manager-writes";
import {
  INVALID,
  publicManager,
  type GameContext,
  type PublicManager,
} from "@/lib/squad";

const LineupInput = z.object({ lineup: Lineup, updatedAt: z.string().min(1) });

export async function updateLineup(
  userId: string,
  raw: unknown,
  ctx: GameContext,
): Promise<PublicManager> {
  const input = parse(LineupInput, raw, INVALID);
  const next = await updateManager(
    userId,
    (doc) => {
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
        matchdayCalendar(ctx.fixtures, ctx.finals).lockedPlayers(
          squad,
          ctx.now,
        ),
      );
      if (violations.length > 0) {
        const v = violations[0]!;
        const name =
          v.playerId === undefined ? undefined : byId.get(v.playerId)?.name;
        throw new BadRequest(name ? `${name}: ${v.message}` : v.message);
      }
      return { ...doc, lineup: input.lineup };
    },
    { expect: input.updatedAt, stamp: ctx.now },
  );
  return publicManager(next);
}
