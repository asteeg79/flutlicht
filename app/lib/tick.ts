// Ausführung des Taktgebers (KONZEPT 9). Was fällig ist, entscheidet core/planTick;
// hier: Finalisierung speichern, Schlüssel merken, Pushes senden.
import { finalizeManager, matchdayBonuses, planTick } from "@fm/core";
import { finals, gameData } from "@/lib/game-data";
import {
  sendPush,
  type PushPayload,
  type PushResult,
  type PushTarget,
} from "@/lib/push";
import {
  listAllManagers,
  loadManager,
  loadSystemState,
  saveManager,
  saveSystemState,
} from "@/lib/storage";

type Game = Pick<typeof gameData, "players" | "fixtures" | "points" | "season">;
type Sender = (
  subscription: PushTarget,
  payload: PushPayload,
) => Promise<PushResult>;

export interface TickResult {
  finalized: number[];
  sent: number;
  failed: number;
  expired: number;
}

export async function runTick(
  now: Date,
  game: Game = gameData,
  send: Sender = sendPush,
  finalsOf: () => ReadonlyMap<number, Date> = finals,
): Promise<TickResult> {
  const state = await loadSystemState();
  const managers = await listAllManagers();
  const actions = planTick({
    now,
    done: new Set(Object.keys(state.done)),
    managers,
    players: game.players,
    fixtures: game.fixtures,
    points: game.points,
    firstScoredMatchday: game.season.firstScoredMatchday,
  });
  const result: TickResult = { finalized: [], sent: 0, failed: 0, expired: 0 };
  const at = now.toISOString();

  // Finalisierung zuerst; sie ist idempotent, der Schlüssel folgt erst danach.
  const positions = new Map(game.players.map((p) => [p.id, p.position]));
  const finalDates = finalsOf();
  for (const action of actions) {
    if (action.kind !== "finalize") continue;
    // Prämien vorab für alle, weil der Median alle Manager braucht (2.7).
    const md = game.points.find((p) => p.matchday === action.matchday);
    const bonuses = md
      ? matchdayBonuses(
          managers,
          md,
          positions,
          game.season.firstScoredMatchday,
        )
      : new Map();
    for (const m of managers) {
      // Frisch laden: zwischen Liste und Speichern kann der Manager etwas geändert haben.
      const doc = await loadManager(m.userId);
      if (!doc) continue;
      const next = finalizeManager(
        doc,
        action.matchday,
        game.fixtures,
        finalDates,
        {
          firstScoredMatchday: game.season.firstScoredMatchday,
          bonus: bonuses.get(m.userId)?.bonus ?? 0,
        },
      );
      if (JSON.stringify(next) !== JSON.stringify(doc)) await saveManager(next);
    }
    state.done[action.key] = at;
    await saveSystemState(state);
    result.finalized.push(action.matchday);
  }

  // Pushes höchstens einmal: erst den Schlüssel sichern, dann senden.
  const pushes = actions.filter((a) => a.kind === "push");
  if (pushes.length === 0) return result;
  for (const p of pushes) state.done[p.key] = at;
  await saveSystemState(state);
  for (const p of pushes) {
    const doc = await loadManager(p.userId);
    if (!doc?.push) continue;
    const outcome = await send(doc.push.subscription, {
      title: p.title,
      body: p.body,
      url: p.url,
      tag: p.key,
    });
    if (outcome === "sent") result.sent++;
    else if (outcome === "failed") result.failed++;
    else {
      // Abgelaufene Subscription entfernen (Workgrid-Muster).
      result.expired++;
      const { push: _removed, ...rest } = doc;
      await saveManager(rest);
    }
  }
  return result;
}
