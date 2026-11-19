// Ausführung des Taktgebers (KONZEPT 9). Was fällig ist, entscheidet core/planTick;
// hier: Finalisierung speichern, Schlüssel merken, Pushes senden.
import { matchdayCalendar, matchdayFinalizer, planTick } from "@fm/core";
import { finals, gameData } from "@/lib/game-data";
import { removePushDevices, updateManagers } from "@/lib/manager-writes";
import {
  sendPush,
  sendToAll,
  type PushPayload,
  type PushResult,
  type PushTarget,
} from "@/lib/push";
import {
  listAllManagers,
  loadManager,
  loadScraperHeartbeat,
  loadSystemState,
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
    scraper: await loadScraperHeartbeat(),
  });
  const result: TickResult = { finalized: [], sent: 0, failed: 0, expired: 0 };
  const at = now.toISOString();

  // Finalisierung zuerst; sie ist idempotent, der Schlüssel folgt erst danach.
  const positions = new Map(game.players.map((p) => [p.id, p.position]));
  const calendar = matchdayCalendar(game.fixtures, finalsOf());
  for (const action of actions) {
    if (action.kind !== "finalize") continue;
    await updateManagers(
      managers.map((m) => m.userId),
      matchdayFinalizer(
        managers,
        action.matchday,
        game.points,
        positions,
        calendar,
        game.season.firstScoredMatchday,
      ),
    );
    state.done[action.key] = at;
    await saveSystemState(state);
    result.finalized.push(action.matchday);
  }

  // Pushes höchstens einmal: erst den Schlüssel sichern, dann senden.
  const pushes = actions.filter((a) => a.kind === "push");
  if (pushes.length === 0) return result;
  for (const p of pushes) state.done[p.key] = at;
  await saveSystemState(state);
  await Promise.all(
    pushes.map(async (p) => {
      const doc = await loadManager(p.userId);
      if (!doc?.push) return;
      const report = await sendToAll(
        doc.push.subscriptions,
        { title: p.title, body: p.body, url: p.url, tag: p.key },
        send,
      );
      result.sent += report.sent;
      result.failed += report.failed;
      result.expired += report.expired.length;
      // Abgelaufene Geräte abmelden (Workgrid-Muster), die übrigen bleiben.
      if (report.expired.length > 0)
        await removePushDevices(p.userId, report.expired);
    }),
  );
  return result;
}
