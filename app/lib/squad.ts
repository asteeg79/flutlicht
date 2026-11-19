// Erstkader und Transfers (KONZEPT 2.2, 2.6, 2.7, 8.2). Die Regeln stehen in core;
// geschrieben wird über lib/manager-writes (optimistische Sperre per updatedAt).
import {
  applyInitialSquad,
  applyTransfer,
  matchdayCalendar,
  RULES,
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
      const result = applyInitialSquad(doc, input.players, {
        players: ctx.players,
        calendar: matchdayCalendar(ctx.fixtures, ctx.finals),
        now: ctx.now,
        startBudget: ctx.startBudget,
        firstScoredMatchday: ctx.firstScoredMatchday,
      });
      if (!result.ok)
        throw new BadRequest(result.violations.map((v) => v.message).join(" "));
      return result.state;
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
