// Erstkader und Transfers (KONZEPT 2.2, 2.6, 2.7, 8.2). Die Regeln stehen in core;
// geschrieben wird über lib/manager-writes (optimistische Sperre per updatedAt).
import {
  applyTransfer,
  defaultLineup,
  matchdayCalendar,
  RULES,
  subtractMio,
  sumPrices,
  validateSquad,
  type Fixture,
  type ManagerDoc,
  type Player,
} from "@fm/core";
import { z } from "zod";
import { BadRequest, parse } from "@/lib/api-route";
import { finals, gameData } from "@/lib/game-data";
import { updateManager } from "@/lib/manager-writes";

export interface GameContext {
  now: Date;
  players: readonly Player[];
  fixtures: readonly Fixture[];
  finals: ReadonlyMap<number, Date>;
  startBudget: number;
  firstScoredMatchday: number;
}

/** Kontext aus data/ und der Serverzeit; die Serverzeit ist maßgeblich (2.5). */
export function liveContext(): GameContext {
  return {
    now: new Date(),
    players: gameData.players,
    fixtures: gameData.fixtures,
    finals: finals(),
    startBudget: gameData.season.startBudget,
    firstScoredMatchday: gameData.season.firstScoredMatchday,
  };
}

export type PublicManager = Omit<ManagerDoc, "passwordHash">;

export function publicManager(doc: ManagerDoc): PublicManager {
  const { passwordHash: _hash, ...rest } = doc;
  return rest;
}

const UpdatedAt = z.string().min(1);

/** Feste Meldung: diese Schemas haben keine deutschen zod-Meldungen. */
export const INVALID = "Ungültige Eingabe";

const InitialInput = z.object({
  players: z.array(z.int().positive()).length(RULES.squadSize),
  updatedAt: UpdatedAt,
});

/** Erstkader: nur solange der Kader leer ist; danach laufen Änderungen über Transfers. */
export async function buildInitialSquad(
  userId: string,
  raw: unknown,
  ctx: GameContext,
): Promise<PublicManager> {
  const input = parse(InitialInput, raw, INVALID);
  const next = await updateManager(
    userId,
    (doc) => {
      if (doc.squad.length > 0)
        throw new BadRequest(
          "Dein Kader steht schon. Änderungen laufen über Transfers.",
        );

      const byId = new Map(ctx.players.map((p) => [p.id, p]));
      const picked = input.players.map((id) => byId.get(id));
      if (picked.some((p) => p === undefined))
        throw new BadRequest("Unbekannter Spieler.");
      const squad = picked as Player[];
      const violations = validateSquad(squad, ctx.startBudget);
      if (violations.length > 0)
        throw new BadRequest(violations.map((v) => v.message).join(" "));

      // Wer den Kader erst nach der ersten Sperre seines Startspieltags baut, startet später.
      const firstMatchday = Math.max(
        doc.firstMatchday,
        matchdayCalendar(ctx.fixtures, ctx.finals).firstMatchdayFor(
          ctx.now,
          ctx.firstScoredMatchday,
        ),
      );
      return {
        ...doc,
        squad: squad.map((p) => p.id),
        initialPrices: Object.fromEntries(squad.map((p) => [p.id, p.price])),
        cash: subtractMio(
          ctx.startBudget,
          sumPrices(squad.map((p) => p.price)),
        ),
        lineup: defaultLineup(squad),
        firstMatchday,
        transferBank: {
          matchday: firstMatchday,
          available: RULES.freeTransfersPerMatchday,
        },
      };
    },
    { expect: input.updatedAt, stamp: ctx.now },
  );
  return publicManager(next);
}

const TransferInput = z.object({
  out: z.int().positive(),
  in: z.int().positive(),
  updatedAt: UpdatedAt,
});

export async function makeTransfer(
  userId: string,
  raw: unknown,
  ctx: GameContext,
): Promise<{ manager: PublicManager; captainChanged: boolean; free: boolean }> {
  const input = parse(TransferInput, raw, INVALID);
  let captainChanged = false;
  let free = false;
  const next = await updateManager(
    userId,
    (doc) => {
      const result = applyTransfer(doc, input.out, input.in, {
        players: new Map(ctx.players.map((p) => [p.id, p])),
        window: matchdayCalendar(ctx.fixtures, ctx.finals).transferWindow(
          ctx.now,
        ),
        now: ctx.now,
      });
      if (!result.ok)
        throw new BadRequest(result.violations.map((v) => v.message).join(" "));
      captainChanged = result.captainChanged;
      free = result.transfer.free;
      return result.state;
    },
    { expect: input.updatedAt, stamp: ctx.now },
  );
  return { manager: publicManager(next), captainChanged, free };
}
